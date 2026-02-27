import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import ClassCreate, ClassResponse, ClassUpdate, UserRole
from db.database import Class, User, get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/", response_model=list[ClassResponse])
def get_all_classes(db: Session = Depends(get_db)):
    classes = db.query(Class).all()
    return classes


@router.get("/by-teacher/{teacher_id}", response_model=list[ClassResponse])
def get_all_classes_by_teacher(teacher_id: str, db: Session = Depends(get_db)):
    classes = db.query(Class).filter(Class.teacher_id == teacher_id).all()
    return classes


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    return class_


@router.post("", response_model=ClassResponse)
def create_class(class_data: ClassCreate, db: Session = Depends(get_db)):
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
    new_uuid = str(uuid.uuid4())
    while True:
        class_ = db.query(Class).filter(Class.id == new_uuid).first()
        if class_ is None:
            break
        new_uuid = str(uuid.uuid4())
    new_class = Class(
        id=new_uuid,
        teacher_id=class_data.teacher_id,
        course_code=class_data.course_code,
        course_name=class_data.course_name,
        schedule=class_data.schedule,
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
    class_id: str, updated_data: ClassUpdate, db: Session = Depends(get_db)
):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(class_, key, value)
    db.commit()
    logger.info(
        Logs.CLASS_EDITED.format(
            course_name=class_.course_name, course_code=class_.course_code
        )
    )
    return class_


@router.delete("/{class_id}")
def delete_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    db.delete(class_)
    db.commit()
    return {"message": Messages.CLASS_DELETED}
