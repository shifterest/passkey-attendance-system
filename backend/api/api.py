import datetime
import logging
import uuid

import fastapi
from api.messages import Logs, Messages
from api.schemas import *
from db.database import *
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)

RP_ID = "attendance.softeng.com"
RP_NAME = "Passkey Attendance System"
ORIGIN = "http://localhost:8000"

logger = logging.getLogger(__name__)
app = fastapi.FastAPI()

pending_challenges = {}


# === Endpoints ===
@app.get("/")
def read_root():
    return {"tantan": "cutie"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Users
@app.get("/users", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    return user


@app.post("/users", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    new_uuid = str(uuid.uuid4())
    while True:
        user = db.query(User).filter(User.id == new_uuid).first()
        if user is None:
            break
        new_uuid = str(uuid.uuid4())
    new_user = User(
        id=new_uuid,
        role=user_data.role,
        full_name=user_data.full_name,
        email=user_data.email,
        school_id=user_data.school_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(
        Logs.USER_ADDED.format(full_name=new_user.full_name, user_id=new_user.id)
    )
    return new_user


@app.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, updated_data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    db.commit()
    logger.info(Logs.USER_EDITED.format(full_name=user.full_name, user_id=user.id))
    return user


@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )
    db.delete(user)
    db.commit()
    return {"message": Messages.USER_DELETED}


# Credentials
@app.get("/credentials", response_model=list[CredentialResponse])
def get_all_credentials(db: Session = Depends(get_db)):
    credentials = db.query(Credential).all()
    return credentials


@app.get("/credentials/by-user/{user_id}", response_model=list[CredentialResponse])
def get_all_credentials_by_user(user_id: str, db: Session = Depends(get_db)):
    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    return credentials


@app.get("/credentials/{credential_id}", response_model=CredentialResponse)
def get_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIAL_NOT_FOUND
        )
    return credential


# Credentials can only be created via registration endpoint
@app.post("/credentials", response_model=CredentialResponse)
def create_credential(credential_data: CredentialCreate, db: Session = Depends(get_db)):
    return {"message": "Credentials can only be created via registration endpoint"}
    user = db.query(User).filter(User.id == credential_data.user_id).first()
    if user is None:
        return {"message": "Error adding credential: user not found"}
    new_uuid = str(uuid.uuid4())
    while True:
        credential = db.query(Credential).filter(Credential.id == new_uuid).first()
        if credential is None:
            break
        new_uuid = str(uuid.uuid4())
    new_credential = Credential(
        id=new_uuid,
        user_id=credential_data.user_id,
        public_key=credential_data.public_key,
        credential_id=credential_data.credential_id,
        sign_count=0,
        registered_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(new_credential)
    db.commit()
    db.refresh(new_credential)
    logger.info(
        f"Added credential for user {new_credential.user_id} (ID: {new_credential.id})"
    )
    return new_credential


@app.put("/credentials/{credential_id}", response_model=CredentialResponse)
def update_credential(
    credential_id: str, updated_data: CredentialUpdate, db: Session = Depends(get_db)
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        return {"message": "Credential not found"}
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(credential, key, value)
    db.commit()
    logger.info(f"Edited credential: {credential.credential_id} (ID: {credential.id})")
    return credential


@app.delete("/credentials/{credential_id}")
def delete_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CREDENTIAL_NOT_FOUND
        )
    db.delete(credential)
    db.commit()
    return {"message": Messages.CREDENTIAL_DELETED}


# Classes
@app.get("/classes", response_model=list[ClassResponse])
def get_all_classes(db: Session = Depends(get_db)):
    classes = db.query(Class).all()
    return classes


@app.get("/classes/by-teacher/{teacher_id}", response_model=list[ClassResponse])
def get_all_classes_by_teacher(teacher_id: str, db: Session = Depends(get_db)):
    classes = db.query(Class).filter(Class.teacher_id == teacher_id).all()
    return classes


@app.get("/classes/{class_id}", response_model=ClassResponse)
def get_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    return class_


@app.post("/classes", response_model=ClassResponse)
def create_class(class_data: ClassCreate, db: Session = Depends(get_db)):
    teacher = db.query(User).filter(User.id == class_data.teacher_id).first()
    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.CLASS_TEACHER_NOT_FOUND,
        )
    if teacher.role != UserRole.TEACHER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.CLASS_TEACHER_INVALID_ROLE,
        )
    new_uuid = str(uuid.uuid4())
    while True:
        class_ = db.query(Class).filter(Class.id == new_uuid).first()
        if class_ is None:
            break
        new_uuid = str(uuid.uuid4())
    new_class = Class(
        id=new_uuid,
        teacher_id=class_data.teacher_id,
        course_code=class_data.course_code,
        course_name=class_data.course_name,
        schedule=class_data.schedule,
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    logger.info(
        Logs.CLASS_ADDED.format(
            course_name=new_class.course_name, course_code=new_class.course_code
        )
    )
    return new_class


@app.put("/classes/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: str, updated_data: ClassUpdate, db: Session = Depends(get_db)
):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(class_, key, value)
    db.commit()
    logger.info(
        Logs.CLASS_EDITED.format(
            course_name=class_.course_name, course_code=class_.course_code
        )
    )
    return class_


@app.delete("/classes/{class_id}")
def delete_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.CLASS_NOT_FOUND
        )
    db.delete(class_)
    db.commit()
    return {"message": Messages.CLASS_DELETED}


# Class enrollments
@app.get("/enrollments", response_model=list[ClassEnrollmentResponse])
def get_all_enrollments(db: Session = Depends(get_db)):
    enrollments = db.query(ClassEnrollment).all()
    return enrollments


@app.get(
    "/enrollments/by-class/{class_id}", response_model=list[ClassEnrollmentResponse]
)
def get_enrollments_by_class(class_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    )
    return enrollments


@app.get(
    "/enrollments/by-student/{student_id}", response_model=list[ClassEnrollmentResponse]
)
def get_enrollments_by_student(student_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == student_id).all()
    )
    return enrollments


