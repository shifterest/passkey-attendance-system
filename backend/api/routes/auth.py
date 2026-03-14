import base64
import binascii
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from api.config import settings
from api.contracts.device import DEVICE_PAYLOAD_VERSION, DeviceBindingFlow
from api.messages import Logs, Messages
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordResponse,
    AttendanceRecordStatus,
    CheckInOptionsBase,
    CheckInResponseBase,
    CredentialResponse,
    DeviceBindingPayload,
    LoginOptionsBase,
    LoginResponseBase,
    LoginSessionBase,
    LogoutOptionsBase,
    RegistrationOptionsBase,
    RegistrationResponseBase,
)
from api.services.auth_service import create_login_session
from api.services.device_service import (
    canonical_payload_bytes,
    credential_id_matches,
    encode_base64url,
    normalize_credential_id_base64url,
)
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_der_public_key
from db.database import (
    AttendanceRecord,
    CheckInSession,
    ClassEnrollment,
    Credential,
    LoginSession,
    User,
    get_db,
)
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.exceptions import (
    InvalidAuthenticationResponse,
    InvalidRegistrationResponse,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _issued_at_ms_now() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _credential_limit_reached(user_id: str, db: Session) -> bool:
    if settings.max_active_credentials_per_user <= 0:
        return False

    return (
        db.query(Credential).filter(Credential.user_id == user_id).count()
        >= settings.max_active_credentials_per_user
    )


def _build_device_payload(
    flow: DeviceBindingFlow,
    user_id: str,
    session_id: str | None,
    credential_id: str | None,
    challenge: str,
    issued_at_ms: int,
) -> DeviceBindingPayload:
    return DeviceBindingPayload(
        v=DEVICE_PAYLOAD_VERSION,
        flow=flow,
        user_id=user_id,
        session_id=session_id,
        credential_id=credential_id,
        challenge=challenge,
        issued_at_ms=issued_at_ms,
    )


def _get_user_credential_for_assertion(
    user_id: str,
    assertion_credential: dict[str, Any],
    db: Session,
) -> Credential:
    user_credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    if len(user_credentials) == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_NO_CREDENTIAL,
        )

    asserted_credential_id = normalize_credential_id_base64url(assertion_credential)
    if asserted_credential_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.AUTH_CREDENTIAL_MISMATCH,
        )

    for credential in user_credentials:
        if credential_id_matches(credential.credential_id, asserted_credential_id):
            if credential.credential_id != asserted_credential_id:
                credential.credential_id = asserted_credential_id
            return credential

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=Messages.AUTH_CREDENTIAL_MISMATCH,
    )


def _verify_device_signature(
    device_public_key: str,
    device_signature: str,
    payload: DeviceBindingPayload,
):
    try:
        public_key_bytes = base64.b64decode(device_public_key, validate=True)
        signature_bytes = base64.b64decode(device_signature, validate=True)
        public_key = load_der_public_key(public_key_bytes)

        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Invalid key algorithm")

        public_key.verify(
            signature_bytes,
            canonical_payload_bytes(payload),
            ec.ECDSA(hashes.SHA256()),
        )
    except (
        binascii.Error,
        InvalidSignature,
        UnsupportedAlgorithm,
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.DEVICE_VERIFY_FAILED,
        )


def _load_issued_at_ms(
    key: str,
    pending_error_message: str,
) -> int:
    issued_at_ms_bytes = redis_client.get(key)
    if not issued_at_ms_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=pending_error_message,
        )

    if not isinstance(issued_at_ms_bytes, bytes):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.INVALID_CHALLENGE_DATA,
        )

    try:
        return int(issued_at_ms_bytes.decode())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=Messages.INVALID_CHALLENGE_DATA,
        )


