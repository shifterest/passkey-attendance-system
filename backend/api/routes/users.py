import logging
import uuid

from api.schemas import (
    UserCreate,
    UserResponse,
    UserRoleChange,
    UserUpdate,
    UserUpdatedDetail,
)
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import User
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def get_all_users(
    role: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    if current_user.role == "student" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    return user


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    new_user = User(
        id=str(uuid.uuid4()),
        role=user_data.role,
        full_name=user_data.full_name,
        email=user_data.email,
        school_id=user_data.school_id,
        program=user_data.program,
        year_level=user_data.year_level,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(
        Logs.USER_ADDED.format(full_name=new_user.full_name, user_id=new_user.id)
    )
    return new_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    updated_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    updated_fields = updated_data.model_dump(exclude_unset=True)
    old_role = user.role if "role" in updated_fields else None
    for key, value in updated_fields.items():
        setattr(user, key, value)
    db.commit()
    log_audit_event(
        event_type=AuditEvents.USER_UPDATED,
        actor_id=current_user.id,
        target_id=user.id,
        detail=UserUpdatedDetail(
            updated_fields=list(updated_fields.keys()),
            old_value=UserRoleChange(role=old_role) if old_role is not None else None,
            new_value=UserRoleChange(role=user.role) if old_role is not None else None,
        ).model_dump(exclude_none=True),
        db=db,
    )
    logger.info(Logs.USER_EDITED.format(full_name=user.full_name, user_id=user.id))
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    db.delete(user)
    db.commit()
    return Response(status_code=204)
