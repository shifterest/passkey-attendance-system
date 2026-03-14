import logging
import uuid
from datetime import datetime, timedelta, timezone

from api.config import settings
from api.messages import Logs, Messages
from api.schemas import UserRole
from api.services.auth_service import create_login_session
from db.database import LoginSession, User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bootstrap", tags=["bootstrap"])


@router.get("/status")
def bootstrap_status(db: Session = Depends(get_db)):
    # TODO: Detect flag instead of operator presence. This is good for now
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if operator is None and admin is None:
        return True
    else:
        return False


@router.post("/operator")
def initialize_operator(db: Session = Depends(get_db)):
    # Check if operator exists
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    if operator is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.OPERATOR_ALREADY_EXISTS,
        )
    # Check if an admin exists
    new_operator = db.query(User).filter(User.role == UserRole.ADMIN).first()
    try:
        if new_operator is not None:
            logger.info(
                Logs.ADMIN_PROMOTED_TO_OPERATOR.format(
                    full_name=new_operator.full_name, user_id=new_operator.id
                )
            )
        else:
            # Create an operator if there's no operator nor admin
            new_operator = User(
                id=str(uuid.uuid4()),
                role=UserRole.OPERATOR,
                full_name="Operator",
                email=f"operator@{settings.rp_id}",
            )
            db.add(new_operator)
            db.commit()
            db.refresh(new_operator)
            logger.info(Logs.OPERATOR_CREATED.format(user_id=new_operator.id))

        new_session = LoginSession(
            id=str(uuid.uuid4()),
            user_id=new_operator.id,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=1800),
            last_activity_at=None,
        )
        db.add(new_session)
        db.commit()

        # Auto-login (?)
        # TODO: Maybe there's a better way? Allow the backend to be started with
        # a flag/env var that allows bootstrapping
        return create_login_session(new_session)
    except Exception as e:
        logger.error(Logs.OPERATOR_BOOTSTRAP_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.OPERATOR_BOOTSTRAP_FAILED,
        )
