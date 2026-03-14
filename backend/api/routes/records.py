import logging

from api.messages import Logs, Messages
from api.schemas import AttendanceRecordResponse, AttendanceRecordUpdate
from api.services.session_service import require_role
from db.database import AttendanceRecord, CheckInSession, Class, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/records", tags=["records"])


@router.get("/", response_model=list[AttendanceRecordResponse])
def get_all_records(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    records = db.query(AttendanceRecord).all()
    return records


_STATUS_TIER: dict[str, int] = {"present": 0, "late": 1, "absent": 2}


@router.get("/by-session/{session_id}", response_model=list[AttendanceRecordResponse])
def get_records_by_session(
    session_id: str,
    canonical: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher":
        session = (
            db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
        )
        if session is not None:
            class_ = db.query(Class).filter(Class.id == session.class_id).first()
            if class_ is None or class_.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=Messages.AUTH_FORBIDDEN,
                )
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id)
        .all()
    )
    if not canonical:
        return records
    best: dict[str, AttendanceRecord] = {}
    for record in records:
        tier = _STATUS_TIER.get(record.status, 3)
        if record.user_id not in best:
            best[record.user_id] = record
        else:
            current = best[record.user_id]
            current_tier = _STATUS_TIER.get(current.status, 3)
            if tier < current_tier or (
                tier == current_tier
                and record.assurance_score > current.assurance_score
            ):
                best[record.user_id] = record
    return list(best.values())


@router.get("/by-user/{user_id}", response_model=list[AttendanceRecordResponse])
def get_records_by_user(
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
    records = (
        db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id).all()
    )
    return records


@router.get(
    "/by-session/{session_id}/by-user/{user_id}/",
    response_model=list[AttendanceRecordResponse],
)
def get_records_by_session_and_user(
    session_id: str,
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
    if current_user.role == "teacher":
        session = (
            db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
        )
        if session is not None:
            class_ = db.query(Class).filter(Class.id == session.class_id).first()
            if class_ is None or class_.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=Messages.AUTH_FORBIDDEN,
                )
    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.user_id == user_id,
        )
        .all()
    )
    return records


@router.get("/{record_id}", response_model=AttendanceRecordResponse)
def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    return record


@router.post("/")
def create_record():
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Records can only be created via the authentication verify endpoint",
    )
    # session = (
    #     db.query(AttendanceSession)
    #     .filter(AttendanceSession.id == record_data["session_id"])
    #     .first()
    # )
    # user = db.query(User).filter(User.id == record_data["user_id"]).first()
    # if session is None:
    #     return {"message": "Error adding record: session not found"}
    # if user is None:
    #     return {"message": "Error adding record: user not found"}
    # new_uuid = str(uuid.uuid4())
    # while True:
    #     record = (
    #         db.query(AttendanceRecord).filter(AttendanceRecord.id == new_uuid).first()
    #     )
    #     if record is None:
    #         break
    #     new_uuid = str(uuid.uuid4())
    # new_record = AttendanceRecord(
    #     id=new_uuid,
    #     session_id=record_data["session_id"],
    #     user_id=record_data["user_id"],
    #     timestamp=record_data["timestamp"],
    #     verification_methods=record_data["verification_methods"],
    #     status=record_data["status"],
    # )
    # db.add(new_record)
    # db.commit()
    # db.refresh(new_record)
    # logger.info(f"Added record: {new_record.id}")
    # return new_record


@router.put("/{record_id}", response_model=AttendanceRecordResponse)
def update_record(
    record_id: str,
    updated_data: AttendanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    if current_user.role == "teacher":
        session = (
            db.query(CheckInSession)
            .filter(CheckInSession.id == record.session_id)
            .first()
        )
        if session is not None:
            class_ = db.query(Class).filter(Class.id == session.class_id).first()
            if class_ is None or class_.teacher_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=Messages.AUTH_FORBIDDEN,
                )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.commit()
    logger.info(Logs.RECORD_EDITED.format(record_id=record.id))
    return record


@router.delete("/{record_id}")
def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    db.delete(record)
    db.commit()
    return Response(status_code=204)
