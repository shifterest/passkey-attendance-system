import csv
import io
import uuid
from typing import Literal

from database import User
from sqlalchemy.orm import Session

ImportFormat = Literal["generic", "banner"]


def _parse_generic(reader: csv.DictReader) -> list[dict]:
    rows = []
    for row in reader:
        rows.append(
            {
                "full_name": row.get("full_name", "").strip(),
                "email": row.get("email", "").strip(),
                "school_id": row.get("school_id", "").strip() or None,
                "role": row.get("role", "student").strip().lower(),
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
        return {"error": f"Unknown format: {format}", "created": 0, "skipped": 0, "errors": []}

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
            errors.append({"row": i, "reason": "missing full_name or email", "data": row})
            continue
        if role not in _VALID_ROLES:
            errors.append({"row": i, "reason": f"invalid role: {role}", "data": row})
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
