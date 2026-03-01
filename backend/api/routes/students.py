import logging

from api.messages import Messages
from api.schemas import UserRole, UserStudentResponse
from api.services.user_service import get_student_details
from db.database import User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["students"])


@router.get("/", response_model=list[UserStudentResponse])
def get_all_user_students(db: Session = Depends(get_db)):
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    results = []
    for student in students:
        details = get_student_details(student.id, db)
        results.append({**student.__dict__, **details})
    return results


@router.get("/{user_id}", response_model=UserStudentResponse)
def get_user_student(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.USER_NOT_STUDENT,
        )

    details = get_student_details(user_id, db)
    return {**user.__dict__, **details}
