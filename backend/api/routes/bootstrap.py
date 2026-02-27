import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import UserRole
from api.services.auth_service import create_login_session
from db.database import User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bootstrap", tags=["bootstrap"])


@router.post("/operator")
def initialize_operator(db: Session = Depends(get_db)):
    # Check if operator exists
    operator = db.query(User).filter(User.role == UserRole.OPERATOR).first()
    if operator is not None:
        return {"message": Messages.OPERATOR_ALREADY_EXISTS}
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
                email="operator@attendance.softeng.com",
            )
            db.add(new_operator)
            db.commit()
            db.refresh(new_operator)
            logger.info(Logs.OPERATOR_CREATED.format(user_id=new_operator.id))
        # Auto-login (?)
        # TODO: Maybe there's a better way?
        return create_login_session(user_id=new_operator.id, timeout=1800)
    except Exception as e:
        logger.error(Logs.OPERATOR_BOOTSTRAP_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.OPERATOR_BOOTSTRAP_FAILED,
        )
