import json
import logging
import uuid
from datetime import datetime, timezone

from api.config import settings
from api.contracts.device import DeviceBindingFlow
from api.messages import Logs, Messages
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordResponse,
    AttendanceRecordVerificationMethods,
    CheckInOptionsBase,
    CheckInResponseBase,
)
from api.services.assurance_service import (
    assurance_score_from_verification_methods,
    resolve_attendance_status,
)
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
from api.services.session_service import require_role
from db.database import (
    AttendanceRecord,
    CheckInSession,
    Class,
    ClassEnrollment,
    User,
    get_db,
)
from fastapi import APIRouter, Depends, HTTPException, status
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

    options_json = json.loads(options_to_json(options))
    options_json["session_id"] = session.id
    options_json["issued_at_ms"] = issued_at_ms
    options_json["standard_assurance_threshold"] = class_.standard_assurance_threshold
    options_json["high_assurance_threshold"] = class_.high_assurance_threshold
    return options_json


@router.post("/verify", response_model=AttendanceRecordResponse)
def check_in_verify(
    response_data: CheckInResponseBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student")),
):
    if current_user.id != response_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=Messages.AUTH_FORBIDDEN
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
        verify_device_signature(
            device_public_key=user_credential.device_public_key,
            device_signature=response_data.device_signature,
            payload=device_payload,
        )

        existing_records = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.session_id == response_data.session_id)
            .filter(AttendanceRecord.user_id == user.id)
            .count()
        )
        if existing_records >= settings.max_check_ins_per_session:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=Messages.CHECKIN_RETRY_LIMIT_REACHED,
            )

        attempted_at = datetime.now(timezone.utc)
        verification_methods = [
            AttendanceRecordVerificationMethods.PASSKEY.value,
            AttendanceRecordVerificationMethods.DEVICE.value,
            f"{AttendanceRecordVerificationMethods.BLUETOOTH.value}:{response_data.bluetooth_rssi}",
        ]
        assurance_score = assurance_score_from_verification_methods(
            verification_methods
        )
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
        new_uuid = str(uuid.uuid4())
        while True:
            record = (
                db.query(AttendanceRecord)
                .filter(AttendanceRecord.id == new_uuid)
                .first()
            )
            if record is None:
                break
            new_uuid = str(uuid.uuid4())
        new_record = AttendanceRecord(
            id=new_uuid,
            session_id=response_data.session_id,
            user_id=user.id,
            timestamp=attempted_at,
            is_flagged=False,
            flag_reason=None,
            verification_methods=verification_methods,
            assurance_score=assurance_score,
            status=attendance_status.value,
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
        return new_record
    except InvalidAuthenticationResponse as e:
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
    except HTTPException:
        raise
