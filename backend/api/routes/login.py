import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.helpers.base64url import decode_base64url, encode_base64url
from api.helpers.credential import normalize_credential_id_base64url
from api.helpers.device_payload import build_device_payload
from api.redis import redis_client
from api.schemas import (
    DeviceKeyMismatchDetail,
    DeviceSignatureFailureDetail,
    LoginOptionsBase,
    LoginResponseBase,
    LoginSessionBase,
    LogoutOptionsBase,
    SignCountAnomalyDetail,
    UserRole,
    WebLoginInitiateResponse,
    WebLoginPollResponse,
    WebLoginVerifyRequest,
)
from api.services.audit_service import log_audit_event
from api.services.auth_service import (
    check_auth_rate_limit,
    create_login_session,
    get_user_credential_for_assertion,
    issued_at_ms_now,
    load_issued_at_ms,
    verify_device_signature,
)
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Credential, LoginSession, User
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
)
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)

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

    user_credentials = (
        db.query(Credential).filter(Credential.user_id == user.id).all()
    )
    if not user_credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_NO_CREDENTIAL,
        )

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
        allow_credentials=[
            PublicKeyCredentialDescriptor(
                id=decode_base64url(c.credential_id),
            )
            for c in user_credentials
        ],
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
    for cred in options_json.get("allowCredentials", []):
        cred.setdefault("transports", ["internal"])
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
                user.id,
                user.id,
                DeviceKeyMismatchDetail(credential_id=user_credential.id).model_dump(),
                db,
            )
            db.commit()
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
                user.id,
                user.id,
                DeviceSignatureFailureDetail(
                    credential_id=user_credential.id
                ).model_dump(),
                db,
            )
            db.commit()
            raise

        user_credential.sign_count = authentication_verification.new_sign_count
        if (
            authentication_verification.new_sign_count > 0
            and authentication_verification.new_sign_count <= user_sign_count
        ):
            user_credential.sign_count_anomaly = True
            log_audit_event(
                AuditEvents.SIGN_COUNT_ANOMALY,
                user.id,
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
            client_type="app",
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.login_timeout),
            last_activity_at=None,
        )
        db.add(new_session)
        db.commit()

        login_response = create_login_session(new_session, user.role)

        logger.info(
            Logs.LOGIN_SUCCESSFUL.format(full_name=user.full_name, user_id=user.id)
        )
        return login_response
    except WebAuthnException as e:
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
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    session_token = session_token_bytes.decode()
    if session_token != options_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.SESSION_USER_MISMATCH,
        )
    redis_client.delete(f"login_session_token:{options_data.session_token}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


WEB_LOGIN_PREFIX = "web_login:"


@router.post("/web-login/initiate", response_model=WebLoginInitiateResponse)
def web_login_initiate():
    token = secrets.token_urlsafe(32)
    ttl = settings.web_login_token_ttl_seconds
    redis_client.set(f"{WEB_LOGIN_PREFIX}{token}", "pending", ex=ttl)
    url = f"{settings.registration_protocol}://web-login?token={token}"
    logger.info(Logs.WEB_LOGIN_INITIATED.format(token_id=token[:8]))
    return WebLoginInitiateResponse(
        token=token,
        url=url,
        ttl=ttl,
        poll_interval=settings.web_login_poll_interval_hint,
    )


@router.get("/web-login/poll", response_model=WebLoginPollResponse)
def web_login_poll(token: str):
    key = f"{WEB_LOGIN_PREFIX}{token}"
    value = redis_client.get(key)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.WEB_LOGIN_TOKEN_NOT_FOUND,
        )
    val = value.decode() if isinstance(value, bytes) else value
    if val == "pending":
        return WebLoginPollResponse(status="pending", session=None)
    if val == "consumed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.WEB_LOGIN_TOKEN_CONSUMED,
        )
    session_key = f"{WEB_LOGIN_PREFIX}{token}:session"
    session_json = redis_client.get(session_key)
    if session_json is None:
        return WebLoginPollResponse(status="pending", session=None)
    import json as _json

    data = _json.loads(session_json)
    redis_client.set(key, "consumed", ex=10)
    redis_client.delete(session_key)
    return WebLoginPollResponse(
        status="completed",
        session=LoginSessionBase(**data),
    )


