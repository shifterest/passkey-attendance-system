import logging

from api.config import settings
from api.messages import Logs, Messages
from api.services.auth_service import create_registration_session
from db.database import Credential, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/register/{user_id}")
def register_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    response = create_registration_session(
        user_id=user.id, timeout=settings.registration_timeout
    )

    logger.info(
        Logs.REGISTER_SESSION_CREATED.format(full_name=user.full_name, user_id=user.id)
    )
    return response


@router.post("/unregister/{user_id}")
def unregister_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIALS_NOT_FOUND
        )

    for credential in credentials:
        db.delete(credential)
    db.commit()

    logger.info(
        Logs.USER_UNREGISTERED.format(full_name=user.full_name, user_id=user.id)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
