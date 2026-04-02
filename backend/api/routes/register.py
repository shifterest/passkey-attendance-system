import json
import logging
import uuid
from datetime import datetime, timezone

from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.helpers.base64url import encode_base64url
from api.helpers.credential import normalize_credential_id_base64url
from api.helpers.device_payload import build_device_payload
from api.redis import redis_client
from api.schemas import (
    CredentialResponse,
    DeviceAttestationFailureDetail,
    DeviceAttestationVerifiedDetail,
    RegistrationOptionsBase,
    RegistrationResponseBase,
)
from api.services.attestation_service import (
    google_hardware_attestation_roots,
    validate_android_key_attestation,
)
from api.services.audit_service import log_audit_event
from api.services.auth_service import (
    check_auth_rate_limit,
    credential_limit_reached,
    issued_at_ms_now,
    load_issued_at_ms,
    validate_registration_token,
    verify_device_signature,
)
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Credential, User
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_registration_options,
    options_to_json,
    verify_registration_response,
)
from webauthn.helpers.exceptions import InvalidRegistrationResponse
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AttestationFormat,
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/register", tags=["auth"])


@router.post("/options")
def register_options(
    options_data: RegistrationOptionsBase, db: Session = Depends(get_db)
):
    check_auth_rate_limit(options_data.user_id)
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )

    validate_registration_token(options_data.registration_token, user.id)

    if credential_limit_reached(user.id, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.CREDENTIAL_LIMIT_REACHED,
        )

    options = generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.rp_name,
        user_id=bytes(user.id, "utf-8"),
        user_name=user.email,
        user_display_name=user.full_name,
        timeout=settings.challenge_timeout * 1000,
        attestation=AttestationConveyancePreference.DIRECT,
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
    )
    issued_at_ms = issued_at_ms_now()

    redis_client.set(
        f"registration_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"registration_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )

    options_json = json.loads(options_to_json(options))
    options_json["issued_at_ms"] = issued_at_ms
    return options_json


@router.post("/verify", response_model=CredentialResponse)
def register_verify(
    response_data: RegistrationResponseBase, db: Session = Depends(get_db)
):
    check_auth_rate_limit(response_data.user_id)
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )

    validate_registration_token(response_data.registration_token, user.id, consume=True)

    challenge_key = f"registration_challenge:{user.id}"
    issued_at_ms_key = f"registration_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.getdel(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.REGISTER_NO_PENDING
        )
    issued_at_ms = load_issued_at_ms(issued_at_ms_key, Messages.REGISTER_NO_PENDING)
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if now_ms - issued_at_ms > settings.device_payload_max_age_ms:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.DEVICE_PAYLOAD_STALE,
        )

    try:
        if isinstance(challenge_bytes, bytes):
            registration_verification = verify_registration_response(
                credential=response_data.credential,
                expected_challenge=challenge_bytes,
                expected_origin=[settings.web_origin, settings.app_origin],
                expected_rp_id=settings.rp_id,
                pem_root_certs_bytes_by_fmt={
                    AttestationFormat.ANDROID_KEY: google_hardware_attestation_roots()
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=Messages.INVALID_CHALLENGE_DATA,
            )

        challenge = encode_base64url(challenge_bytes)
        device_payload = build_device_payload(
            flow=DeviceBindingFlow.REGISTER,
            user_id=user.id,
            session_id=None,
            credential_id=normalize_credential_id_base64url(response_data.credential),
            challenge=challenge,
            issued_at_ms=issued_at_ms,
        )
        try:
            verify_device_signature(
                device_public_key=response_data.device_public_key,
                device_signature=response_data.device_signature,
                payload=device_payload,
            )
        except HTTPException:
            log_audit_event(AuditEvents.DEVICE_SIGNATURE_FAILURE, None, user.id, {}, db)
            raise

        key_security_level = None
        is_legacy_root = False
        root_serial_hex = ""
        crl_verified: bool | None = None
        if settings.android_key_attestation_required:
            try:
                (
                    key_security_level,
                    is_legacy_root,
                    root_serial_hex,
                    crl_verified,
                ) = validate_android_key_attestation(
                    registration_verification.fmt,
                    registration_verification.attestation_object,
                )
            except ValueError as e:
                log_audit_event(
                    AuditEvents.DEVICE_ATTESTATION_FAILURE,
                    None,
                    user.id,
                    DeviceAttestationFailureDetail(reason=str(e)).model_dump(),
                    db,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=Messages.DEVICE_KEY_INSECURE,
                ) from e

        if crl_verified is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=Messages.ATTESTATION_CRL_REVOKED,
            )

        if credential_limit_reached(user.id, db):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=Messages.CREDENTIAL_LIMIT_REACHED,
            )

        new_credential = Credential(
            id=str(uuid.uuid4()),
            user_id=user.id,
            device_public_key=response_data.device_public_key,
            public_key=registration_verification.credential_public_key.hex(),
            credential_id=encode_base64url(registration_verification.credential_id),
            sign_count=0,
            key_security_level=key_security_level,
            attestation_crl_verified=crl_verified,
            registered_at=datetime.now(timezone.utc),
        )
        db.add(new_credential)
        db.commit()
        db.refresh(new_credential)
        if settings.android_key_attestation_required:
            assert key_security_level is not None
            log_audit_event(
                AuditEvents.DEVICE_ATTESTATION_VERIFIED,
                None,
                user.id,
                DeviceAttestationVerifiedDetail(
                    credential_id=new_credential.id,
                    root_serial_hex=root_serial_hex,
                    is_legacy_root=is_legacy_root,
                    key_security_level=key_security_level,
                ).model_dump(),
                db,
            )
        if settings.android_key_attestation_required and is_legacy_root:
            logger.warning(
                Logs.LEGACY_ATTESTATION_ROOT_ACCEPTED.format(
                    user_id=new_credential.user_id,
                    credential_id=new_credential.id,
                    root_serial_hex=root_serial_hex,
                )
            )
        logger.info(
            Logs.USER_REGISTERED.format(
                user_id=new_credential.user_id, credential_id=new_credential.id
            )
        )
        return new_credential
    except InvalidRegistrationResponse as e:
        logger.error(Logs.REGISTER_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.REGISTER_VERIFY_FAILED,
        )
    except HTTPException:
        raise
