from __future__ import annotations

from datetime import datetime, time, timezone
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from api.config import settings

if TYPE_CHECKING:
    from database.models import Class


def _parse_schedule_time(value: Any) -> time | None:
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError:
            return None
    return None


def _get_schedule_days(entry: dict[str, Any]) -> list[str]:
    raw_days = entry.get("days")
    if isinstance(raw_days, list):
        return [day for day in raw_days if isinstance(day, str)]
    return []


def is_class_active(class_: Class, now: datetime) -> bool:
    local_now = now.astimezone(ZoneInfo(settings.server_timezone))
    today_name = local_now.strftime("%A")
    now_time = local_now.time()

    for entry in class_.schedule:
        if not isinstance(entry, dict):
            continue

        days = _get_schedule_days(entry)
        if today_name not in days:
            continue

        start_time = _parse_schedule_time(entry.get("start_time"))
        end_time = _parse_schedule_time(entry.get("end_time"))
        if start_time is None or end_time is None:
            continue

        if start_time <= now_time <= end_time:
            return True

    return False


def get_schedule_block_end(class_: Class, now: datetime) -> datetime | None:
    local_now = now.astimezone(ZoneInfo(settings.server_timezone))
    today_name = local_now.strftime("%A")
    now_time = local_now.time()
    local_date = local_now.date()

    for entry in class_.schedule:
        if not isinstance(entry, dict):
            continue

        days = _get_schedule_days(entry)
        if today_name not in days:
            continue

        start_time = _parse_schedule_time(entry.get("start_time"))
        end_time = _parse_schedule_time(entry.get("end_time"))
        if start_time is None or end_time is None:
            continue

        if start_time <= now_time <= end_time:
            end_dt_local = datetime.combine(
                local_date, end_time, tzinfo=ZoneInfo(settings.server_timezone)
            )
            return end_dt_local.astimezone(timezone.utc)

    return None
