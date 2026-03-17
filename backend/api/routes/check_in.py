import hashlib
import ipaddress
import json
import logging
import uuid
from datetime import datetime, timezone

from api.models import (
    DeviceKeyMismatchDetail,
    DeviceSignatureFailureDetail,
    SignCountAnomalyDetail,
)
from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordResponse,
    AttendanceRecordVerificationMethods,
    CheckInOptionsBase,
    CheckInResponseBase,
)
from api.services.assurance_service import (
    assurance_score_from_verification_methods,
    compute_assurance_band,
    is_within_geofence,
    resolve_attendance_status,
)
from api.services.audit_service import log_audit_event
from api.services.auth_service import (
    build_device_payload,
    check_auth_rate_limit,
    get_user_credential_for_assertion,
    issued_at_ms_now,
    load_issued_at_ms,
    verify_device_signature,
)
from api.services.device_service import (
    encode_base64url,
    normalize_credential_id_base64url,
)
from api.services.integrity_service import has_valid_vouch
from api.services.session_service import require_role
from api.strings import AuditEvents, Logs, Messages
from database import (
    AttendanceRecord,
    CheckInSession,
    Class,
    ClassEnrollment,
    ClassPolicy,
    User,
    get_db,
)
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
)
from webauthn.helpers.exceptions import InvalidAuthenticationResponse
from webauthn.helpers.structs import UserVerificationRequirement

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/check-in", tags=["auth"])


