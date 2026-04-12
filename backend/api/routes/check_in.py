import hashlib
import ipaddress
import logging
import secrets
import uuid
from datetime import datetime, timezone

from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.helpers.assurance import (
    assurance_score_from_verification_methods,
    compute_assurance_band,
    is_within_geofence,
    resolve_attendance_status,
)
from api.helpers.device_payload import build_device_payload
from api.helpers.membership import is_event_attendee
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordResponse,
    AttendanceRecordVerificationMethods,
    CheckInOptionsBase,
    CheckInResponseBase,
    DeviceKeyMismatchDetail,
    DeviceSignatureFailureDetail,
)
from api.services.attestation_service import fetch_crl_status_by_serial
from api.services.audit_service import log_audit_event
from api.services.auth_service import (
    check_auth_rate_limit,
    issued_at_ms_now,
    load_issued_at_ms,
    verify_device_signature,
)
from api.services.integrity_service import has_valid_vouch
from api.services.session_service import require_client_type, require_role
from api.strings import AuditEvents, Logs, Messages
from database.connection import get_db
from database.models import (
    AttendanceRecord,
    CheckInSession,
    Class,
    ClassEnrollment,
    ClassPolicy,
    Credential,
    Event,
    User,
)
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/check-in", tags=["auth"])