# Registration
@router.post("/register/options")
def register_options(
    options_data: RegistrationOptionsBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )

    user_id_bytes = redis_client.get(
        f"registration_session_token:{options_data.registration_token}"
    )
    if not user_id_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.REGISTRATION_TOKEN_INVALID,
        )
    user_id = user_id_bytes.decode()  # type: ignore

    if user_id != user.id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.REGISTRATION_TOKEN_USER_MISMATCH,
        )

    if _credential_limit_reached(user.id, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=Messages.CREDENTIAL_LIMIT_REACHED,
        )

    options = generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.rp_name,
        user_id=bytes(user.id, "utf-8"),
        user_name=user.email,
        user_display_name=user.full_name,
        timeout=settings.challenge_timeout * 1000,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.REQUIRED
        ),
    )
    issued_at_ms = _issued_at_ms_now()

    redis_client.set(
        f"registration_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"registration_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )

    options_json = json.loads(options_to_json(options))
    options_json["issued_at_ms"] = issued_at_ms
    return options_json


@router.post("/register/verify", response_model=CredentialResponse)
def register_verify(
    response_data: RegistrationResponseBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )

    user_id_bytes = redis_client.get(
        f"registration_session_token:{response_data.registration_token}"
    )
    if not user_id_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.REGISTRATION_TOKEN_INVALID,
        )
    user_id = user_id_bytes.decode()  # type: ignore

    if user_id != user.id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.REGISTRATION_TOKEN_USER_MISMATCH,
        )

    challenge_key = f"registration_challenge:{user.id}"
    issued_at_ms_key = f"registration_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.get(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.REGISTER_NO_PENDING
        )
    issued_at_ms = _load_issued_at_ms(issued_at_ms_key, Messages.REGISTER_NO_PENDING)

    try:
        if isinstance(challenge_bytes, bytes):
            registration_verification = verify_registration_response(
                credential=response_data.credential,
                expected_challenge=challenge_bytes,
                expected_origin=[settings.web_origin, settings.app_origin],
                expected_rp_id=settings.rp_id,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=Messages.INVALID_CHALLENGE_DATA,
            )

        challenge = encode_base64url(challenge_bytes)
        device_payload = _build_device_payload(
            flow=DeviceBindingFlow.REGISTER,
            user_id=user.id,
            session_id=None,
            credential_id=normalize_credential_id_base64url(response_data.credential),
            challenge=challenge,
            issued_at_ms=issued_at_ms,
        )
        _verify_device_signature(
            device_public_key=response_data.device_public_key,
            device_signature=response_data.device_signature,
            payload=device_payload,
        )

        if _credential_limit_reached(user.id, db):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=Messages.CREDENTIAL_LIMIT_REACHED,
            )

        new_uuid = str(uuid.uuid4())
        while True:
            credential = db.query(Credential).filter(Credential.id == new_uuid).first()
            if credential is None:
                break
            new_uuid = str(uuid.uuid4())
        new_credential = Credential(
            id=new_uuid,
            user_id=user.id,
            device_public_key=response_data.device_public_key,
            public_key=registration_verification.credential_public_key.hex(),
            credential_id=encode_base64url(registration_verification.credential_id),
            sign_count=0,
            registered_at=datetime.now(timezone.utc),
        )
        db.add(new_credential)
        db.commit()
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        db.refresh(new_credential)
        logger.info(
            Logs.USER_REGISTERED.format(
                user_id=new_credential.user_id, credential_id=new_credential.id
            )
        )
        return new_credential
    except InvalidRegistrationResponse as e:
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        logger.error(Logs.REGISTER_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.REGISTER_VERIFY_FAILED,
        )
    except HTTPException:
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        raise


# Check in
@router.post("/check-in/options")
def check_in_options(options_data: CheckInOptionsBase, db: Session = Depends(get_db)):
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

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    issued_at_ms = _issued_at_ms_now()

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
    return options_json


