import csv
import io
from datetime import datetime

from api.schemas import AuditEventResponse
from api.services.session_service import require_role
from api.strings import Messages
from database import AuditEvent, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/export")
def export_audit_events(
    event_type: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    if start_at is not None and end_at is not None and end_at < start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.AUDIT_INVALID_TIME_RANGE,
        )

    query = db.query(AuditEvent)
    if event_type is not None:
        query = query.filter(AuditEvent.event_type == event_type)
    if actor_id is not None:
        query = query.filter(AuditEvent.actor_id == actor_id)
    if target_id is not None:
        query = query.filter(AuditEvent.target_id == target_id)
    if start_at is not None:
        query = query.filter(AuditEvent.created_at >= start_at)
    if end_at is not None:
        query = query.filter(AuditEvent.created_at <= end_at)

    events = query.order_by(AuditEvent.created_at.desc()).all()

    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "event_type", "actor_id", "target_id", "detail", "created_at"])
        yield buf.getvalue()
        for event in events:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                event.id,
                event.event_type,
                event.actor_id or "",
                event.target_id or "",
                str(event.detail),
                event.created_at.isoformat(),
            ])
            yield buf.getvalue()

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_export.csv"},
    )


@router.get("/", response_model=list[AuditEventResponse])
def get_all_audit_events(
    event_type: str | None = Query(default=None),
    actor_id: str | None = Query(default=None),
    target_id: str | None = Query(default=None),
    start_at: datetime | None = Query(default=None),
    end_at: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    if start_at is not None and end_at is not None and end_at < start_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.AUDIT_INVALID_TIME_RANGE,
        )

    query = db.query(AuditEvent)
    if event_type is not None:
        query = query.filter(AuditEvent.event_type == event_type)
    if actor_id is not None:
        query = query.filter(AuditEvent.actor_id == actor_id)
    if target_id is not None:
        query = query.filter(AuditEvent.target_id == target_id)
    if start_at is not None:
        query = query.filter(AuditEvent.created_at >= start_at)
    if end_at is not None:
        query = query.filter(AuditEvent.created_at <= end_at)

    return (
        query.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit).all()
    )


@router.get("/{event_id}", response_model=AuditEventResponse)
def get_audit_event(
    event_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    event = db.query(AuditEvent).filter(AuditEvent.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUDIT_EVENT_NOT_FOUND,
        )
    return event