@router.post("/initiate")
def check_in_initiate(
    options_data: CheckInOptionsBase,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
    _client_type: str = Depends(require_client_type("app")),
):
    if current_user.id != options_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    check_auth_rate_limit(options_data.user_id)
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    now = datetime.now(timezone.utc)
    enrolled_class_ids = [
        row[0]
        for row in db.query(ClassEnrollment.class_id)
        .filter(ClassEnrollment.student_id == user.id)
        .filter(
            (ClassEnrollment.expires_at.is_(None)) | (ClassEnrollment.expires_at > now)
        )
        .all()
    ]

    session = None
    if enrolled_class_ids:
        session = (
            db.query(CheckInSession)
            .filter(CheckInSession.class_id.in_(enrolled_class_ids))
            .filter(CheckInSession.start_time <= now)
            .filter(CheckInSession.end_time >= now)
            .filter(CheckInSession.status != "closed")
            .order_by(CheckInSession.start_time.desc())
            .first()
        )

    if session is None:
        event_session = (
            db.query(CheckInSession)
            .filter(CheckInSession.event_id.isnot(None))
            .filter(CheckInSession.start_time <= now)
            .filter(CheckInSession.end_time >= now)
            .filter(CheckInSession.status != "closed")
            .order_by(CheckInSession.start_time.desc())
            .first()
        )
        if event_session is not None:
            event = db.query(Event).filter(Event.id == event_session.event_id).first()
            if event is not None:
                eligible, reason = is_event_attendee(db, user, event)
                if eligible:
                    session = event_session
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=reason or Messages.NOT_EVENT_ATTENDEE,
                    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )

    class_ = None
    if session.class_id:
        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
            )

    event = None
    if session.event_id:
        event = db.query(Event).filter(Event.id == session.event_id).first()

    user_credential = db.query(Credential).filter(Credential.user_id == user.id).first()
    if user_credential is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_NO_CREDENTIAL,
        )

    challenge = secrets.token_urlsafe(32)
    issued_at_ms = issued_at_ms_now()

    redis_client.set(
        f"check_in_challenge:{user.id}",
        challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"check_in_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )
    if settings.school_subnet_cidr:
        client_host = request.client.host if request.client else None
        network_ok = False
        if client_host:
            try:
                network_ok = ipaddress.ip_address(client_host) in ipaddress.ip_network(
                    settings.school_subnet_cidr, strict=False
                )
            except ValueError:
                pass
        redis_client.set(
            f"check_in_network_ok:{user.id}:{session.id}",
            "1" if network_ok else "0",
            ex=settings.challenge_timeout,
        )
    ble_token_raw = redis_client.get(f"ble_token:{session.id}")
    if ble_token_raw:
        redis_client.set(
            f"check_in_ble_token:{user.id}:{session.id}",
            ble_token_raw,
            ex=settings.challenge_timeout,
        )
    nfc_token_raw = redis_client.get(f"nfc_token:{session.id}")
    if nfc_token_raw:
        redis_client.set(
            f"check_in_nfc_token:{user.id}:{session.id}",
            nfc_token_raw,
            ex=settings.challenge_timeout,
        )

    result = {
        "session_id": session.id,
        "challenge": challenge,
        "issued_at_ms": issued_at_ms,
        "credential_id": user_credential.credential_id,
    }
    if class_ is not None:
        effective_policy = (
            db.query(ClassPolicy)
            .filter(
                ClassPolicy.created_by == class_.teacher_id,
                ClassPolicy.class_id == class_.id,
            )
            .first()
            or db.query(ClassPolicy)
            .filter(
                ClassPolicy.created_by == class_.teacher_id,
                ClassPolicy.class_id.is_(None),
            )
            .first()
        )
        result["standard_assurance_threshold"] = (
            effective_policy.standard_assurance_threshold
            if effective_policy
            else class_.standard_assurance_threshold
        )
        result["high_assurance_threshold"] = (
            effective_policy.high_assurance_threshold
            if effective_policy
            else class_.high_assurance_threshold
        )
    elif event is not None:
        result["standard_assurance_threshold"] = event.standard_assurance_threshold
        result["high_assurance_threshold"] = event.high_assurance_threshold
    return result


@router.post("/verify", response_model=AttendanceRecordResponse)
def check_in_verify(
    response_data: CheckInResponseBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
    _client_type: str = Depends(require_client_type("app")),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
):
    if current_user.id != response_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
        )
    if x_idempotency_key:
        cached = redis_client.get(
            f"checkin_idempotency:{current_user.id}:{x_idempotency_key}"
        )
        if cached:
            return AttendanceRecordResponse.model_validate_json(cached)
    sig_hash = hashlib.sha256(response_data.device_signature.encode()).hexdigest()
    sig_cache_key = f"checkin_sig:{current_user.id}:{sig_hash}"
    if redis_client.get(sig_cache_key):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    check_auth_rate_limit(response_data.user_id)
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )
    session = (
        db.query(CheckInSession)
        .filter(CheckInSession.id == response_data.session_id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    if session.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    class_ = (
        db.query(Class).filter(Class.id == session.class_id).first()
        if session.class_id
        else None
    )
    event = (
        db.query(Event).filter(Event.id == session.event_id).first()
        if session.event_id
        else None
    )
    if class_ is None and event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    if event is not None:
        eligible, reason = is_event_attendee(db, user, event)
        if not eligible:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=reason or Messages.NOT_EVENT_ATTENDEE,
            )
    policy = None
    if class_ is not None:
        policy = (
            db.query(ClassPolicy)
            .filter(
                ClassPolicy.created_by == class_.teacher_id,
                ClassPolicy.class_id == class_.id,
            )
            .first()
            or db.query(ClassPolicy)
            .filter(
                ClassPolicy.created_by == class_.teacher_id,
                ClassPolicy.class_id.is_(None),
            )
            .first()
        )
    effective_max_check_ins = (
        policy.max_check_ins
        if policy
        else event.max_check_ins
        if event
        else settings.max_check_ins_per_session
    )
    retry_key = f"check_in_retry:{session.id}:{user.id}"
    retry_ttl_seconds = max(
        int((session.end_time - datetime.now(timezone.utc)).total_seconds()),
        settings.challenge_timeout,
        1,
    )
    retry_attempt_number = redis_client.incr(retry_key)
    if retry_attempt_number == 1:
        db_count = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == response_data.session_id)
            .filter(AttendanceRecord.user_id == user.id)
            .count()
        )
        if db_count > 0:
            retry_attempt_number = redis_client.incrby(retry_key, db_count)
        redis_client.expire(retry_key, retry_ttl_seconds)
    if retry_attempt_number > effective_max_check_ins:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.CHECKIN_RETRY_LIMIT_REACHED,
        )

    challenge_key = f"check_in_challenge:{user.id}"
    issued_at_ms_key = f"check_in_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.getdel(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    challenge = (
        challenge_bytes.decode()
        if isinstance(challenge_bytes, bytes)
        else challenge_bytes
    )
    issued_at_ms = load_issued_at_ms(issued_at_ms_key, Messages.AUTH_NO_PENDING)
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if now_ms - issued_at_ms > settings.device_payload_max_age_ms:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.DEVICE_PAYLOAD_STALE,
        )

    user_credential = (
        db.query(Credential)
        .filter(
            Credential.user_id == user.id,
            Credential.credential_id == response_data.credential_id,
        )
        .first()
    )
    if user_credential is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_CREDENTIAL_MISMATCH,
        )

    if user_credential.attestation_crl_verified is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.ATTESTATION_CRL_REVOKED,
        )

    if (
        user_credential.attestation_crl_verified is None
        and user_credential.attestation_cert_serial
    ):
        crl_status = fetch_crl_status_by_serial(user_credential.attestation_cert_serial)
        if crl_status is not None:
            user_credential.attestation_crl_verified = crl_status
            db.add(user_credential)
            db.commit()
            if crl_status is False:
                logger.warning(
                    Logs.CREDENTIAL_CRL_REVOKED.format(
                        credential_id=user_credential.credential_id
                    )
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=Messages.ATTESTATION_CRL_REVOKED,
                )
            logger.info(
                Logs.CREDENTIAL_CRL_VERIFIED.format(
                    credential_id=user_credential.credential_id
                )
            )

    if session.class_id:
        enrollment = (
            db.query(ClassEnrollment.id)
            .filter(ClassEnrollment.class_id == session.class_id)
            .filter(ClassEnrollment.student_id == user.id)
            .filter(
                (ClassEnrollment.expires_at.is_(None))
                | (ClassEnrollment.expires_at > datetime.now(timezone.utc))
            )
            .first()
        )
        if enrollment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
            )

    if response_data.device_public_key != user_credential.device_public_key:
        log_audit_event(
            AuditEvents.DEVICE_KEY_MISMATCH,
            current_user.id,
            user.id,
            DeviceKeyMismatchDetail(credential_id=user_credential.id).model_dump(),
            db,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.DEVICE_PUBLIC_KEY_MISMATCH,
        )

    device_payload = build_device_payload(
        flow=DeviceBindingFlow.CHECK_IN,
        user_id=user.id,
        session_id=response_data.session_id,
        credential_id=response_data.credential_id,
        challenge=challenge,
        issued_at_ms=issued_at_ms,
    )
    try:
        verify_device_signature(
            device_public_key=user_credential.device_public_key,
            device_signature=response_data.device_signature,
            payload=device_payload,
        )
    except HTTPException:
        log_audit_event(
            AuditEvents.DEVICE_SIGNATURE_FAILURE,
            current_user.id,
            user.id,
            DeviceSignatureFailureDetail(credential_id=user_credential.id).model_dump(),
            db,
        )
        db.commit()
        raise

    attempted_at = datetime.now(timezone.utc)
    verification_methods = [
        AttendanceRecordVerificationMethods.DEVICE.value,
    ]
    if response_data.bluetooth_rssi_readings:
        readings = [r for r in response_data.bluetooth_rssi_readings if -127 <= r <= 20]
        if readings and response_data.ble_token is not None:
            expected_token_raw = redis_client.getdel(
                f"check_in_ble_token:{user.id}:{session.id}"
            )
            expected_ble_token = (
                expected_token_raw.decode() if expected_token_raw else None
            )
            if (
                expected_ble_token is not None
                and response_data.ble_token == expected_ble_token
            ):
                avg_rssi = round(sum(readings) / len(readings))
                verification_methods.append(
                    f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:{avg_rssi}"
                )
            else:
                logger.warning(
                    Logs.BLE_TOKEN_MISMATCH.format(
                        user_id=user.id, session_id=session.id
                    )
                )
        elif readings:
            logger.warning(
                Logs.BLE_TOKEN_MISMATCH.format(user_id=user.id, session_id=session.id)
            )
    if response_data.nfc_token is not None:
        expected_nfc_raw = redis_client.getdel(
            f"check_in_nfc_token:{user.id}:{session.id}"
        )
        expected_nfc_token = expected_nfc_raw.decode() if expected_nfc_raw else None
        if (
            expected_nfc_token is not None
            and response_data.nfc_token == expected_nfc_token
        ):
            verification_methods.append(AttendanceRecordVerificationMethods.NFC.value)
        else:
            logger.warning(
                Logs.NFC_TOKEN_MISMATCH.format(user_id=user.id, session_id=session.id)
            )
    gps_is_mock = bool(response_data.gps_is_mock)
    gps_in_geofence = None
    if (
        response_data.gps_latitude is not None
        and response_data.gps_longitude is not None
        and settings.school_lat is not None
        and settings.school_lng is not None
    ):
        gps_in_geofence = is_within_geofence(
            response_data.gps_latitude,
            response_data.gps_longitude,
            settings.school_lat,
            settings.school_lng,
            settings.school_geofence_radius_m,
        )
        if gps_in_geofence:
            verification_methods.append(AttendanceRecordVerificationMethods.GPS.value)
    play_integrity_enabled = (
        settings.outbound_integrity_checks_enabled and settings.play_integrity_enabled
    )
    integrity_vouched = play_integrity_enabled and has_valid_vouch(
        user_credential.credential_id
    )
    if integrity_vouched:
        verification_methods.append(
            AttendanceRecordVerificationMethods.PLAY_INTEGRITY.value
        )
    network_anomaly = False
    if settings.school_subnet_cidr:
        network_ok_raw = redis_client.getdel(
            f"check_in_network_ok:{user.id}:{session.id}"
        )
        if network_ok_raw in (b"1", "1"):
            verification_methods.append(
                AttendanceRecordVerificationMethods.NETWORK.value
            )
        else:
            network_anomaly = True
    assurance_score = assurance_score_from_verification_methods(
        verification_methods,
        integrity_vouched=integrity_vouched,
    )
    effective_standard = (
        policy.standard_assurance_threshold
        if policy
        else event.standard_assurance_threshold
        if event
        else class_.standard_assurance_threshold
    )
    effective_high = (
        policy.high_assurance_threshold
        if policy
        else event.high_assurance_threshold
        if event
        else class_.high_assurance_threshold
    )
    assurance_band = compute_assurance_band(
        assurance_score, effective_standard, effective_high
    )
    attendance_status = resolve_attendance_status(
        attempted_at=attempted_at,
        session=session,
    )

    new_record = AttendanceRecord(
        id=str(uuid.uuid4()),
        session_id=response_data.session_id,
        user_id=user.id,
        timestamp=attempted_at,
        is_flagged=False,
        flag_reason=None,
        verification_methods=verification_methods,
        assurance_score=assurance_score,
        assurance_band_recorded=assurance_band,
        standard_threshold_recorded=effective_standard,
        high_threshold_recorded=effective_high,
        status=attendance_status.value,
        gps_is_mock=gps_is_mock,
        gps_in_geofence=gps_in_geofence,
        network_anomaly=network_anomaly,
        sync_pending=False,
    )
    db.add(new_record)
    log_audit_event(
        AuditEvents.CHECK_IN_SUCCESS,
        current_user.id,
        new_record.id,
        {"session_id": response_data.session_id, "assurance_band": assurance_band},
        db,
    )
    db.commit()
    db.refresh(new_record)
    logger.info(
        Logs.RECORD_ADDED.format(
            full_name=user.full_name,
            user_id=new_record.user_id,
            record_id=new_record.id,
        )
    )
    if x_idempotency_key:
        redis_client.set(
            f"checkin_idempotency:{user.id}:{x_idempotency_key}",
            AttendanceRecordResponse.model_validate(new_record).model_dump_json(),
            ex=settings.challenge_timeout,
        )
    redis_client.set(sig_cache_key, "1", ex=settings.challenge_timeout)
    return new_record
