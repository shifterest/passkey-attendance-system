from datetime import datetime, time, timezone

from db.database import AttendanceRecord, ClassEnrollment, Credential
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
    registered = (
        db.query(Credential).filter(Credential.user_id == user_id).first() is not None
    )

    enrollments = len(classes)
    records = len(attendance_records)
    now = datetime.now(timezone.utc)
    today_name = now.strftime("%A")
    now_time = now.time()
    entry_start = None
    entry_end = None

    for class_enrollment in classes:
        class_ = class_enrollment.enrolled_class

        for entry in class_.schedule:
            entry_day = entry["day"]
            entry_start = entry["start_time"]
            entry_end = entry["end_time"]
            if entry_day != today_name:
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
        "registered": registered,
    }
