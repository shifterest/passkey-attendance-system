import datetime
from sqlalchemy import create_engine, ForeignKey, JSON
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

# Old crusty sqlite3 method
# try:
#     print("Attempting to connect to database...")
#     with sqlite3.connect("db/attendance.db") as conn:
#         cursor = conn.cursor()
#         print("Connected to database.")
#         with open("db/schema.sql", "r") as schema_file:
#             schema = schema_file.read()
#             print("Loaded schema.")
#             cursor.executescript(schema)
#             conn.commit()
#             print("Applied schema.")
# except:
#     print("Failed to connect to database.")

engine = create_engine("sqlite+pysqlite:///db/attendance.db", echo=True)


class Base(DeclarativeBase):
    pass


# Models
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    role: Mapped[str]
    full_name: Mapped[str]
    email: Mapped[str]
    school_id: Mapped[int]
    credentials: Mapped["Credential"] = relationship(back_populates="user")
    classes: Mapped[list["Class"]] = relationship(back_populates="members")
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="student"
    )


class Credential(Base):
    __tablename__ = "credentials"
    id: Mapped[str] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    public_key: Mapped[str]
    credential_id: Mapped[str]
    sign_count: Mapped[int]
    registered_at: Mapped[datetime.datetime]
    user: Mapped["User"] = relationship(back_populates="credentials")


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[str] = mapped_column(primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    course_code: Mapped[str]
    course_name: Mapped[str]
    # Stored as JSON string: [{"day": "Monday", "start_time": "10:00", "end_time": "11:30"}]
    schedule: Mapped[list[dict]] = mapped_column(JSON)
    members: Mapped[list["User"]] = relationship(back_populates="classes")
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="enrolled_class"
    )
    attendance_sessions: Mapped[list["AttendanceSession"]] = relationship(
        back_populates="attended_class"
    )


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    enrolled_class: Mapped["Class"] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship(back_populates="classes")


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    start_time: Mapped[datetime.datetime]
    end_time: Mapped[datetime.datetime]
    status: Mapped[str]
    dynamic_token: Mapped[str]
    attended_class: Mapped["Class"] = relationship(back_populates="attendance_sessions")
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[str] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("attendance_sessions.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    timestamp: Mapped[datetime.datetime]
    verification_methods: Mapped[str]
    status: Mapped[str]
    session: Mapped["AttendanceSession"] = relationship(back_populates="records")


Base.metadata.create_all(bind=engine)
session = sessionmaker(bind=engine)


def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()
