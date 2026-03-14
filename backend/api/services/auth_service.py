import base64
import binascii
import secrets
from datetime import datetime, timezone
from typing import Any, cast

from api.config import settings
from api.contracts.device import DEVICE_PAYLOAD_VERSION, DeviceBindingFlow
from api.messages import Messages
from api.redis import redis_client
from api.schemas import (
    DeviceBindingPayload,
    LoginSessionBase,
    RegistrationSessionBase,
)
from api.services.device_service import (
    canonical_payload_bytes,
    credential_id_matches,
    normalize_credential_id_base64url,
)
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_der_public_key
from db.database import Credential, LoginSession, RegistrationSession
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

AUTH_RATELIMIT_USER_PREFIX = "auth:ratelimit:user:"


def create_login_session(session: LoginSession):
    expires_delta = session.expires_at - datetime.now(timezone.utc)
    expires_in = max(0, int(expires_delta.total_seconds()))

    token = secrets.token_urlsafe(32)
    while True:
        redis_session = redis_client.get(f"login_session_token:{token}")
        if not redis_session:
            break
        token = secrets.token_urlsafe(32)
    redis_client.set(
        f"login_session_token:{token}",
        session.user_id,
        ex=expires_delta,
    )

    return LoginSessionBase(
        user_id=session.user_id,
        session_token=token,
        created_at=session.created_at,
        expires_at=session.expires_at,
        expires_in=expires_in,
    )


def create_registration_session(session: RegistrationSession):
    expires_delta = session.expires_at - datetime.now(timezone.utc)
    expires_in = max(0, int(expires_delta.total_seconds()))

    token = secrets.token_urlsafe(32)
    while True:
        record_bytes = redis_client.get(f"registration_session_token:{token}")
        if not record_bytes:
            break
        token = secrets.token_urlsafe(32)
    redis_client.set(
        f"registration_session_token:{token}",
        session.user_id,
        ex=expires_delta,
    )

    url = f"{settings.registration_protocol}://register?token={token}&user_id={session.user_id}"
    return RegistrationSessionBase(
        user_id=session.user_id,
        registration_token=token,
        created_at=session.created_at,
        expires_at=session.expires_at,
        expires_in=expires_in,
        url=url,
    )


def validate_registration_token(user_id: str, token: str):
    user_id_bytes = redis_client.get(f"registration_session_token:{token}")
    if not user_id_bytes:
        return False
    if user_id == user_id_bytes.decode():  # type: ignore
        return True
    return False


def issued_at_ms_now() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def check_auth_rate_limit(user_id: str) -> None:
    key = f"{AUTH_RATELIMIT_USER_PREFIX}{user_id}"
    redis_client.set(key, 0, ex=settings.auth_user_ratelimit_window, nx=True)
    count = cast(int, redis_client.incr(key))
    if count > settings.auth_user_ratelimit_max:
        ttl = cast(int, redis_client.ttl(key))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=Messages.AUTH_RATE_LIMITED,
            headers={"Retry-After": str(max(ttl, 1))},
        )


def credential_limit_reached(user_id: str, db: Session) -> bool:
    if settings.max_active_credentials_per_user <= 0:
        return False

    return (
        db.query(Credential).filter(Credential.user_id == user_id).count()
        >= settings.max_active_credentials_per_user
    )


def build_device_payload(
    flow: DeviceBindingFlow,
    user_id: str,
    session_id: str | None,
    credential_id: str | None,
    challenge: str,
    issued_at_ms: int,
) -> DeviceBindingPayload:
    return DeviceBindingPayload(
        v=DEVICE_PAYLOAD_VERSION,
        flow=flow,
        user_id=user_id,
        session_id=session_id,
        credential_id=credential_id,
        challenge=challenge,
        issued_at_ms=issued_at_ms,
    )


def get_user_credential_for_assertion(
    user_id: str,
    assertion_credential: dict[str, Any],
    db: Session,
) -> Credential:
    user_credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    if len(user_credentials) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_NO_CREDENTIAL,
        )

    asserted_credential_id = normalize_credential_id_base64url(assertion_credential)
    if asserted_credential_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_CREDENTIAL_MISMATCH,
        )

    for credential in user_credentials:
        if credential_id_matches(credential.credential_id, asserted_credential_id):
            if credential.credential_id != asserted_credential_id:
                credential.credential_id = asserted_credential_id
            return credential

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=Messages.AUTH_CREDENTIAL_MISMATCH,
    )


def verify_device_signature(
    device_public_key: str,
    device_signature: str,
    payload: DeviceBindingPayload,
):
    try:
        public_key_bytes = base64.b64decode(device_public_key, validate=True)
        signature_bytes = base64.b64decode(device_signature, validate=True)
        public_key = load_der_public_key(public_key_bytes)

        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Invalid key algorithm")

        public_key.verify(
            signature_bytes,
            canonical_payload_bytes(payload),
            ec.ECDSA(hashes.SHA256()),
        )
    except (
        binascii.Error,
        InvalidSignature,
        UnsupportedAlgorithm,
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.DEVICE_VERIFY_FAILED,
        )


def load_issued_at_ms(
    key: str,
    pending_error_message: str,
) -> int:
    issued_at_ms_bytes = redis_client.getdel(key)
    if not issued_at_ms_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=pending_error_message,
        )

    if not isinstance(issued_at_ms_bytes, bytes):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.INVALID_CHALLENGE_DATA,
        )

    try:
        return int(issued_at_ms_bytes.decode())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.INVALID_CHALLENGE_DATA,
        )
