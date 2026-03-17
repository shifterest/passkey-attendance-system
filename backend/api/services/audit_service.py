import uuid
from datetime import datetime, timezone

from database import AuditEvent
from sqlalchemy.orm import Session


def log_audit_event(
    event_type: str,
    actor_id: str | None,
    target_id: str | None,
    detail: dict,
    db: Session,
) -> None:
    event = AuditEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        actor_id=actor_id,
        target_id=target_id,
        detail=detail,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.commit()
