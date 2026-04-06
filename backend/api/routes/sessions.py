import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from api.config import settings
from api.helpers.schedule import (
    get_schedule_block_end,
    is_class_active,
)
from api.helpers.tokens import new_ble_token, new_nfc_token
from api.redis import redis_client
from api.schemas import (
    CheckInSessionResponse,
    CheckInSessionUpdate,
    OpenTeacherSessionRequest,
    UserRole,
)
from api.services.session_service import require_role
from api.strings import Logs, Messages
from database.connection import get_db
from database.models import CheckInSession, Class, ClassPolicy, User
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


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
        class_ for class_ in teacher_classes if is_class_active(class_, now)
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

    class_policy = db.query(ClassPolicy).filter(ClassPolicy.class_id == target_class.id).first()
    if class_policy is None:
        class_policy = db.query(ClassPolicy).filter(
            ClassPolicy.class_id.is_(None),
            ClassPolicy.created_by == teacher.id,
        ).first()
    present_cutoff = class_policy.present_cutoff_minutes if class_policy is not None else 5
    late_cutoff = class_policy.late_cutoff_minutes if class_policy is not None else 15

    existing_session = (
        db.query(CheckInSession)
        .filter(CheckInSession.class_id == target_class.id)
        .filter(CheckInSession.start_time <= now)
        .filter(CheckInSession.end_time >= now)
        .filter(CheckInSession.status != "closed")
        .first()
    )
    if existing_session is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.SESSION_ALREADY_OPEN,
        )

    present_window_minutes = max(0, present_cutoff)
    late_window_minutes = max(present_window_minutes, late_cutoff)

    session_end = now + timedelta(minutes=late_window_minutes)
    schedule_block_end = get_schedule_block_end(target_class, now)
    if schedule_block_end is not None and schedule_block_end < session_end:
        session_end = schedule_block_end

    new_session = CheckInSession(
        id=str(uuid.uuid4()),
        class_id=target_class.id,
        start_time=now,
        end_time=session_end,
        status="open",
        present_cutoff_minutes=present_window_minutes,
        late_cutoff_minutes=late_window_minutes,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    redis_client.set(
        f"ble_token:{new_session.id}",
        new_ble_token(),
        ex=settings.ble_token_ttl_seconds,
    )
    session_duration_seconds = max(
        int((session_end - now).total_seconds()), 1
    )
    redis_client.set(
        f"nfc_token:{new_session.id}",
        new_nfc_token(),
        ex=session_duration_seconds,
    )
    logger.info(Logs.SESSION_ADDED.format(session_id=new_session.id))
    return new_session


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
    ble_rate_key = f"ble_token_poll:{session_id}:{current_user.id}"
    ble_poll_count = redis_client.incr(ble_rate_key)
    if ble_poll_count == 1:
        redis_client.expire(ble_rate_key, 60)
    if ble_poll_count > 120:
        ttl = int(redis_client.ttl(ble_rate_key))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=Messages.BLE_TOKEN_RATE_LIMITED,
            headers={"Retry-After": str(max(ttl, 1))},
        )
    existing = redis_client.get(f"ble_token:{session_id}")
    if existing:
        return {
            "ble_token": existing.decode(),
            "ttl": redis_client.ttl(f"ble_token:{session_id}"),
        }
    new_token = new_ble_token()
    redis_client.set(
        f"ble_token:{session_id}",
        new_token,
        ex=settings.ble_token_ttl_seconds,
    )
    logger.info(Logs.BLE_TOKEN_ROTATED.format(session_id=session_id))
    return {"ble_token": new_token, "ttl": settings.ble_token_ttl_seconds}


@router.get("/{session_id}/nfc-token")
def get_nfc_token(
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
    existing = redis_client.get(f"nfc_token:{session_id}")
    if existing:
        return {"nfc_token": existing.decode()}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
    )


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
        Logs.SESSION_CLOSED.format(session_id=session.id, user_id=current_user.id)
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
