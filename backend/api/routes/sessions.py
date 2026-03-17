import logging
import secrets
import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo

from api.config import settings
from api.redis import redis_client
from api.schemas import (
    CheckInSessionCreate,
    CheckInSessionResponse,
    CheckInSessionUpdate,
    OpenTeacherSessionRequest,
    UserRole,
)
from api.services.session_service import require_role
from api.strings import Logs, Messages
from database import CheckInSession, Class, User, get_db
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


def _parse_schedule_time(value: Any) -> time | None:
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            return None
    return None


def _schedule_days(entry: dict[str, Any]) -> list[str]:
    raw_days = entry.get("days")
    if isinstance(raw_days, list):
        return [day for day in raw_days if isinstance(day, str)]
    return []


def _class_matches_now(class_: Class, now: datetime) -> bool:
    local_now = now.astimezone(ZoneInfo(settings.server_timezone))
    today_name = local_now.strftime("%A")
    now_time = local_now.time()

    for entry in class_.schedule:
        if not isinstance(entry, dict):
            continue

        days = _schedule_days(entry)
        if today_name not in days:
            continue

        start_time = _parse_schedule_time(entry.get("start_time"))
        end_time = _parse_schedule_time(entry.get("end_time"))
        if start_time is None or end_time is None:
            continue

        if start_time <= now_time <= end_time:
            return True

    return False


@router.get("/", response_model=list[CheckInSessionResponse])
def get_all_sessions(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    sessions = db.query(CheckInSession).offset(offset).limit(limit).all()
    return sessions


@router.get("/by-class/{class_id}", response_model=list[CheckInSessionResponse])
def get_sessions_by_class(
    class_id: str,
    order: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    sort_expr = (
        CheckInSession.start_time.desc()
        if order == "desc"
        else CheckInSession.start_time.asc()
    )
    return (
        db.query(CheckInSession)
        .filter(CheckInSession.class_id == class_id)
        .order_by(sort_expr)
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{session_id}", response_model=CheckInSessionResponse)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    session = db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    return session


@router.post("/", response_model=CheckInSessionResponse)
def create_session(
    session_data: CheckInSessionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    class_ = db.query(Class).filter(Class.id == session_data.class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SESSION_CLASS_NOT_FOUND,
        )
    new_session = CheckInSession(
        id=str(uuid.uuid4()),
        class_id=session_data.class_id,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        status=session_data.status,
        dynamic_token=session_data.dynamic_token,
        present_cutoff_minutes=session_data.present_cutoff_minutes,
        late_cutoff_minutes=session_data.late_cutoff_minutes,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    logger.info(Logs.SESSION_ADDED.format(session_id=new_session.id))
    return new_session


@router.post("/open/teacher", response_model=CheckInSessionResponse)
def open_teacher_session(
    open_data: OpenTeacherSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    if current_user.role == "teacher" and current_user.id != open_data.teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    teacher = db.query(User).filter(User.id == open_data.teacher_id).first()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SESSION_TEACHER_NOT_FOUND,
        )
    if teacher.role != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.SESSION_TEACHER_INVALID_ROLE,
        )

    now = datetime.now(timezone.utc)
    if open_data.client_time is not None and open_data.client_time.tzinfo is not None:
        client_offset = open_data.client_time.utcoffset()
        server_offset = now.astimezone(ZoneInfo(settings.server_timezone)).utcoffset()
        if client_offset is not None and server_offset is not None:
            diff_minutes = abs((client_offset - server_offset).total_seconds() / 60)
            if diff_minutes > 30:
                logger.warning(
                    Logs.SESSION_TIMEZONE_MISMATCH.format(
                        teacher_id=open_data.teacher_id,
                        client_offset=client_offset,
                        server_timezone=settings.server_timezone,
                        diff_minutes=diff_minutes,
                    )
                )
    teacher_classes = db.query(Class).filter(Class.teacher_id == teacher.id).all()
    matching_classes = [
        class_ for class_ in teacher_classes if _class_matches_now(class_, now)
    ]

    if len(matching_classes) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SESSION_NO_ACTIVE_SCHEDULE,
        )
    if len(matching_classes) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.SESSION_AMBIGUOUS_ACTIVE_SCHEDULE,
        )

    target_class = matching_classes[0]

    existing_session = (
        db.query(CheckInSession)
        .filter(CheckInSession.class_id == target_class.id)
        .filter(CheckInSession.start_time <= now)
        .filter(CheckInSession.end_time >= now)
        .first()
    )
    if existing_session is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.SESSION_ALREADY_OPEN,
        )

    present_window_minutes = max(0, open_data.present_cutoff_minutes)
    late_window_minutes = max(present_window_minutes, open_data.late_cutoff_minutes)

    new_session = CheckInSession(
        id=str(uuid.uuid4()),
        class_id=target_class.id,
        start_time=now,
        end_time=now + timedelta(minutes=late_window_minutes),
        status="open",
        dynamic_token=secrets.token_urlsafe(32),
        present_cutoff_minutes=present_window_minutes,
        late_cutoff_minutes=late_window_minutes,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    redis_client.set(
        f"ble_token:{new_session.id}", new_session.dynamic_token, ex=30
    )
    logger.info(Logs.SESSION_ADDED.format(session_id=new_session.id))
    return new_session


_BLE_TOKEN_TTL = 30


@router.get("/{session_id}/ble-token")
def get_ble_token(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    session = db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    existing = redis_client.get(f"ble_token:{session_id}")
    if existing:
        return {"ble_token": existing.decode(), "ttl": redis_client.ttl(f"ble_token:{session_id}")}
    new_token = secrets.token_urlsafe(32)
    redis_client.set(f"ble_token:{session_id}", new_token, ex=_BLE_TOKEN_TTL)
    logger.info(Logs.BLE_TOKEN_ROTATED.format(session_id=session_id))
    return {"ble_token": new_token, "ttl": _BLE_TOKEN_TTL}


@router.post("/{session_id}/close", response_model=CheckInSessionResponse)
def close_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    session = db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    if session.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.SESSION_ALREADY_CLOSED,
        )
    session.status = "closed"
    db.commit()
    logger.info(
        Logs.SESSION_CLOSED.format(session_id=session.id, actor_id=current_user.id)
    )
    return session


@router.put("/{session_id}", response_model=CheckInSessionResponse)
def update_session(
    session_id: str,
    updated_data: CheckInSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("teacher", "admin", "operator")),
):
    session = db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    if current_user.role == "teacher":
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None or class_.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
            )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(session, key, value)
    db.commit()
    logger.info(Logs.SESSION_EDITED.format(session_id=session.id))
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "operator")),
):
    session = db.query(CheckInSession).filter(CheckInSession.id == session_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    db.delete(session)
    db.commit()
    return Response(status_code=204)
