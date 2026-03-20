import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from api.helpers.assurance import (
    compute_assurance_band,
    resolve_attendance_status,
)
from api.schemas import (
    ApprovalStateDetail,
    AssuranceEvaluateRequest,
    AssuranceEvaluateRowResponse,
    AttendanceRecordResponse,
    AttendanceRecordUpdate,
    AttendanceRecordVerificationMethods,
    ManualApprovalDetail,
    ManualApprovalRequest,
    ManualAttendanceDetail,
    ManualAttendanceRequest,
)
from api.services.audit_service import log_audit_event
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import (
    AttendanceRecord,
    CheckInSession,
    Class,
    ClassEnrollment,
    ClassPolicy,
    User,
)
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/records", tags=["records"])


@router.get("/", response_model=list[AttendanceRecordResponse])
def get_all_records(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    records = db.query(AttendanceRecord).offset(offset).limit(limit).all()
    return records


_STATUS_TIER: dict[str, int] = {"present": 0, "late": 1, "absent": 2}


@router.get("/by-session/{session_id}", response_model=list[AttendanceRecordResponse])
def get_records_by_session(
    session_id: str,
    canonical: bool = Query(default=False),
    sort_by: Literal["timestamp", "assurance_score"] = Query(default="timestamp"),
    order: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
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
    sort_col = (
        AttendanceRecord.timestamp
        if sort_by == "timestamp"
        else AttendanceRecord.assurance_score
    )
    sort_expr = sort_col.desc() if order == "desc" else sort_col.asc()
    if canonical:
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == session_id)
            .all()
        )
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
        result = list(best.values())
        key_fn = (
            (lambda r: r.timestamp)
            if sort_by == "timestamp"
            else (lambda r: r.assurance_score)
        )
        result.sort(key=key_fn, reverse=(order == "desc"))
        return result[offset : offset + limit]
    return (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id)
        .order_by(sort_expr)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/by-user/{user_id}", response_model=list[AttendanceRecordResponse])
def get_records_by_user(
    user_id: str,
    sort_by: Literal["timestamp", "assurance_score"] = Query(default="timestamp"),
    order: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("student", "teacher", "admin", "operator")
    ),
):
    if current_user.role == "student" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    sort_col = (
        AttendanceRecord.timestamp
        if sort_by == "timestamp"
        else AttendanceRecord.assurance_score
    )
    sort_expr = sort_col.desc() if order == "desc" else sort_col.asc()
    return (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.user_id == user_id)
        .order_by(sort_expr)
        .offset(offset)
        .limit(limit)
        .all()
    )


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
    current_user: User = Depends(
        require_role("student", "teacher", "admin", "operator")
    ),
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    if current_user.role == "student" and current_user.id != record.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    if current_user.role == "teacher":
        session = (
            db.query(CheckInSession)
            .filter(CheckInSession.id == record.session_id)
            .first()
        )
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
            )
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    return record


@router.post("/{record_id}/approve", response_model=AttendanceRecordResponse)
def approve_record(
    record_id: str,
    body: ManualApprovalRequest,
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
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.RECORD_NOT_FOUND,
            )
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    was_manually_approved = bool(record.manually_approved)
    record.manually_approved = True
    record.manually_approved_by = current_user.id
    record.manually_approved_reason = body.reason
    db.commit()
    log_audit_event(
        event_type=AuditEvents.MANUAL_APPROVAL,
        actor_id=current_user.id,
        target_id=record.id,
        detail=ManualApprovalDetail(
            reason=body.reason,
            record_user_id=record.user_id,
            old_value=ApprovalStateDetail(manually_approved=was_manually_approved),
            new_value=ApprovalStateDetail(manually_approved=True),
        ).model_dump(),
        db=db,
    )
    logger.info(
        Logs.RECORD_APPROVED.format(record_id=record.id, user_id=current_user.id)
    )
    return record