@app.get(
    "/enrollments/by-class/{class_id}/by-student/{student_id}/",
    response_model=ClassEnrollmentResponse,
)
def get_enrollment_by_class_and_student(
    class_id: str, student_id: str, db: Session = Depends(get_db)
):
    enrollment = (
        db.query(ClassEnrollment)
        .filter(
            ClassEnrollment.student_id == student_id,
            ClassEnrollment.class_id == class_id,
        )
        .first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    return enrollment


@app.post("/enrollments", response_model=ClassEnrollmentResponse)
def create_enrollment(
    enrollment_data: ClassEnrollmentCreate, db: Session = Depends(get_db)
):
    class_ = db.query(Class).filter(Class.id == enrollment_data.class_id).first()
    student = db.query(User).filter(User.id == enrollment_data.student_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.ENROLLMENT_CLASS_NOT_FOUND,
        )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.ENROLLMENT_STUDENT_NOT_FOUND,
        )
    new_uuid = str(uuid.uuid4())
    while True:
        enrollment = (
            db.query(ClassEnrollment).filter(ClassEnrollment.id == new_uuid).first()
        )
        if enrollment is None:
            break
        new_uuid = str(uuid.uuid4())
    new_enrollment = ClassEnrollment(
        id=new_uuid,
        class_id=enrollment_data.class_id,
        student_id=enrollment_data.student_id,
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    logger.info(
        Logs.ENROLLMENT_ADDED.format(
            student_name=student.full_name,
            class_name=class_.course_name,
            enrollment_id=new_enrollment.id,
        )
    )
    return new_enrollment


@app.put("/enrollments/{enrollment_id}", response_model=ClassEnrollmentResponse)
def update_enrollment(
    enrollment_id: str,
    updated_data: ClassEnrollmentUpdate,
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(enrollment, key, value)
    db.commit()
    logger.info(Logs.ENROLLMENT_EDITED.format(enrollment_id=enrollment.id))
    return enrollment


@app.delete("/enrollments/{enrollment_id}")
def delete_enrollment(enrollment_id: str, db: Session = Depends(get_db)):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.ENROLLMENT_NOT_FOUND
        )
    db.delete(enrollment)
    db.commit()
    return {"message": Messages.ENROLLMENT_DELETED}


# Attendance sessions
@app.get("/sessions", response_model=list[AttendanceSessionResponse])
def get_all_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AttendanceSession).all()
    return sessions


