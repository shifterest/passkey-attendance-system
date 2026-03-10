import secrets

from api.config import settings
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordVerificationMethods,
    LoginSessionBase,
    RegistrationSessionBase,
)


def create_login_session(user_id: str, timeout: int):
    token = secrets.token_urlsafe(32)
    while True:
        record_bytes = redis_client.get(f"session_token:{token}")
        if not record_bytes:
            break
        token = secrets.token_urlsafe(32)
    redis_client.set(f"session_token:{token}", user_id, ex=timeout)
    return LoginSessionBase(
        user_id=user_id,
        session_token=token,
        expires_in=timeout,
    )


def create_registration_session(user_id: str, timeout: int):
    token = secrets.token_urlsafe(32)
    while True:
        record_bytes = redis_client.get(f"registration_token:{token}")
        if not record_bytes:
            break
        token = secrets.token_urlsafe(32)
    redis_client.set(f"registration_token:{token}", user_id, ex=timeout)
    url = f"{settings.registration_protocol}://register?token={token}&user_id={user_id}"
    return RegistrationSessionBase(
        user_id=user_id, registration_token=token, expires_in=timeout, url=url
    )


def validate_registration_token(user_id: str, token: str):
    user_id_bytes = redis_client.get(f"registration_token:{token}")
    if not user_id_bytes:
        return False
    if user_id == user_id_bytes.decode():  # type: ignore
        return True
    return False


# DEVICE = "device"
#     PASSKEY = "passkey"
#     BLUETOOTH = "bluetooth"
#     NETWORK = "network"
#     GPS = "gps"
#     MANUAL = "manual"


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
