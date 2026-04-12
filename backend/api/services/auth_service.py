import base64
import binascii
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from api.config import settings
from api.helpers.credential import (
    credential_id_matches,
    normalize_credential_id_base64url,
)
from api.helpers.device_payload import canonical_payload_bytes
from api.redis import redis_client
from api.schemas import (
    DeviceBindingPayload,
    LoginSessionBase,
    RegistrationSessionBase,
)
from api.strings import Messages
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_der_public_key
from database.models import Credential, LoginSession, RegistrationSession
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

AUTH_RATELIMIT_USER_PREFIX = "auth:ratelimit:user:"


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def create_login_session(session: LoginSession, role: str):
    expires_at = _as_utc(session.expires_at)
    created_at = _as_utc(session.created_at)
    expires_delta = expires_at - datetime.now(timezone.utc)
    expires_in = max(0, int(expires_delta.total_seconds()))

    token = secrets.token_urlsafe(32)
    while True:
        redis_session = redis_client.get(f"login_session_token:{token}")
        if not redis_session:
            break
        token = secrets.token_urlsafe(32)

    session_value = json.dumps(
        {"user_id": session.user_id, "client_type": session.client_type}
    )
    redis_client.set(
        f"login_session_token:{token}",
        session_value,
        ex=expires_delta,
    )

    return LoginSessionBase(
        user_id=session.user_id,
        session_token=token,
        role=role,
        client_type=session.client_type,
        created_at=created_at,
        expires_at=expires_at,
        expires_in=expires_in,
    )


def create_registration_session(session: RegistrationSession):
    expires_at = _as_utc(session.expires_at)
    created_at = _as_utc(session.created_at)
    expires_delta = expires_at - datetime.now(timezone.utc)
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
        created_at=created_at,
        expires_at=expires_at,
        expires_in=expires_in,
        url=url,
    )


def validate_registration_token(
    token: str,
    expected_user_id: str | None = None,
    *,
    consume: bool = False,
) -> str:
    key = f"registration_session_token:{token}"
    user_id_bytes = redis_client.getdel(key) if consume else redis_client.get(key)
    if not isinstance(user_id_bytes, bytes):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.REGISTRATION_TOKEN_INVALID,
        )
    user_id = user_id_bytes.decode()
    if expected_user_id is not None and user_id != expected_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.REGISTRATION_TOKEN_USER_MISMATCH,
        )
    return user_id


def issued_at_ms_now() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def check_auth_rate_limit(user_id: str) -> None:
    key = f"{AUTH_RATELIMIT_USER_PREFIX}{user_id}"
    redis_client.set(key, 0, ex=settings.auth_user_ratelimit_window, nx=True)
    count = int(redis_client.incr(key))
    if count > settings.auth_user_ratelimit_max:
        ttl = int(redis_client.ttl(key))
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
            raise ValueError(Messages.DEVICE_KEY_ALGORITHM_INVALID)

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
