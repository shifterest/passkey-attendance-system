import logging

from api.messages import Messages
from api.schemas import UserRole, UserStudentResponse
from api.services.session_service import require_role
from api.services.user_service import get_student_details
from db.database import Class, ClassEnrollment, User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/students", tags=["students"])


@router.get("/", response_model=list[UserStudentResponse])
def get_all_user_students(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    students = db.query(User).filter(User.role == UserRole.STUDENT).all()
    results = []
    for student in students:
        details = get_student_details(student.id, db)
        results.append({**student.__dict__, **details})
    return results


@router.get("/{user_id}", response_model=UserStudentResponse)
def get_user_student(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("student", "teacher", "admin", "operator")
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
    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.USER_NOT_STUDENT,
        )

    details = get_student_details(user_id, db)
    return {**user.__dict__, **details}


@router.get("/by-class/{class_id}", response_model=list[UserStudentResponse])
def get_students_by_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    )
    results = []
    for enrollment in enrollments:
        student = enrollment.student
        details = get_student_details(student.id, db)
        results.append({**student.__dict__, **details})
    return results


@router.get("/by-teacher/{teacher_id}", response_model=list[UserStudentResponse])
def get_students_by_teacher(
    teacher_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher" and current_user.id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    classes = db.query(Class).filter(Class.teacher_id == teacher_id).all()
    class_ids = [c.id for c in classes]
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.class_id.in_(class_ids)).all()
    )
    seen_ids: set[str] = set()
    results = []
    for enrollment in enrollments:
        student = enrollment.student
        if student.id in seen_ids:
            continue
        seen_ids.add(student.id)
        details = get_student_details(student.id, db)
        results.append({**student.__dict__, **details})
    return results
