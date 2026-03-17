import logging

from api.schemas import ClassResponse, UserTeacherResponse
from api.services.session_service import require_role
from api.services.user_service import get_teacher_details
from api.strings import Messages
from database import Class, User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/", response_model=list[UserTeacherResponse])
def get_all_teachers(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    teachers = db.query(User).filter(User.role == "teacher").all()
    results = []
    for teacher in teachers:
        details = get_teacher_details(teacher.id, db)
        results.append({**teacher.__dict__, **details})
    return results


@router.get("/{teacher_id}", response_model=UserTeacherResponse)
def get_teacher(
    teacher_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher" and current_user.id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    if teacher.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=Messages.USER_INVALID_ROLE
        )
    details = get_teacher_details(teacher.id, db)
    return {**teacher.__dict__, **details}


@router.get("/{teacher_id}/classes", response_model=list[ClassResponse])
def get_teacher_classes(
    teacher_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher" and current_user.id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    return db.query(Class).filter(Class.teacher_id == teacher_id).all()
