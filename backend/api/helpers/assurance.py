from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from api.schemas import AttendanceRecordStatus, AttendanceRecordVerificationMethods

if TYPE_CHECKING:
    from database.models import CheckInSession


def is_within_geofence(
    lat: float,
    lng: float,
    school_lat: float,
    school_lng: float,
    radius_m: float,
) -> bool:
    R = 6_371_000.0
    phi1 = math.radians(lat)
    phi2 = math.radians(school_lat)
    d_phi = math.radians(school_lat - lat)
    d_lambda = math.radians(school_lng - lng)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    distance_m = 2 * R * math.asin(math.sqrt(a))
    return distance_m <= radius_m


def _bluetooth_score(method: str, integrity_vouched: bool) -> int:
    bluetooth_prefix = f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:"
    if not method.startswith(bluetooth_prefix):
        return 0

    suffix = method.split(":", 1)[1].strip()

    try:
        rssi = int(suffix)
    except ValueError:
        return 0

    if rssi > -65:
        return 7 if integrity_vouched else 4
    elif rssi >= -80:
        return 4 if integrity_vouched else 2
    elif rssi >= -90:
        return 2 if integrity_vouched else 1
    else:
        return 0


def resolve_attendance_status(
    attempted_at: datetime,
    session: CheckInSession,
) -> AttendanceRecordStatus:
    present_window_minutes = max(0, session.present_cutoff_minutes)
    late_window_minutes = max(present_window_minutes, session.late_cutoff_minutes)

    present_cutoff = session.start_time + timedelta(minutes=present_window_minutes)
    late_cutoff = session.start_time + timedelta(minutes=late_window_minutes)
    session_close = min(session.end_time, late_cutoff)
    effective_present_cutoff = min(present_cutoff, session_close)

    if attempted_at <= effective_present_cutoff:
        return AttendanceRecordStatus.PRESENT
    if attempted_at <= session_close:
        return AttendanceRecordStatus.LATE
    return AttendanceRecordStatus.ABSENT


def assurance_score_from_verification_methods(
    verification_methods: list[str] | None,
    *,
    integrity_vouched: bool = True,
) -> int:
    score = 0
    if not verification_methods:
        return score

    normalized_methods = {
        method.strip().lower()
        for method in verification_methods
        if isinstance(method, str) and method.strip()
    }

    for method in normalized_methods:
        if method == AttendanceRecordVerificationMethods.GPS.value:
            score += 3 if integrity_vouched else 1
        elif method == AttendanceRecordVerificationMethods.QR_PROXIMITY.value:
            score += 4
        elif method == AttendanceRecordVerificationMethods.NETWORK.value:
            score += 2
        elif method.startswith(
            f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:"
        ):
            score += _bluetooth_score(method, integrity_vouched)

    return score


def compute_assurance_band(
    score: int,
    standard_threshold: int,
    high_threshold: int,
) -> str:
    if score >= high_threshold:
        return "high"
    if score >= standard_threshold:
        return "standard"
    return "low"
