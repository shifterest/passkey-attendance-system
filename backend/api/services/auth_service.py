import secrets

from api.redis import redis_client
from api.schemas import LoginSessionBase


def create_login_session(user_id: str, timeout: int):
    session_token = secrets.token_urlsafe(32)
    while True:
        record_bytes = redis_client.get(f"session_token:{session_token}")
        if not record_bytes:
            break
        session_token = secrets.token_urlsafe(32)
    redis_client.set(f"session_token:{session_token}", user_id, ex=timeout)
    expires_in = redis_client.ttl(f"session_token:{session_token}")
    return LoginSessionBase(
        user_id=user_id,
        session_token=session_token,
        expires_in=expires_in,  # type: ignore
    )
