import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Literal

from database.models import Class, ClassEnrollment, Organization, User
from sqlalchemy.orm import Session

ImportFormat = Literal["generic", "banner"]


def _parse_generic(reader: csv.DictReader) -> list[dict]:
    rows = []
    for row in reader:
        year_raw = row.get("year_level", "").strip()
        rows.append(
            {
                "full_name": row.get("full_name", "").strip(),
                "email": row.get("email", "").strip(),
                "school_id": row.get("school_id", "").strip() or None,
                "role": row.get("role", "student").strip().lower(),
                "program": row.get("program", "").strip() or None,
                "year_level": int(year_raw) if year_raw.isdigit() else None,
            }
        )
    return rows


def _parse_banner(reader: csv.DictReader) -> list[dict]:
    rows = []
    for row in reader:
        first = row.get("FIRST_NAME", "").strip()
        last = row.get("LAST_NAME", "").strip()
        full_name = f"{first} {last}".strip()
        rows.append(
            {
                "full_name": full_name,
                "email": row.get("EMAIL_ADDRESS", "").strip(),
                "school_id": row.get("ID", "").strip() or None,
                "role": "student",
            }
        )
    return rows


_PARSERS = {
    "generic": _parse_generic,
    "banner": _parse_banner,
}

_VALID_ROLES = {"student", "teacher", "admin", "operator"}


def process_import(
    content: bytes,
    format: ImportFormat,
    dry_run: bool,
    db: Session,
) -> dict:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    parser = _PARSERS.get(format)
    if parser is None:
        return {
            "error": f"Unknown format: {format}",
            "created": 0,
            "skipped": 0,
            "errors": [],
        }

    try:
        rows = parser(reader)
    except Exception as e:
        return {"error": str(e), "created": 0, "skipped": 0, "errors": []}

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(rows, start=2):
        full_name = row.get("full_name", "")
        email = row.get("email", "")
        school_id = row.get("school_id")
        role = row.get("role", "student")

        if not full_name or not email:
            errors.append(
                {"row": i, "reason": "missing full_name or email", "data": row}
            )
            continue
        if role not in _VALID_ROLES:
            errors.append({"row": i, "reason": f"invalid role: {role}", "data": row})
            continue
        if role in ("student", "teacher") and not school_id:
            errors.append(
                {
                    "row": i,
                    "reason": "school_id is required for students and teachers",
                    "data": row,
                }
            )
            continue

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            skipped += 1
            continue

        if not dry_run:
            new_user = User(
                id=str(uuid.uuid4()),
                role=role,
                full_name=full_name,
                email=email,
                school_id=school_id,
                program=row.get("program"),
                year_level=row.get("year_level"),
            )
            db.add(new_user)
        created += 1

    if not dry_run and created > 0:
        db.commit()

    return {
        "dry_run": dry_run,
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


def process_class_import(
    content: bytes,
    dry_run: bool,
    db: Session,
) -> dict:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(reader, start=2):
        course_code = row.get("course_code", "").strip()
        course_name = row.get("course_name", "").strip()
        teacher_email = row.get("teacher_email", "").strip()

        if not course_code or not course_name:
            errors.append(
                {
                    "row": i,
                    "reason": "missing course_code or course_name",
                    "data": dict(row),
                }
            )
            continue

        existing = db.query(Class).filter(Class.course_code == course_code).first()
        if existing:
            skipped += 1
            continue

        teacher = None
        if teacher_email:
            teacher = (
                db.query(User)
                .filter(User.email == teacher_email, User.role == "teacher")
                .first()
            )
            if teacher is None:
                errors.append(
                    {
                        "row": i,
                        "reason": f"teacher not found: {teacher_email}",
                        "data": dict(row),
                    }
                )
                continue

        if not dry_run:
            new_class = Class(
                id=str(uuid.uuid4()),
                course_code=course_code,
                course_name=course_name,
                teacher_id=teacher.id if teacher else None,
                schedule=[],
            )
            db.add(new_class)
        created += 1

    if not dry_run and created > 0:
        db.commit()

    return {
        "dry_run": dry_run,
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


def process_enrollment_import(
    content: bytes,
    dry_run: bool,
    db: Session,
) -> dict:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(reader, start=2):
        school_id = row.get("school_id", "").strip()
        course_code = row.get("course_code", "").strip()

        if not school_id or not course_code:
            errors.append(
                {
                    "row": i,
                    "reason": "missing school_id or course_code",
                    "data": dict(row),
                }
            )
            continue

        student = (
            db.query(User)
            .filter(User.school_id == school_id, User.role == "student")
            .first()
        )
        if student is None:
            errors.append(
                {
                    "row": i,
                    "reason": f"student not found: {school_id}",
                    "data": dict(row),
                }
            )
            continue

        cls = db.query(Class).filter(Class.course_code == course_code).first()
        if cls is None:
            errors.append(
                {
                    "row": i,
                    "reason": f"class not found: {course_code}",
                    "data": dict(row),
                }
            )
            continue

        existing = (
            db.query(ClassEnrollment)
            .filter(
                ClassEnrollment.class_id == cls.id,
                ClassEnrollment.student_id == student.id,
            )
            .first()
        )
        if existing:
            skipped += 1
            continue

        if not dry_run:
            enrollment = ClassEnrollment(
                id=str(uuid.uuid4()),
                class_id=cls.id,
                student_id=student.id,
            )
            db.add(enrollment)
        created += 1

    if not dry_run and created > 0:
        db.commit()

    return {
        "dry_run": dry_run,
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


def process_org_import(
    content: bytes,
    dry_run: bool,
    db: Session,
) -> dict:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors: list[dict] = []

    for i, row in enumerate(reader, start=2):
        name = row.get("name", "").strip()

        if not name:
            errors.append({"row": i, "reason": "missing name", "data": dict(row)})
            continue

        existing = db.query(Organization).filter(Organization.name == name).first()
        if existing:
            skipped += 1
            continue

        if not dry_run:
            org = Organization(
                id=str(uuid.uuid4()),
                name=name,
                description=row.get("description", "").strip() or None,
                created_at=datetime.now(timezone.utc),
            )
            db.add(org)
        created += 1

    if not dry_run and created > 0:
        db.commit()

    return {
        "dry_run": dry_run,
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }
