import json

from api.redis import redis_client
from api.strings import Messages
from database.connection import get_db
from database.models import User
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session


def _parse_session_value(raw: bytes) -> tuple[str, str]:
    decoded = raw.decode()
    try:
        data = json.loads(decoded)
        return data["user_id"], data.get("client_type", "app")
    except (json.JSONDecodeError, KeyError):
        return decoded, "app"


def get_current_user(
    x_session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
) -> User:
    raw = redis_client.get(f"login_session_token:{x_session_token}")
    if not isinstance(raw, bytes):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_SESSION_INVALID,
        )
    user_id, _ = _parse_session_value(raw)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_SESSION_INVALID,
        )
    return user


def get_session_client_type(
    x_session_token: str = Header(..., alias="X-Session-Token"),
) -> str:
    raw = redis_client.get(f"login_session_token:{x_session_token}")
    if not isinstance(raw, bytes):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_SESSION_INVALID,
        )
    _, client_type = _parse_session_value(raw)
    return client_type


def require_client_type(*allowed: str):
    def check(client_type: str = Depends(get_session_client_type)) -> str:
        if client_type not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=Messages.SESSION_CLIENT_TYPE_FORBIDDEN,
            )
        return client_type

    return check


def require_role(*roles: str):
    def check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=Messages.AUTH_FORBIDDEN,
            )
        return current_user

    return check
