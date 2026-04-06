import logging
import uuid
from datetime import datetime, timezone

from api.helpers.membership import get_org_role, is_org_member
from api.schemas import (
    EventAttendeeRuleCreate,
    EventAttendeeRuleResponse,
    EventCreate,
    EventResponse,
    EventUpdate,
    OrgRole,
)
from api.services.session_service import require_role
from api.strings import Messages
from database.connection import get_db
from database.models import Event, EventAttendeeRule, Organization, User
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["events"])


def _require_event_creator(
    db: Session, current_user: User, org_id: str
) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    if current_user.role in ("admin", "operator"):
        return org
    role = get_org_role(db, current_user.id, org_id)
    if role not in (OrgRole.EVENT_CREATOR.value, OrgRole.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    return org


@router.post("/orgs/{org_id}/events", response_model=EventResponse)
def create_event(
    org_id: str,
    event_data: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    _require_event_creator(db, current_user, org_id)
    event = Event(
        id=str(uuid.uuid4()),
        org_id=org_id,
        name=event_data.name,
        description=event_data.description,
        schedule=event_data.schedule,
        standard_assurance_threshold=event_data.standard_assurance_threshold,
        high_assurance_threshold=event_data.high_assurance_threshold,
        play_integrity_enabled=event_data.play_integrity_enabled,
        max_check_ins=event_data.max_check_ins,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/orgs/{org_id}/events", response_model=list[EventResponse])
def list_events(
    org_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ORG_NOT_FOUND
        )
    if current_user.role not in ("admin", "operator"):
        if not is_org_member(db, current_user, org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    return (
        db.query(Event).filter(Event.org_id == org_id).offset(offset).limit(limit).all()
    )


@router.get("/events/{event_id}", response_model=EventResponse)
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    if current_user.role not in ("admin", "operator"):
        if not is_org_member(db, current_user, event.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    return event


@router.put("/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: str,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    _require_event_creator(db, current_user, event.org_id)
    for key, value in event_data.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}")
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    _require_event_creator(db, current_user, event.org_id)
    db.delete(event)
    db.commit()
    return Response(status_code=204)


@router.get("/events/{event_id}/rules", response_model=list[EventAttendeeRuleResponse])
def list_event_rules(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    _require_event_creator(db, current_user, event.org_id)
    return (
        db.query(EventAttendeeRule).filter(EventAttendeeRule.event_id == event_id).all()
    )


@router.post("/events/{event_id}/rules", response_model=EventAttendeeRuleResponse)
def create_event_rule(
    event_id: str,
    data: EventAttendeeRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    _require_event_creator(db, current_user, event.org_id)
    if data.rule_type == "org_member" and data.rule_value:
        org = db.query(Organization).filter(Organization.id == data.rule_value).first()
        if org is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=Messages.ORG_NOT_FOUND,
            )
    rule = EventAttendeeRule(
        id=str(uuid.uuid4()),
        event_id=event_id,
        rule_type=data.rule_type,
        rule_value=data.rule_value,
        rule_group=data.rule_group,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/events/{event_id}/rules/{rule_id}")
def delete_event_rule(
    event_id: str,
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role("admin", "operator", "teacher", "student")
    ),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    _require_event_creator(db, current_user, event.org_id)
    rule = (
        db.query(EventAttendeeRule)
        .filter(
            EventAttendeeRule.id == rule_id,
            EventAttendeeRule.event_id == event_id,
        )
        .first()
    )
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.EVENT_NOT_FOUND
        )
    db.delete(rule)
    db.commit()
    return Response(status_code=204)
