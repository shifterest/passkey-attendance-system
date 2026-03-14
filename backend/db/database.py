import logging
from datetime import datetime

from api.config import settings
from sqlalchemy import JSON, ForeignKey, create_engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

logger = logging.getLogger(__name__)

# Old crusty sqlite3 method
# try:
#     logger.info("Attempting to connect to database...")
#     with sqlite3.connect("db/attendance.db") as conn:
#         cursor = conn.cursor()
#         logger.info("Connected to database.")
#         with open("db/schema.sql", "r") as schema_file:
#             schema = schema_file.read()
#             logger.info("Loaded schema.")
#             cursor.executescript(schema)
#             conn.commit()
#             logger.info("Applied schema.")
# except:
#     logger.info("Failed to connect to database.")

engine = create_engine(settings.database_url, echo=True)


class Base(DeclarativeBase):
    pass


# Models
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    role: Mapped[str]
    full_name: Mapped[str]
    email: Mapped[str]
    school_id: Mapped[str | None] = mapped_column(None)
    credentials: Mapped["Credential"] = relationship(back_populates="user")
    classes: Mapped[list["Class"]] = relationship(
        back_populates="teacher", foreign_keys="[Class.teacher_id]"
    )
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="student"
    )
    registration_sessions: Mapped[list["RegistrationSession"]] = relationship(
        back_populates="user"
    )
    login_sessions: Mapped[list["LoginSession"]] = relationship(back_populates="user")


class Credential(Base):
    __tablename__ = "credentials"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    device_public_key: Mapped[str]
    public_key: Mapped[str]
    credential_id: Mapped[str]
    sign_count: Mapped[int]
    registered_at: Mapped[datetime]
    user: Mapped["User"] = relationship(back_populates="credentials")


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[str] = mapped_column(primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    course_code: Mapped[str]
    course_name: Mapped[str]
    # Stored as JSON string: [{"day": "Monday", "start_time": "10:00", "end_time": "11:30"}]
    schedule: Mapped[list[dict]] = mapped_column(JSON)
    teacher: Mapped["User"] = relationship(back_populates="classes")
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="enrolled_class"
    )
    check_in_sessions: Mapped[list["CheckInSession"]] = relationship(
        back_populates="attended_class"
    )


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    enrolled_class: Mapped["Class"] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship(back_populates="enrollments")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[str] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("check_in_sessions.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    is_flagged: Mapped[bool]
    flag_reason: Mapped[str | None] = mapped_column(None)
    timestamp: Mapped[datetime]
    verification_methods: Mapped[list[str]] = mapped_column(JSON)
    assurance_score: Mapped[int]
    status: Mapped[str]
    session: Mapped["CheckInSession"] = relationship(back_populates="records")


class RegistrationSession(Base):
    __tablename__ = "registration_sessions"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    user: Mapped["User"] = relationship(back_populates="registration_sessions")


class LoginSession(Base):
    __tablename__ = "login_sessions"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    last_activity_at: Mapped[datetime | None] = mapped_column(None)
    user: Mapped["User"] = relationship(back_populates="login_sessions")


class CheckInSession(Base):
    __tablename__ = "check_in_sessions"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]
    status: Mapped[str]
    dynamic_token: Mapped[str]
    attended_class: Mapped["Class"] = relationship(back_populates="check_in_sessions")
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


Base.metadata.create_all(bind=engine)
session = sessionmaker(bind=engine)


def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()
