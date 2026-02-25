import fastapi
from fastapi import Depends
from sqlalchemy.orm import Session
from db.database import *
import uuid


app = fastapi.FastAPI()


# === Helper functions ===
def check_verification_methods(verification_methods: str):
    valid_methods = ["fido2", "bluetooth", "wifi", "gps", "manual"]
    methods = verification_methods.split(",")
    for method in methods:
        if method.strip() not in valid_methods:
            return False
    return True


# === Endpoints ===
@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Users
@app.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users


@app.get("/users/{user_id}")
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return {"message": "User not found"}
    return user


@app.post("/users")
def create_user(user_data: dict, db: Session = Depends(get_db)):
    if user_data["role"] not in ["Student", "Teacher", "Admin"]:
        return {"message": "Error adding user: invalid role"}
    new_uuid = str(uuid.uuid4())
    while True:
        user = db.query(User).filter(User.id == new_uuid).first()
        if user is None:
            break
        new_uuid = str(uuid.uuid4())
    new_user = User(
        id=new_uuid,
        role=user_data["role"],
        full_name=user_data["full_name"],
        email=user_data["email"],
        school_id=user_data["school_id"],
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(f"Added user: {new_user.full_name} (ID: {new_user.id})")
    return new_user


@app.put("/users/{user_id}")
def update_user(user_id: str, updated_data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return {"message": "User not found"}
    for key, value in updated_data.items():
        setattr(user, key, value)
    db.commit()
    print(f"Edited user: {user.full_name} (ID: {user.id})")
    return user


@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return {"message": "User not found"}
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


# Credentials
@app.get("/credentials")
def get_all_credentials(db: Session = Depends(get_db)):
    credentials = db.query(Credential).all()
    return credentials


@app.get("/credentials/by-user/{user_id}")
def get_all_credentials_by_user(user_id: str, db: Session = Depends(get_db)):
    credentials = db.query(Credential).filter(Credential.user_id == user_id).all()
    return credentials


@app.get("/credentials/{credential_id}")
def get_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        return {"message": "Credential not found"}
    return credential


@app.post("/credentials")
def create_credential(credential_data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == credential_data["user_id"]).first()
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
        user_id=credential_data["user_id"],
        public_key=credential_data["public_key"],
        credential_id=credential_data["credential_id"],
        sign_count=0,
        registered_at=datetime.datetime.utcnow(),
    )
    db.add(new_credential)
    db.commit()
    db.refresh(new_credential)
    print(
        f"Added credential for user {new_credential.user_id} (ID: {new_credential.id})"
    )
    return new_credential


@app.put("/credentials/{credential_id}")
def update_credential(
    credential_id: str, updated_data: dict, db: Session = Depends(get_db)
):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        return {"message": "Credential not found"}
    for key, value in updated_data.items():
        setattr(credential, key, value)
    db.commit()
    print(f"Edited credential: {credential.credential_id} (ID: {credential.id})")
    return credential


@app.delete("/credentials/{credential_id}")
def delete_credential(credential_id: str, db: Session = Depends(get_db)):
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if credential is None:
        return {"message": "Credential not found"}
    db.delete(credential)
    db.commit()
    return {"message": "Credential deleted"}


# Classes
@app.get("/classes")
def get_all_classes(db: Session = Depends(get_db)):
    classes = db.query(Class).all()
    return classes


@app.get("/classes/by-teacher/{teacher_id}")
def get_all_classes_by_teacher(teacher_id: str, db: Session = Depends(get_db)):
    classes = db.query(Class).filter(Class.teacher_id == teacher_id).all()
    return classes


@app.get("/classes/{class_id}")
def get_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        return {"message": "Class not found"}
    return class_


@app.post("/classes")
def create_class(class_data: dict, db: Session = Depends(get_db)):
    teacher = db.query(User).filter(User.id == class_data["teacher_id"]).first()
    if teacher is None:
        return {"message": "Error adding class: teacher not found"}
    if teacher.role != "Teacher":
        return {"message": "Error adding class: teacher has invalid role"}
    new_uuid = str(uuid.uuid4())
    while True:
        class_ = db.query(Class).filter(Class.id == new_uuid).first()
        if class_ is None:
            break
        new_uuid = str(uuid.uuid4())
    new_class = Class(
        id=new_uuid,
        teacher_id=class_data["teacher_id"],
        course_code=class_data["course_code"],
        course_name=class_data["course_name"],
        schedule=class_data["schedule"],
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    print(f"Added class: {new_class.course_name} (Code: {new_class.course_code})")
    return new_class


@app.put("/classes/{class_id}")
def update_class(class_id: str, updated_data: dict, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        return {"message": "Class not found"}
    for key, value in updated_data.items():
        setattr(class_, key, value)
    db.commit()
    print(f"Edited class: {class_.course_name} (Code: {class_.course_code})")
    return class_


@app.delete("/classes/{class_id}")
def delete_class(class_id: str, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == class_id).first()
    if class_ is None:
        return {"message": "Class not found"}
    db.delete(class_)
    db.commit()
    return {"message": "Class deleted"}


# Class enrollments
@app.get("/enrollments")
def get_all_enrollments(db: Session = Depends(get_db)):
    enrollments = db.query(ClassEnrollment).all()
    return enrollments


@app.get("/enrollments/by-class/{class_id}")
def get_enrollments_by_class(class_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.class_id == class_id).all()
    )
    return enrollments


@app.get("/enrollments/by-student/{student_id}")
def get_enrollments_by_student(student_id: str, db: Session = Depends(get_db)):
    enrollments = (
        db.query(ClassEnrollment).filter(ClassEnrollment.student_id == student_id).all()
    )
    return enrollments


@app.get("/enrollments/by-class/{class_id}/by-student/{student_id}/")
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
        return {"message": "Enrollment not found"}
    return enrollment


@app.post("/enrollments")
def create_enrollment(enrollment_data: dict, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == enrollment_data["class_id"]).first()
    student = db.query(User).filter(User.id == enrollment_data["student_id"]).first()
    if class_ is None:
        return {"message": "Error adding enrollment: class not found"}
    if student is None:
        return {"message": "Error adding enrollment: student not found"}
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
        class_id=enrollment_data["class_id"],
        student_id=enrollment_data["student_id"],
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    print(
        f"Added enrollment for student {student.full_name} in class {class_.course_name} (ID: {new_enrollment.id})"
    )
    return new_enrollment


@app.put("/enrollments/{enrollment_id}")
def update_enrollment(
    enrollment_id: str, updated_data: dict, db: Session = Depends(get_db)
):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        return {"message": "Enrollment not found"}
    for key, value in updated_data.items():
        setattr(enrollment, key, value)
    db.commit()
    print(f"Edited enrollment (ID: {enrollment.id})")
    return enrollment


@app.delete("/enrollments/{enrollment_id}")
def delete_enrollment(enrollment_id: str, db: Session = Depends(get_db)):
    enrollment = (
        db.query(ClassEnrollment).filter(ClassEnrollment.id == enrollment_id).first()
    )
    if enrollment is None:
        return {"message": "Enrollment not found"}
    db.delete(enrollment)
    db.commit()
    return {"message": "Enrollment deleted"}


# Attendance sessions
@app.get("/sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    sessions = db.query(AttendanceSession).all()
    return sessions


@app.get("/sessions/by-class/{class_id}")
def get_sessions_by_class(class_id: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(AttendanceSession).filter(AttendanceSession.class_id == class_id).all()
    )
    return sessions


@app.get("/sessions/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        return {"message": "Session not found"}
    return session


@app.post("/sessions")
def create_session(session_data: dict, db: Session = Depends(get_db)):
    class_ = db.query(Class).filter(Class.id == session_data["class_id"]).first()
    if class_ is None:
        return {"message": "Error adding session: class not found"}
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
        class_id=session_data["class_id"],
        start_time=session_data["start_time"],
        end_time=session_data["end_time"],
        status=session_data["status"],
        dynamic_token=session_data["dynamic_token"],
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    print(f"Added session: {new_session.id}")
    return new_session


@app.put("/sessions/{session_id}")
def update_session(session_id: str, updated_data: dict, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        return {"message": "Session not found"}
    for key, value in updated_data.items():
        setattr(session, key, value)
    db.commit()
    print(f"Edited session: {session.id}")
    return session


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session = (
        db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    )
    if session is None:
        return {"message": "Session not found"}
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}


# Attendance records
@app.get("/records")
def get_all_records(db: Session = Depends(get_db)):
    records = db.query(AttendanceRecord).all()
    return records


@app.get("/records/by-session/{session_id}")
def get_records_by_session(session_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.session_id == session_id)
        .all()
    )
    return records


@app.get("/records/by-user/{user_id}")
def get_records_by_user(user_id: str, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord).filter(AttendanceRecord.user_id == user_id).all()
    )
    return records


@app.get("/records/by-session/{session_id}/by-user/{user_id}/")
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


@app.get("/records/{record_id}")
def get_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        return {"message": "Record not found"}
    return record


@app.post("/records")
def create_record(record_data: dict, db: Session = Depends(get_db)):
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
    if not check_verification_methods(record_data["verification_methods"]):
        return {"message": "Error adding record: invalid verification methods"}
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
    print(f"Added record: {new_record.id}")
    return new_record


@app.put("/records/{record_id}")
def update_record(record_id: str, updated_data: dict, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        return {"message": "Record not found"}
    for key, value in updated_data.items():
        setattr(record, key, value)
    db.commit()
    print(f"Edited record: {record.id}")
    return record


@app.delete("/records/{record_id}")
def delete_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if record is None:
        return {"message": "Record not found"}
    db.delete(record)
    db.commit()
    return {"message": "Record deleted"}
