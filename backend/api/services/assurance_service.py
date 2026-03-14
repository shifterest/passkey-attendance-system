from datetime import datetime, timedelta

from api.schemas import AttendanceRecordStatus, AttendanceRecordVerificationMethods
from db.database import CheckInSession


def _bluetooth_score_from_method(method: str) -> int:
    bluetooth_prefix = f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:"
    if not method.startswith(bluetooth_prefix):
        return 0

    suffix = method.split(":", 1)[1].strip()

    try:
        rssi = int(suffix)
    except ValueError:
        return 0

    if rssi > -65:
        return 7
    if rssi >= -80:
        return 4
    if rssi >= -90:
        return 2

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
        if method == AttendanceRecordVerificationMethods.DEVICE.value:
            score += 9
        elif method == AttendanceRecordVerificationMethods.PASSKEY.value:
            score += 8
        elif method == AttendanceRecordVerificationMethods.PLAY_INTEGRITY.value:
            score += 7
        elif method == AttendanceRecordVerificationMethods.GPS.value:
            score += 3
        elif method.startswith(
            f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:"
        ):
            score += _bluetooth_score_from_method(method)

    return score
