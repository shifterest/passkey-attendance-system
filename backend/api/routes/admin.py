import logging
import uuid
from datetime import datetime, timedelta, timezone

from api.config import settings
from api.messages import Logs, Messages
from api.services.auth_service import create_registration_session
from api.services.session_service import require_role
from db.database import Credential, RegistrationSession, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/register/{user_id}")
def register_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    new_uuid = str(uuid.uuid4())
    while True:
        record = (
            db.query(RegistrationSession)
            .filter(RegistrationSession.id == new_uuid)
            .first()
        )
        if record is None:
            break
        new_uuid = str(uuid.uuid4())
    new_session = RegistrationSession(
        id=new_uuid,
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=settings.registration_timeout),
    )
    db.add(new_session)
    db.commit()

    response = create_registration_session(new_session)

    logger.info(
        Logs.REGISTER_SESSION_CREATED.format(full_name=user.full_name, user_id=user.id)
    )
    return response


@router.post("/unregister/{user_id}")
def unregister_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
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
