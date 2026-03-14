import secrets
from datetime import datetime, timezone

from api.config import settings
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordVerificationMethods,
    LoginSessionBase,
    RegistrationSessionBase,
)
from db.database import LoginSession, RegistrationSession


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


# TODO: Refine this shit
def assurance_score_from_verification_methods(
    verification_methods: list[str] | None,
) -> int:
    score = 0
    if not verification_methods:
        return score
    for method in verification_methods:
        if method == AttendanceRecordVerificationMethods.DEVICE:
            score += 9
        elif method == AttendanceRecordVerificationMethods.PASSKEY:
            score += 8
        elif method == AttendanceRecordVerificationMethods.BLUETOOTH:
            score += 7
        elif method == AttendanceRecordVerificationMethods.MANUAL:
            score += 6
        elif method == AttendanceRecordVerificationMethods.GPS:
            score += 5
        elif method == AttendanceRecordVerificationMethods.NETWORK:
            score += 4

    return score
