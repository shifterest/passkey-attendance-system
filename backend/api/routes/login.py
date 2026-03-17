import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from api.models import (
    DeviceKeyMismatchDetail,
    DeviceSignatureFailureDetail,
    SignCountAnomalyDetail,
)
from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.redis import redis_client
from api.schemas import (
    LoginOptionsBase,
    LoginResponseBase,
    LoginSessionBase,
    LogoutOptionsBase,
)
from api.services.audit_service import log_audit_event
from api.services.auth_service import (
    build_device_payload,
    check_auth_rate_limit,
    create_login_session,
    get_user_credential_for_assertion,
    issued_at_ms_now,
    load_issued_at_ms,
    verify_device_signature,
)
from api.services.device_service import (
    encode_base64url,
    normalize_credential_id_base64url,
)
from api.strings import AuditEvents, Logs, Messages
from database import LoginSession, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
)
from webauthn.helpers.exceptions import InvalidAuthenticationResponse
from webauthn.helpers.structs import UserVerificationRequirement

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login/options")
def login_options(options_data: LoginOptionsBase, db: Session = Depends(get_db)):
    check_auth_rate_limit(options_data.user_id)
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    issued_at_ms = issued_at_ms_now()

    redis_client.set(
        f"login_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"login_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )

    options_json = json.loads(options_to_json(options))
    options_json["issued_at_ms"] = issued_at_ms
    return options_json


@router.post("/login/verify", response_model=LoginSessionBase)
def login_verify(response_data: LoginResponseBase, db: Session = Depends(get_db)):
    check_auth_rate_limit(response_data.user_id)
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )
    challenge_key = f"login_challenge:{user.id}"
    issued_at_ms_key = f"login_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.getdel(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    issued_at_ms = load_issued_at_ms(issued_at_ms_key, Messages.AUTH_NO_PENDING)
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if now_ms - issued_at_ms > settings.device_payload_max_age_ms:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.DEVICE_PAYLOAD_STALE,
        )

    user_credential = get_user_credential_for_assertion(
        user_id=user.id,
        assertion_credential=response_data.credential,
        db=db,
    )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
        if isinstance(challenge_bytes, bytes):
            authentication_verification = verify_authentication_response(
                credential=response_data.credential,
                expected_challenge=challenge_bytes,
                expected_origin=[settings.web_origin, settings.app_origin],
                expected_rp_id=settings.rp_id,
                credential_public_key=bytes.fromhex(user_public_key),
                credential_current_sign_count=user_sign_count,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=Messages.INVALID_CHALLENGE_DATA,
            )

        if response_data.device_public_key != user_credential.device_public_key:
            log_audit_event(
                AuditEvents.DEVICE_KEY_MISMATCH,
                None,
                user.id,
                DeviceKeyMismatchDetail(credential_id=user_credential.id).model_dump(),
                db,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=Messages.DEVICE_PUBLIC_KEY_MISMATCH,
            )

        challenge = encode_base64url(challenge_bytes)
        device_payload = build_device_payload(
            flow=DeviceBindingFlow.LOGIN,
            user_id=user.id,
            session_id=None,
            credential_id=normalize_credential_id_base64url(response_data.credential),
            challenge=challenge,
            issued_at_ms=issued_at_ms,
        )
        try:
            verify_device_signature(
                device_public_key=user_credential.device_public_key,
                device_signature=response_data.device_signature,
                payload=device_payload,
            )
        except HTTPException:
            log_audit_event(
                AuditEvents.DEVICE_SIGNATURE_FAILURE,
                None,
                user.id,
                DeviceSignatureFailureDetail(
                    credential_id=user_credential.id
                ).model_dump(),
                db,
            )
            raise

        user_credential.sign_count = authentication_verification.new_sign_count
        if (
            authentication_verification.new_sign_count > 0
            and authentication_verification.new_sign_count <= user_sign_count
        ):
            user_credential.sign_count_anomaly = True
            log_audit_event(
                AuditEvents.SIGN_COUNT_ANOMALY,
                None,
                user.id,
                SignCountAnomalyDetail(
                    credential_id=user_credential.id,
                    old_count=user_sign_count,
                    new_count=authentication_verification.new_sign_count,
                ).model_dump(),
                db,
            )

        new_session = LoginSession(
            id=str(uuid.uuid4()),
            user_id=user.id,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.login_timeout),
            last_activity_at=None,
        )
        db.add(new_session)
        db.commit()

        login_response = create_login_session(new_session)

        logger.info(
            Logs.LOGIN_SUCCESSFUL.format(full_name=user.full_name, user_id=user.id)
        )
        return login_response
    except InvalidAuthenticationResponse as e:
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
    except HTTPException:
        raise


@router.post("/logout")
def logout(options_data: LogoutOptionsBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    session_token_bytes = redis_client.get(
        f"login_session_token:{options_data.session_token}"
    )
    if not isinstance(session_token_bytes, bytes):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.LOGIN_SESSION_NOT_FOUND,
        )
    session_token = session_token_bytes.decode()
    if session_token != options_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.SESSION_USER_MISMATCH,
        )
    redis_client.delete(f"login_session_token:{options_data.session_token}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
