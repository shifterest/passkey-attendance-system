import logging
import uuid
from datetime import datetime, timezone

from api.schemas import SemesterCreate, SemesterResponse, SemesterUpdate
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import Semester, User
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/semesters", tags=["semesters"])


@router.get("/", response_model=list[SemesterResponse])
def get_all_semesters(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator", "teacher")),
):
    return db.query(Semester).order_by(Semester.start_date.desc()).all()


@router.get("/active", response_model=SemesterResponse | None)
def get_active_semester(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator", "teacher")),
):
    return db.query(Semester).filter(Semester.is_active.is_(True)).first()


@router.get("/{semester_id}", response_model=SemesterResponse)
def get_semester(
    semester_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator", "teacher")),
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if semester is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SEMESTER_NOT_FOUND,
        )
    return semester


@router.post("/", response_model=SemesterResponse, status_code=status.HTTP_201_CREATED)
def create_semester(
    data: SemesterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    semester_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    if data.is_active:
        db.query(Semester).filter(Semester.is_active.is_(True)).update(
            {"is_active": False}
        )

    semester = Semester(
        id=semester_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
        created_at=now,
    )
    db.add(semester)
    log_audit_event(
        AuditEvents.SEMESTER_CREATED,
        current_user.id,
        semester_id,
        {"name": data.name},
        db,
    )
    db.commit()
    db.refresh(semester)
    logger.info(Logs.SEMESTER_ADDED.format(name=data.name, semester_id=semester_id))
    return semester


@router.put("/{semester_id}", response_model=SemesterResponse)
def update_semester(
    semester_id: str,
    data: SemesterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if semester is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SEMESTER_NOT_FOUND,
        )
    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("is_active") is True:
        db.query(Semester).filter(
            Semester.is_active.is_(True), Semester.id != semester_id
        ).update({"is_active": False})

    for key, value in update_data.items():
        setattr(semester, key, value)

    log_audit_event(
        AuditEvents.SEMESTER_UPDATED,
        current_user.id,
        semester_id,
        {"updated_fields": list(update_data.keys())},
        db,
    )
    db.commit()
    db.refresh(semester)
    logger.info(
        Logs.SEMESTER_EDITED.format(name=semester.name, semester_id=semester_id)
    )
    return semester


@router.delete("/{semester_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_semester(
    semester_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "operator")),
):
    semester = db.query(Semester).filter(Semester.id == semester_id).first()
    if semester is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SEMESTER_NOT_FOUND,
        )
    log_audit_event(
        AuditEvents.SEMESTER_DELETED,
        current_user.id,
        semester_id,
        {"name": semester.name},
        db,
    )
    db.delete(semester)
    db.commit()
