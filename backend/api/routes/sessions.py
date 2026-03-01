import logging
import uuid

from api.messages import Logs, Messages
from api.schemas import (
    AttendanceSessionCreate,
    AttendanceSessionResponse,
    AttendanceSessionUpdate,
)
from db.database import AttendanceSession, Class, get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/", response_model=list[AttendanceSessionResponse])
def get_all_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AttendanceSession).all()
    return sessions


@router.get("/by-class/{class_id}", response_model=list[AttendanceSessionResponse])
def get_sessions_by_class(class_id: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(AttendanceSession).filter(AttendanceSession.class_id == class_id).all()
    )
    return sessions


@router.get("/{session_id}", response_model=AttendanceSessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    return session


@router.post("/", response_model=AttendanceSessionResponse)
def create_session(
    session_data: AttendanceSessionCreate, db: Session = Depends(get_db)
):
    class_ = db.query(Class).filter(Class.id == session_data.class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SESSION_CLASS_NOT_FOUND,
        )
    new_uuid = str(uuid.uuid4())
    while True:
        session = (
            db.query(AttendanceSession).filter(AttendanceSession.id == new_uuid).first()
        )
        if session is None:
            break
        new_uuid = str(uuid.uuid4())
    new_session = AttendanceSession(
        id=new_uuid,
        class_id=session_data.class_id,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        status=session_data.status,
        dynamic_token=session_data.dynamic_token,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    logger.info(Logs.SESSION_ADDED.format(session_id=new_session.id))
    return new_session


@router.put("/{session_id}", response_model=AttendanceSessionResponse)
def update_session(
    session_id: str,
    updated_data: AttendanceSessionUpdate,
    db: Session = Depends(get_db),
):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(session, key, value)
    db.commit()
    logger.info(Logs.SESSION_EDITED.format(session_id=session.id))
    return session


@router.delete("/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    db.delete(session)
    db.commit()
    return Response(status_code=204)
