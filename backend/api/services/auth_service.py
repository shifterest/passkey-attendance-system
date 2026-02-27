import uuid

from api.api import redis_client
from api.schemas import LoginSessionBase
from db.database import get_db


def create_login_session(user_id: str, timeout: int):
    session_token = str(uuid.uuid4())
    while True:
        record = redis_client.get(f"session_token:{session_token}")
        if not record:  # type: ignore
            break
        session_token = str(uuid.uuid4())
    redis_client.set(f"session_token:{session_token}", user_id, ex=timeout)
    expires_in = redis_client.ttl(f"session_token:{session_token}")
    return LoginSessionBase(
        user_id=user_id,
        session_token=session_token,
        expires_in=expires_in,  # type: ignore
    )
