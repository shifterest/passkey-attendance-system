from api.redis import redis_client
from api.strings import Messages
from database import User, get_db
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session


def get_current_user(
    x_session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
) -> User:
    user_id_bytes = redis_client.get(f"login_session_token:{x_session_token}")
    if not isinstance(user_id_bytes, bytes):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_SESSION_INVALID,
        )
    user = db.query(User).filter(User.id == user_id_bytes.decode()).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_SESSION_INVALID,
        )
    return user


def require_role(*roles: str):
    def check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=Messages.AUTH_FORBIDDEN,
            )
        return current_user

    return check
