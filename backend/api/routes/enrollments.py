import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import (
    ClassEnrollmentCreate,
    ClassEnrollmentResponse,
    ClassEnrollmentUpdate,
)
from db.database import Class, ClassEnrollment, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/enrollments", tags=["enrollments"])


@router.get("/", response_model=list[ClassEnrollmentResponse])
def get_all_enrollments(db: Session = Depends(get_db)):
    enrollments = db.query(ClassEnrollment).all()
    return enrollments


@router.get("/by-class/{class_id}", response_model=list[ClassEnrollmentResponse])
def get_enrollments_by_class(class_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    )
    return enrollments


@router.get("/by-student/{student_id}", response_model=list[ClassEnrollmentResponse])
def get_enrollments_by_student(student_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == student_id).all()
    )
    return enrollments


@router.get(
    "/by-class/{class_id}/by-student/{student_id}/",
    response_model=ClassEnrollmentResponse,
)
def get_enrollment_by_class_and_student(
    class_id: str, student_id: str, db: Session = Depends(get_db)
):
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
    enrollment_data: ClassEnrollmentCreate, db: Session = Depends(get_db)
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
    new_uuid = str(uuid.uuid4())
    while True:
        enrollment = (
            db.query(ClassEnrollment).filter(ClassEnrollment.id == new_uuid).first()
        )
        if enrollment is None:
            break
        new_uuid = str(uuid.uuid4())
    new_enrollment = ClassEnrollment(
        id=new_uuid,
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
def delete_enrollment(enrollment_id: str, db: Session = Depends(get_db)):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    db.delete(enrollment)
    db.commit()
    return Response(status_code=204)
