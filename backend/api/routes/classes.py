import logging
import uuid

from api.schemas import (
    ClassCreate,
    ClassResponse,
    ClassUpdate,
    Schedule,
    UserRole,
)
from api.services.session_service import require_role
from api.strings import Logs, Messages
from database.connection import get_db
from database.models import Class, User
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/classes", tags=["classes"])


def _serialize_schedule(schedule: list[Schedule]):
    return [entry.model_dump(mode="json") for entry in schedule]


@router.get("/", response_model=list[ClassResponse])
def get_all_classes(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    classes = db.query(Class).all()
    return classes


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    if current_user.role == "teacher" and class_.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    return class_


@router.post("", response_model=ClassResponse)
def create_class(
    class_data: ClassCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    teacher = db.query(User).filter(User.id == class_data.teacher_id).first()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.CLASS_TEACHER_NOT_FOUND,
        )
    if teacher.role != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.CLASS_TEACHER_INVALID_ROLE,
        )
    new_class = Class(
        id=str(uuid.uuid4()),
        teacher_id=class_data.teacher_id,
        course_code=class_data.course_code,
        course_name=class_data.course_name,
        schedule=_serialize_schedule(class_data.schedule),
        standard_assurance_threshold=class_data.standard_assurance_threshold,
        high_assurance_threshold=class_data.high_assurance_threshold,
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    logger.info(
        Logs.CLASS_ADDED.format(
            course_name=new_class.course_name, course_code=new_class.course_code
        )
    )
    return new_class


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: str,
    updated_data: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    if current_user.role == "teacher" and class_.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    for key, value in updated_data.model_dump(mode="json", exclude_unset=True).items():
        setattr(class_, key, value)
    db.commit()
    logger.info(
        Logs.CLASS_EDITED.format(
            course_name=class_.course_name, course_code=class_.course_code
        )
    )
    return class_


@router.delete("/{class_id}")
def delete_class(
    class_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    db.delete(class_)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
