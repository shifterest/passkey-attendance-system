import json
import logging
import uuid
from datetime import datetime, timezone

from api.config import settings
from api.messages import Logs, Messages
from api.redis import redis_client
from api.schemas import (
    AttendanceRecordResponse,
    AttendanceRecordStatus,
    AuthenticationOptionsBase,
    AuthenticationResponseBase,
    CredentialResponse,
    LoginOptionsBase,
    LoginResponseBase,
    LoginSessionBase,
    LogoutOptionsBase,
    RegistrationOptionsBase,
    RegistrationResponseBase,
)
from api.services.auth_service import create_login_session
from db.database import AttendanceRecord, AttendanceSession, Credential, User, get_db
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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


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
        f"registration_token:{options_data.registration_token}"
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

    options = generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.rp_name,
        user_id=bytes(user.id, "utf-8"),
        user_name=user.email,
        user_display_name=user.full_name,
        timeout=settings.challenge_timeout * 1000,
    )

    redis_client.set(
        f"registration_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    return json.loads(options_to_json(options))


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
        f"registration_token:{response_data.registration_token}"
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

    challenge_bytes = redis_client.get(f"registration_challenge:{user.id}")
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.REGISTER_NO_PENDING
        )
    challenge = challenge_bytes.decode()  # type: ignore

    try:
        registration_verification = verify_registration_response(
            credential=response_data.credential,
            expected_challenge=challenge,
            expected_origin=settings.origin,
            expected_rp_id=settings.rp_id,
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
            device_id=response_data.device_id,
            public_key=registration_verification.credential_public_key.hex(),
            credential_id=registration_verification.credential_id.hex(),
            sign_count=0,
            registered_at=datetime.now(timezone.utc),
        )
        db.add(new_credential)
        db.commit()
        redis_client.delete(f"registration_challenge:{user.id}")
        db.refresh(new_credential)
        logger.info(
            Logs.USER_REGISTERED.format(
                user_id=new_credential.user_id, credential_id=new_credential.id
            )
        )
        return new_credential
    except InvalidRegistrationResponse as e:
        redis_client.delete(f"registration_challenge:{user.id}")
        logger.error(Logs.REGISTER_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.REGISTER_VERIFY_FAILED,
        )


# Authentication
@router.post("/authenticate/options")
def authentication_options(
    options_data: AuthenticationOptionsBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    options = generate_authentication_options(
        rp_id=settings.rp_id,
        timeout=settings.challenge_timeout * 1000,
    )

    redis_client.set(
        f"authentication_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    return json.loads(options_to_json(options))


@router.post("/authenticate/verify", response_model=AttendanceRecordResponse)
def authentication_verify(
    response_data: AuthenticationResponseBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )
    session = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.id == response_data.session_id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    challenge_bytes = redis_client.get(f"authentication_challenge:{user.id}")
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    challenge = challenge_bytes.decode()  # type: ignore
    user_credential = db.query(Credential).filter(Credential.user_id == user.id).first()
    if user_credential is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_NO_CREDENTIAL
        )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
        authentication_verification = verify_authentication_response(
            credential=response_data.credential,
            expected_challenge=challenge,
            expected_origin=settings.origin,
            expected_rp_id=settings.rp_id,
            credential_public_key=bytes.fromhex(user_public_key),
            credential_current_sign_count=user_sign_count,
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
        redis_client.delete(f"authentication_challenge:{user.id}")
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
        redis_client.delete(f"authentication_challenge:{user.id}")
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )


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
    )

    redis_client.set(
        f"login_challenge:{user.id}",
        options.challenge,
        ex=settings.challenge_timeout,
    )
    return json.loads(options_to_json(options))


@router.post("/login/verify", response_model=LoginSessionBase)
def login_verify(response_data: LoginResponseBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.USER_NOT_FOUND,
        )
    challenge_bytes = redis_client.get(f"login_challenge:{user.id}")
    if not challenge_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    challenge = challenge_bytes.decode()  # type: ignore
    user_credential = db.query(Credential).filter(Credential.user_id == user.id).first()
    if user_credential is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_NO_CREDENTIAL
        )

    user_public_key = user_credential.public_key
    user_sign_count = user_credential.sign_count

    try:
        authentication_verification = verify_authentication_response(
            credential=response_data.credential,
            expected_challenge=challenge,
            expected_origin=settings.origin,
            expected_rp_id=settings.rp_id,
            credential_public_key=bytes.fromhex(user_public_key),
            credential_current_sign_count=user_sign_count,
        )
        user_credential.sign_count = authentication_verification.new_sign_count
        redis_client.delete(f"login_challenge:{user.id}")
        login_response = create_login_session(
            user_id=user.id, timeout=settings.login_timeout
        )
        logger.info(
            Logs.LOGIN_SUCCESSFUL.format(full_name=user.full_name, user_id=user.id)
        )
        return login_response
    except InvalidAuthenticationResponse as e:
        redis_client.delete(f"login_challenge:{user.id}")
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )


# Logout
@router.post("/logout")
def logout(options_data: LogoutOptionsBase, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    session_token_bytes = redis_client.get(
        f"session_token:{options_data.session_token}"
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
    redis_client.delete(f"session_token:{options_data.session_token}")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