@app.get(
    "/sessions/by-class/{class_id}", response_model=list[AttendanceSessionResponse]
)
def get_sessions_by_class(class_id: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(AttendanceSession).filter(AttendanceSession.class_id == class_id).all()
    )
    return sessions


@app.get("/sessions/{session_id}", response_model=AttendanceSessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    return session


@app.post("/sessions", response_model=AttendanceSessionResponse)
def create_session(
    session_data: AttendanceSessionCreate, db: Session = Depends(get_db)
):
    class_ = db.query(Class).filter(Class.id == session_data.class_id).first()
    if class_ is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.SESSION_CLASS_NOT_FOUND,
        )
    new_uuid = str(uuid.uuid4())
    while True:
        session = (
            db.query(AttendanceSession).filter(AttendanceSession.id == new_uuid).first()
        )
        if session is None:
            break
        new_uuid = str(uuid.uuid4())
    new_session = AttendanceSession(
        id=new_uuid,
        class_id=session_data.class_id,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        status=session_data.status,
        dynamic_token=session_data.dynamic_token,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    logger.info(Logs.SESSION_ADDED.format(session_id=new_session.id))
    return new_session


@app.put("/sessions/{session_id}", response_model=AttendanceSessionResponse)
def update_session(
    session_id: str,
    updated_data: AttendanceSessionUpdate,
    db: Session = Depends(get_db),
):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    for key, value in updated_data.model_dump(exclude_unset=True).items():
        setattr(session, key, value)
    db.commit()
    logger.info(Logs.SESSION_EDITED.format(session_id=session.id))
    return session


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.SESSION_NOT_FOUND
        )
    db.delete(session)
    db.commit()
    return {"message": Messages.SESSION_DELETED}


# Attendance records
@app.get("/records", response_model=list[AttendanceRecordResponse])
def get_all_records(db: Session = Depends(get_db)):
    records = db.query(AttendanceRecord).all()
    return records


@app.get(
    "/records/by-session/{session_id}", response_model=list[AttendanceRecordResponse]
)
def get_records_by_session(session_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id)
        .all()
    )
    return records


@app.get("/records/by-user/{user_id}", response_model=list[AttendanceRecordResponse])
def get_records_by_user(user_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id).all()
    )
    return records


@app.get(
    "/records/by-session/{session_id}/by-user/{user_id}/",
    response_model=list[AttendanceRecordResponse],
)
def get_records_by_session_and_user(
    session_id: str, user_id: str, db: Session = Depends(get_db)
):
    records = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.user_id == user_id,
        )
        .all()
    )
    return records


@app.get("/records/{record_id}", response_model=AttendanceRecordResponse)
def get_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    return record