@router.post("/web-login/verify", response_model=LoginSessionBase)
def web_login_verify(
    request_data: WebLoginVerifyRequest, db: Session = Depends(get_db)
):
    key = f"{WEB_LOGIN_PREFIX}{request_data.web_login_token}"
    value = redis_client.get(key)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.WEB_LOGIN_TOKEN_NOT_FOUND,
        )
    val = value.decode() if isinstance(value, bytes) else value
    if val != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.WEB_LOGIN_TOKEN_CONSUMED,
        )

    check_auth_rate_limit(request_data.user_id)
    user = db.query(User).filter(User.id == request_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
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
        assertion_credential=request_data.credential,
        db=db,
    )
    user_sign_count = user_credential.sign_count

    try:
        if not isinstance(challenge_bytes, bytes):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=Messages.INVALID_CHALLENGE_DATA,
            )
        authentication_verification = verify_authentication_response(
            credential=request_data.credential,
            expected_challenge=challenge_bytes,
            expected_origin=[settings.web_origin, settings.app_origin],
            expected_rp_id=settings.rp_id,
            credential_public_key=bytes.fromhex(user_credential.public_key),
            credential_current_sign_count=user_sign_count,
        )
    except WebAuthnException as e:
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )

    if request_data.device_public_key != user_credential.device_public_key:
        log_audit_event(
            AuditEvents.DEVICE_KEY_MISMATCH,
            user.id,
            user.id,
            DeviceKeyMismatchDetail(credential_id=user_credential.id).model_dump(),
            db,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.DEVICE_PUBLIC_KEY_MISMATCH,
        )

    challenge = encode_base64url(challenge_bytes)
    device_payload = build_device_payload(
        flow=DeviceBindingFlow.LOGIN,
        user_id=user.id,
        session_id=None,
        credential_id=normalize_credential_id_base64url(request_data.credential),
        challenge=challenge,
        issued_at_ms=issued_at_ms,
    )
    try:
        verify_device_signature(
            device_public_key=user_credential.device_public_key,
            device_signature=request_data.device_signature,
            payload=device_payload,
        )
    except HTTPException:
        log_audit_event(
            AuditEvents.DEVICE_SIGNATURE_FAILURE,
            user.id,
            user.id,
            DeviceSignatureFailureDetail(credential_id=user_credential.id).model_dump(),
            db,
        )
        db.commit()
        raise

    login_timeout = (
        settings.login_timeout_privileged
        if user.role in (UserRole.ADMIN, UserRole.OPERATOR)
        else settings.login_timeout
    )

    user_credential.sign_count = authentication_verification.new_sign_count
    if (
        authentication_verification.new_sign_count > 0
        and authentication_verification.new_sign_count <= user_sign_count
    ):
        user_credential.sign_count_anomaly = True
        log_audit_event(
            AuditEvents.SIGN_COUNT_ANOMALY,
            user.id,
            user.id,
            SignCountAnomalyDetail(credential_id=user_credential.id).model_dump(),
            db,
        )

    new_session = LoginSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        client_type="web",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=login_timeout),
        last_activity_at=None,
    )
    db.add(new_session)
    db.commit()

    login_response = create_login_session(new_session, user.role)

    session_data = login_response.model_dump()
    session_data["created_at"] = session_data["created_at"].isoformat()
    session_data["expires_at"] = session_data["expires_at"].isoformat()

    redis_client.set(key, "completed", ex=30)
    redis_client.set(
        f"{key}:session",
        json.dumps(session_data),
        ex=30,
    )

    logger.info(
        Logs.WEB_LOGIN_COMPLETED.format(full_name=user.full_name, user_id=user.id)
    )
    return login_response