@router.post("/options")
def check_in_options(
    options_data: CheckInOptionsBase,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
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
        .all()
    ]

    if len(enrolled_class_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )

    class_ = db.query(Class).filter(Class.id == session.class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    issued_at_ms = issued_at_ms_now()

    redis_client.set(
        f"check_in_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"check_in_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )
    if settings.subnet_cidr:
        client_host = request.client.host if request.client else None
        network_ok = False
        if client_host:
            try:
                network_ok = ipaddress.ip_address(client_host) in ipaddress.ip_network(
                    settings.subnet_cidr, strict=False
                )
            except ValueError:
                pass
        redis_client.set(
            f"check_in_network_ok:{user.id}",
            "1" if network_ok else "0",
            ex=settings.challenge_timeout,
        )

    options_json = json.loads(options_to_json(options))
    options_json["session_id"] = session.id
    options_json["issued_at_ms"] = issued_at_ms
    effective_policy = (
        db.query(ClassPolicy)
        .filter(
            ClassPolicy.created_by == class_.teacher_id,
            ClassPolicy.class_id == class_.id,
        )
        .first()
        or db.query(ClassPolicy)
        .filter(
            ClassPolicy.created_by == class_.teacher_id, ClassPolicy.class_id.is_(None)
        )
        .first()
    )
    options_json["standard_assurance_threshold"] = (
        effective_policy.standard_assurance_threshold
        if effective_policy
        else class_.standard_assurance_threshold
    )
    options_json["high_assurance_threshold"] = (
        effective_policy.high_assurance_threshold
        if effective_policy
        else class_.high_assurance_threshold
    )
    return options_json


@router.post("/verify", response_model=AttendanceRecordResponse)
def check_in_verify(
    response_data: CheckInResponseBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
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
    challenge_key = f"check_in_challenge:{user.id}"
    issued_at_ms_key = f"check_in_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.getdel(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    issued_at_ms = load_issued_at_ms(issued_at_ms_key, Messages.AUTH_NO_PENDING)
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if now_ms - issued_at_ms > settings.device_payload_max_age_ms:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.DEVICE_PAYLOAD_STALE,
        )

    user_credential = get_user_credential_for_assertion(
        user_id=user.id,
        assertion_credential=response_data.credential,
        db=db,
    )

    if user_credential.attestation_crl_verified is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.ATTESTATION_CRL_REVOKED,
        )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
        enrollment = (
            db.query(ClassEnrollment.id)
            .filter(ClassEnrollment.class_id == session.class_id)
            .filter(ClassEnrollment.student_id == user.id)
            .first()
        )
        if enrollment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
            )

        if isinstance(challenge_bytes, bytes):
            authentication_verification = verify_authentication_response(
                credential=response_data.credential,
                expected_challenge=challenge_bytes,
                expected_origin=[settings.web_origin, settings.app_origin],
                expected_rp_id=settings.rp_id,
                credential_public_key=bytes.fromhex(user_public_key),
                credential_current_sign_count=user_sign_count,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=Messages.INVALID_CHALLENGE_DATA,
            )

        if response_data.device_public_key != user_credential.device_public_key:
            log_audit_event(
                AuditEvents.DEVICE_KEY_MISMATCH,
                None,
                user.id,
                DeviceKeyMismatchDetail(credential_id=user_credential.id).model_dump(),
                db,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=Messages.DEVICE_PUBLIC_KEY_MISMATCH,
            )

        challenge = encode_base64url(challenge_bytes)
        device_payload = build_device_payload(
            flow=DeviceBindingFlow.CHECK_IN,
            user_id=user.id,
            session_id=response_data.session_id,
            credential_id=normalize_credential_id_base64url(response_data.credential),
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
                None,
                user.id,
                DeviceSignatureFailureDetail(
                    credential_id=user_credential.id
                ).model_dump(),
                db,
            )
            raise

        class_ = db.query(Class).filter(Class.id == session.class_id).first()
        if class_ is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
            )
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
            policy.max_check_ins if policy else settings.max_check_ins_per_session
        )

        existing_records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == response_data.session_id)
            .filter(AttendanceRecord.user_id == user.id)
            .count()
        )
        if existing_records >= effective_max_check_ins:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=Messages.CHECKIN_RETRY_LIMIT_REACHED,
            )

        attempted_at = datetime.now(timezone.utc)
        verification_methods = [
            AttendanceRecordVerificationMethods.PASSKEY.value,
            AttendanceRecordVerificationMethods.DEVICE.value,
        ]
        if response_data.bluetooth_rssi_readings:
            readings = [
                r for r in response_data.bluetooth_rssi_readings if -127 <= r <= 20
            ]
            if readings and response_data.ble_token is not None:
                redis_token = redis_client.get(f"ble_token:{session.id}")
                valid_token = redis_token.decode() if redis_token else session.dynamic_token
                if response_data.ble_token == valid_token:
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
                    Logs.BLE_TOKEN_MISMATCH.format(
                        user_id=user.id, session_id=session.id
                    )
                )
        gps_is_mock = bool(response_data.gps_is_mock)
        gps_in_geofence = None
        if (
            response_data.gps_latitude is not None
            and response_data.gps_longitude is not None
            and not gps_is_mock
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
                verification_methods.append(
                    AttendanceRecordVerificationMethods.GPS.value
                )
        play_integrity_enabled = policy.play_integrity_enabled if policy else False
        integrity_vouched = play_integrity_enabled and has_valid_vouch(
            user_credential.credential_id
        )
        if integrity_vouched:
            verification_methods.append(
                AttendanceRecordVerificationMethods.PLAY_INTEGRITY.value
            )
        network_anomaly = False
        if settings.subnet_cidr:
            network_ok_raw = redis_client.getdel(f"check_in_network_ok:{user.id}")
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
            else class_.standard_assurance_threshold
        )
        effective_high = (
            policy.high_assurance_threshold
            if policy
            else class_.high_assurance_threshold
        )
        assurance_band = compute_assurance_band(assurance_score, effective_standard, effective_high)
        attendance_status = resolve_attendance_status(
            attempted_at=attempted_at,
            session=session,
        )

        user_credential.sign_count = authentication_verification.new_sign_count
        if (
            authentication_verification.new_sign_count > 0
            and authentication_verification.new_sign_count <= user_sign_count
        ):
            user_credential.sign_count_anomaly = True
            log_audit_event(
                AuditEvents.SIGN_COUNT_ANOMALY,
                None,
                user.id,
                SignCountAnomalyDetail(
                    credential_id=user_credential.id,
                    old_count=user_sign_count,
                    new_count=authentication_verification.new_sign_count,
                ).model_dump(),
                db,
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
    except InvalidAuthenticationResponse as e:
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
    except HTTPException:
        raise
