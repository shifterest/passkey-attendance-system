import secrets

from api.config import settings
from api.redis import redis_client
from api.schemas import LoginSessionBase, RegistrationSessionBase


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