@router.post("/manual", response_model=AttendanceRecordResponse)
def create_manual_record(
    body: ManualAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    session = (
        db.query(CheckInSession).filter(CheckInSession.id == body.session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    student = db.query(User).filter(User.id == body.student_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    enrollment = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.class_id == session.class_id,
            ClassEnrollment.student_id == body.student_id,
        )
        .first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=Messages.STUDENT_NOT_ENROLLED,
        )
    timestamp = body.backdated_timestamp or datetime.now(timezone.utc)
    attendance_status = (
        body.status
        if body.status is not None
        else resolve_attendance_status(attempted_at=timestamp, session=session).value
    )
    effective_policy = (
        db.query(ClassPolicy)
        .filter(
            ClassPolicy.created_by == session.attended_class.teacher_id,
            ClassPolicy.class_id == session.class_id,
        )
        .first()
        or db.query(ClassPolicy)
        .filter(
            ClassPolicy.created_by == session.attended_class.teacher_id,
            ClassPolicy.class_id.is_(None),
        )
        .first()
    )
    effective_standard = (
        effective_policy.standard_assurance_threshold
        if effective_policy
        else session.attended_class.standard_assurance_threshold
    )
    effective_high = (
        effective_policy.high_assurance_threshold
        if effective_policy
        else session.attended_class.high_assurance_threshold
    )
    new_record = AttendanceRecord(
        id=str(uuid.uuid4()),
        session_id=body.session_id,
        user_id=body.student_id,
        timestamp=timestamp,
        is_flagged=True,
        flag_reason=body.reason,
        verification_methods=[AttendanceRecordVerificationMethods.MANUAL.value],
        assurance_score=0,
        assurance_band_recorded=compute_assurance_band(
            0, effective_standard, effective_high
        ),
        standard_threshold_recorded=effective_standard,
        high_threshold_recorded=effective_high,
        status=attendance_status,
        sync_pending=False,
        network_anomaly=False,
        gps_is_mock=False,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    log_audit_event(
        AuditEvents.MANUAL_ATTENDANCE,
        current_user.id,
        new_record.id,
        ManualAttendanceDetail(
            student_id=body.student_id,
            session_id=body.session_id,
            reason=body.reason,
            backdated_timestamp=body.backdated_timestamp.isoformat()
            if body.backdated_timestamp
            else None,
            status=attendance_status,
        ).model_dump(exclude_none=True),
        db,
    )
    logger.info(
        Logs.MANUAL_RECORD_CREATED.format(
            record_id=new_record.id,
            user_id=body.student_id,
            performed_by_user_id=current_user.id,
        )
    )
    return new_record


@router.post("/assurance/evaluate", response_model=list[AssuranceEvaluateRowResponse])
def evaluate_assurance(
    body: AssuranceEvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if body.record_ids is None and body.session_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=Messages.RECORD_NOT_FOUND,
        )

    if body.record_ids is not None:
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.id.in_(body.record_ids))
            .all()
        )
    elif body.canonical:
        all_records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == body.session_id)
            .all()
        )
        best: dict[str, AttendanceRecord] = {}
        for rec in all_records:
            tier = _STATUS_TIER.get(rec.status, 3)
            if rec.user_id not in best:
                best[rec.user_id] = rec
            else:
                existing = best[rec.user_id]
                existing_tier = _STATUS_TIER.get(existing.status, 3)
                if tier < existing_tier or (
                    tier == existing_tier
                    and rec.assurance_score > existing.assurance_score
                ):
                    best[rec.user_id] = rec
        records = list(best.values())
    else:
        records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == body.session_id)
            .all()
        )

    threshold_cache: dict[str, tuple[int, int]] = {}
    results = []

    for record in records:
        if record.session_id not in threshold_cache:
            session_obj = (
                db.query(CheckInSession)
                .filter(CheckInSession.id == record.session_id)
                .first()
            )
            if session_obj is None:
                threshold_cache[record.session_id] = (5, 9)
            else:
                class_obj = (
                    db.query(Class).filter(Class.id == session_obj.class_id).first()
                )
                if class_obj is None:
                    threshold_cache[record.session_id] = (5, 9)
                else:
                    if (
                        current_user.role == "teacher"
                        and class_obj.teacher_id != current_user.id
                    ):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=Messages.AUTH_FORBIDDEN,
                        )
                    policy = (
                        db.query(ClassPolicy)
                        .filter(
                            ClassPolicy.created_by == class_obj.teacher_id,
                            ClassPolicy.class_id == class_obj.id,
                        )
                        .first()
                        or db.query(ClassPolicy)
                        .filter(
                            ClassPolicy.created_by == class_obj.teacher_id,
                            ClassPolicy.class_id.is_(None),
                        )
                        .first()
                    )
                    std = (
                        policy.standard_assurance_threshold
                        if policy
                        else class_obj.standard_assurance_threshold
                    )
                    hi = (
                        policy.high_assurance_threshold
                        if policy
                        else class_obj.high_assurance_threshold
                    )
                    threshold_cache[record.session_id] = (std, hi)

        std_current, hi_current = threshold_cache[record.session_id]
        if body.standard_threshold is not None:
            std_current = body.standard_threshold
        if body.high_threshold is not None:
            hi_current = body.high_threshold

        band_current = compute_assurance_band(
            record.assurance_score, std_current, hi_current
        )
        drift = (
            record.assurance_band_recorded is not None
            and record.assurance_band_recorded != band_current
        )

        results.append(
            AssuranceEvaluateRowResponse(
                record_id=record.id,
                user_id=record.user_id,
                assurance_score=record.assurance_score,
                assurance_band_recorded=record.assurance_band_recorded,
                standard_threshold_recorded=record.standard_threshold_recorded,
                high_threshold_recorded=record.high_threshold_recorded,
                assurance_band_current=band_current,
                standard_threshold_current=std_current,
                high_threshold_current=hi_current,
                policy_drift=drift,
            )
        )

    return results


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
    return Response(status_code=status.HTTP_204_NO_CONTENT)
