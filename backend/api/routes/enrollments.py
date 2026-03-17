import logging
import uuid

from api.models import EnrollmentDeletedDetail, EnrollmentDeletedOldValue
from api.schemas import (
    ClassEnrollmentCreate,
    ClassEnrollmentResponse,
    ClassEnrollmentUpdate,
)
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database import Class, ClassEnrollment, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("/", response_model=list[ClassEnrollmentResponse])
def get_all_enrollments(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    enrollments = db.query(ClassEnrollment).all()
    return enrollments


@router.get("/by-class/{class_id}", response_model=list[ClassEnrollmentResponse])
def get_enrollments_by_class(
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
    return enrollments


@router.get("/by-student/{student_id}", response_model=list[ClassEnrollmentResponse])
def get_enrollments_by_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("student", "teacher", "admin", "operator")
    ),
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == student_id).all()
    )
    return enrollments


@router.get(
    "/by-class/{class_id}/by-student/{student_id}/",
    response_model=ClassEnrollmentResponse,
)
def get_enrollment_by_class_and_student(
    class_id: str,
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("student", "teacher", "admin", "operator")
    ),
):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    enrollment = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.student_id == student_id,
            ClassEnrollment.class_id == class_id,
        )
        .first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    return enrollment


@router.post("/", response_model=ClassEnrollmentResponse)
def create_enrollment(
    enrollment_data: ClassEnrollmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    class_ = db.query(Class).filter(Class.id == enrollment_data.class_id).first()
    student = db.query(User).filter(User.id == enrollment_data.student_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.ENROLLMENT_CLASS_NOT_FOUND,
        )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.ENROLLMENT_STUDENT_NOT_FOUND,
        )
    existing = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.class_id == enrollment_data.class_id,
            ClassEnrollment.student_id == enrollment_data.student_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.ENROLLMENT_ALREADY_EXISTS,
        )
    new_enrollment = ClassEnrollment(
        id=str(uuid.uuid4()),
        class_id=enrollment_data.class_id,
        student_id=enrollment_data.student_id,
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    logger.info(
        Logs.ENROLLMENT_ADDED.format(
            student_name=student.full_name,
            class_name=class_.course_name,
            enrollment_id=new_enrollment.id,
        )
    )
    return new_enrollment


@router.put("/{enrollment_id}", response_model=ClassEnrollmentResponse)
def update_enrollment(
    enrollment_id: str,
    updated_data: ClassEnrollmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(enrollment, key, value)
    db.commit()
    logger.info(Logs.ENROLLMENT_EDITED.format(enrollment_id=enrollment.id))
    return enrollment


@router.delete("/{enrollment_id}")
def delete_enrollment(
    enrollment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    old_student_id = enrollment.student_id
    old_class_id = enrollment.class_id
    db.delete(enrollment)
    db.commit()
    log_audit_event(
        event_type=AuditEvents.ENROLLMENT_DELETED,
        actor_id=None,
        target_id=enrollment_id,
        detail=EnrollmentDeletedDetail(
            old_value=EnrollmentDeletedOldValue(
                student_id=old_student_id,
                class_id=old_class_id,
            )
        ).model_dump(),
        db=db,
    )
    return Response(status_code=204)
