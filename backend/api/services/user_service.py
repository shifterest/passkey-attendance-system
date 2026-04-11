from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from api.config import settings
from database.models import (
    AttendanceRecord,
    CheckInSession,
    Class,
    ClassEnrollment,
    ClassPolicy,
    Credential,
)
from sqlalchemy.orm import Session


def get_student_details(user_id: str, db: Session):
    ongoing_class = None
    in_class = False

    classes = (
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == user_id).all()
    )
    attendance_records = (
        db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id).all()
    )
    flagged = sum(1 for r in attendance_records if r.is_flagged)
    low_assurance = sum(
        1 for r in attendance_records if r.assurance_band_recorded == "low"
    )
    registered = (
        db.query(Credential).filter(Credential.user_id == user_id).first() is not None
    )

    enrollments = len(classes)
    records = len(attendance_records)
    now = datetime.now(timezone.utc)
    local_now = now.astimezone(ZoneInfo(settings.server_timezone))
    today_name = local_now.strftime("%A")
    now_time = local_now.time()
    entry_start = None
    entry_end = None

    for class_enrollment in classes:
        class_ = class_enrollment.enrolled_class

        for entry in class_.schedule:
            days = entry.get("days")
            if not isinstance(days, list) or today_name not in days:
                continue

            entry_start = entry.get("start_time")
            entry_end = entry.get("end_time")
            if entry_start is None or entry_end is None:
                continue

            if isinstance(entry_start, str):
                entry_start = time.fromisoformat(entry_start)
            if isinstance(entry_end, str):
                entry_end = time.fromisoformat(entry_end)

            if entry_start <= now_time <= entry_end:
                ongoing_class = class_.course_name
                break

        if ongoing_class is not None:
            break

    if ongoing_class is not None:
        for record in attendance_records:
            record_time = record.timestamp.time()
            if (
                entry_start is not None
                and entry_end is not None
                and record.timestamp.date() == now.date()
                and entry_start <= record_time <= entry_end
            ):
                in_class = True
                break

    return {
        "ongoing_class": ongoing_class,
        "enrollments": enrollments,
        "in_class": in_class,
        "records": records,
        "flagged": flagged,
        "low_assurance": low_assurance,
        "registered": registered,
    }


def get_teacher_details(user_id: str, db: Session):
    classes = db.query(Class).filter(Class.teacher_id == user_id).all()
    class_ids = [c.id for c in classes]

    student_ids = {
        row[0]
        for row in db.query(ClassEnrollment.student_id)
        .filter(ClassEnrollment.class_id.in_(class_ids))
        .all()
    }

    now = datetime.now(timezone.utc)
    active_session = (
        db.query(CheckInSession)
        .filter(CheckInSession.class_id.in_(class_ids))
        .filter(CheckInSession.start_time <= now)
        .filter(CheckInSession.end_time >= now)
        .first()
    )
    class_by_id = {c.id: c for c in classes}
    active_session_class = None
    if active_session:
        active_cls = class_by_id.get(active_session.class_id)
        if active_cls:
            active_session_class = active_cls.course_code

    default_policy = (
        db.query(ClassPolicy)
        .filter(ClassPolicy.created_by == user_id, ClassPolicy.class_id.is_(None))
        .first()
    )

    return {
        "class_count": len(classes),
        "student_count": len(student_ids),
        "has_open_session": active_session is not None,
        "active_session_class": active_session_class,
        "registered": db.query(Credential).filter(Credential.user_id == user_id).first()
        is not None,
        "default_policy": default_policy,
    }