@app.post("/records", response_model=AttendanceRecordResponse)
def create_record(record_data: dict, db: Session = Depends(get_db)):
    return {"message": "Records can only be created via authentication verify endpoint"}
    session = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.id == record_data["session_id"])
        .first()
    )
    user = db.query(User).filter(User.id == record_data["user_id"]).first()
    if session is None:
        return {"message": "Error adding record: session not found"}
    if user is None:
        return {"message": "Error adding record: user not found"}
    new_uuid = str(uuid.uuid4())
    while True:
        record = (
            db.query(AttendanceRecord).filter(AttendanceRecord.id == new_uuid).first()
        )
        if record is None:
            break
        new_uuid = str(uuid.uuid4())
    new_record = AttendanceRecord(
        id=new_uuid,
        session_id=record_data["session_id"],
        user_id=record_data["user_id"],
        timestamp=record_data["timestamp"],
        verification_methods=record_data["verification_methods"],
        status=record_data["status"],
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    logger.info(f"Added record: {new_record.id}")
    return new_record


@app.put("/records/{record_id}", response_model=AttendanceRecordResponse)
def update_record(record_id: str, updated_data: dict, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    for key, value in updated_data.items():
        setattr(record, key, value)
    db.commit()
    logger.info(Logs.RECORD_EDITED.format(record_id=record.id))
    return record


@app.delete("/records/{record_id}")
def delete_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.RECORD_NOT_FOUND
        )
    db.delete(record)
    db.commit()
    return {"message": Messages.RECORD_DELETED}


# Registration
@app.post("/auth/register/options")
def register_options(
    options_data: RegistrationOptionsBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.REGISTER_USER_NOT_FOUND,
        )

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=bytes(user.id, "utf-8"),
        user_name=user.email,
        user_display_name=user.full_name,
    )

    pending_challenges[user.id] = options.challenge
    return options_to_json(options)


@app.post("/auth/register/verify")
def register_verify(
    response_data: RegistrationResponseBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.REGISTER_VERIFY_USER_NOT_FOUND,
        )
    if user.id not in pending_challenges:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.REGISTER_NO_PENDING
        )
    expected_challenge = pending_challenges[user.id]

    try:
        registration_verification = verify_registration_response(
            credential=response_data.credential,
            expected_challenge=base64url_to_bytes(expected_challenge),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
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
            public_key=registration_verification.credential_public_key.hex(),
            credential_id=registration_verification.credential_id.hex(),
            sign_count=0,
            registered_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(new_credential)
        db.commit()
        del pending_challenges[user.id]
        db.refresh(new_credential)
        logger.info(
            Logs.CREDENTIAL_ADDED.format(
                user_id=new_credential.user_id, credential_id=new_credential.id
            )
        )
        return new_credential
    except Exception as e:
        logger.error(Logs.REGISTER_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=Messages.REGISTER_VERIFY_FAILED,
        )


# Authentication
@app.post("/auth/authentication/options")
def authentication_options(
    options_data: AuthenticationOptionsBase, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == options_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=Messages.USER_NOT_FOUND
        )

    options = generate_authentication_options(
        rp_id=RP_ID,
        timeout=60000,
    )

    pending_challenges[user.id] = options.challenge
    return options_to_json(options)


@app.post("/auth/authentication/verify")
def authentication_verify(
    response_data: AuthenticationResponseBase, db: Session = Depends(get_db)
):
    session = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.id == response_data.session_id)
        .first()
    )
    user = db.query(User).filter(User.id == response_data.user_id).first()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_SESSION_NOT_FOUND,
        )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=Messages.AUTH_VERIFY_USER_NOT_FOUND,
        )
    if user.id not in pending_challenges:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=Messages.AUTH_NO_PENDING
        )
    expected_challenge = pending_challenges[user.id]
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
            expected_challenge=base64url_to_bytes(expected_challenge),
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
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
            timestamp=datetime.datetime.now(datetime.timezone.utc),
            verification_methods=response_data.verification_methods,
            status=AttendanceRecordStatus.PRESENT,
        )
        db.add(new_record)
        db.commit()
        del pending_challenges[user.id]
        db.refresh(new_record)
        logger.info(
            Logs.RECORD_ADDED.format(
                user_id=new_record.user_id, record_id=new_record.id
            )
        )
        return new_record
    except Exception as e:
        logger.error(Logs.AUTH_VERIFY_FAILED.format(error=str(e)))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=Messages.AUTH_VERIFY_FAILED
        )