@router.post("/check-in/verify", response_model=AttendanceRecordResponse)
def check_in_verify(response_data: CheckInResponseBase, db: Session = Depends(get_db)):
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

    challenge_bytes = redis_client.get(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    issued_at_ms = _load_issued_at_ms(issued_at_ms_key, Messages.AUTH_NO_PENDING)

    user_credential = _get_user_credential_for_assertion(
        user_id=user.id,
        assertion_credential=response_data.credential,
        db=db,
    )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
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
        device_payload = _build_device_payload(
            flow=DeviceBindingFlow.CHECK_IN,
            user_id=user.id,
            session_id=response_data.session_id,
            credential_id=normalize_credential_id_base64url(response_data.credential),
            challenge=challenge,
            issued_at_ms=issued_at_ms,
        )
        _verify_device_signature(
            device_public_key=user_credential.device_public_key,
            device_signature=response_data.device_signature,
            payload=device_payload,
        )

        user_credential.sign_count = authentication_verification.new_sign_count
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
        # TODO: Verification methods are not sent by the client but determined
        # by the backend. Work on adding more stuff in AttendanceRecord
        new_record = AttendanceRecord(
            id=new_uuid,
            session_id=response_data.session_id,
            user_id=user.id,
            timestamp=datetime.now(timezone.utc),
            is_flagged=False,
            verification_methods=[],
            status=AttendanceRecordStatus.PRESENT,
        )
        db.add(new_record)
        db.commit()
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
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
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
    except HTTPException:
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        raise


# Login
@router.post("/login/options")
def login_options(options_data: LoginOptionsBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    issued_at_ms = _issued_at_ms_now()

    redis_client.set(
        f"login_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    redis_client.set(
        f"login_issued_at_ms:{user.id}",
        issued_at_ms,
        ex=settings.challenge_timeout,
    )

    options_json = json.loads(options_to_json(options))
    options_json["issued_at_ms"] = issued_at_ms
    return options_json


@router.post("/login/verify", response_model=LoginSessionBase)
def login_verify(response_data: LoginResponseBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )
    challenge_key = f"login_challenge:{user.id}"
    issued_at_ms_key = f"login_issued_at_ms:{user.id}"

    challenge_bytes = redis_client.get(challenge_key)
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    issued_at_ms = _load_issued_at_ms(issued_at_ms_key, Messages.AUTH_NO_PENDING)

    user_credential = _get_user_credential_for_assertion(
        user_id=user.id,
        assertion_credential=response_data.credential,
        db=db,
    )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
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
        device_payload = _build_device_payload(
            flow=DeviceBindingFlow.LOGIN,
            user_id=user.id,
            session_id=None,
            credential_id=normalize_credential_id_base64url(response_data.credential),
            challenge=challenge,
            issued_at_ms=issued_at_ms,
        )
        _verify_device_signature(
            device_public_key=user_credential.device_public_key,
            device_signature=response_data.device_signature,
            payload=device_payload,
        )

        user_credential.sign_count = authentication_verification.new_sign_count

        new_uuid = str(uuid.uuid4())
        while True:
            record = db.query(LoginSession).filter(LoginSession.id == new_uuid).first()
            if record is None:
                break
            new_uuid = str(uuid.uuid4())
        new_session = LoginSession(
            id=new_uuid,
            user_id=user.id,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.login_timeout),
            last_activity_at=None,
        )
        db.add(new_session)
        db.commit()

        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        login_response = create_login_session(new_session)

        logger.info(
            Logs.LOGIN_SUCCESSFUL.format(full_name=user.full_name, user_id=user.id)
        )
        return login_response
    except InvalidAuthenticationResponse as e:
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
    except HTTPException:
        redis_client.delete(challenge_key)
        redis_client.delete(issued_at_ms_key)
        raise


# Logout
@router.post("/logout")
def logout(options_data: LogoutOptionsBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    session_token_bytes = redis_client.get(
        f"login_session_token:{options_data.session_token}"
    )
    if not session_token_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.LOGIN_SESSION_NOT_FOUND,
        )
    session_token = session_token_bytes.decode()  # type: ignore
    if session_token != options_data.user_id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=Messages.SESSION_USER_MISMATCH,
        )
    redis_client.delete(f"login_session_token:{options_data.session_token}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
