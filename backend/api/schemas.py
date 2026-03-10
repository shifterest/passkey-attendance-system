from datetime import datetime, time
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr
from typing_extensions import Literal


# Users
class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"
    OPERATOR = "operator"


class UserBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    role: UserRole
    full_name: str
    email: EmailStr
    school_id: str | None = None


class UserCreate(UserBase):
    model_config = ConfigDict(use_enum_values=True)

    pass


class UserUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    role: UserRole | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    school_id: str | None = None


class UserResponse(UserBase):
    id: str

    class Config:
        from_attributes = True


class UserStudentResponse(UserBase):
    id: str
    ongoing_class: str | None = None
    in_class: bool
    records: int
    flagged: int
    enrollments: int
    registered: bool

    class Config:
        from_attributes = True


# Credentials
class CredentialBase(BaseModel):
    user_id: str
    device_id: str
    public_key: str
    credential_id: str
    sign_count: int
    registered_at: datetime


class CredentialCreate(CredentialBase):
    pass


class CredentialUpdate(BaseModel):
    user_id: str | None = None
    public_key: str | None = None
    credential_id: str | None = None
    sign_count: int | None = None
    registered_at: datetime | None = None


class CredentialResponse(CredentialBase):
    id: str

    class Config:
        from_attributes = True


# Classes
class Schedule(BaseModel):
    day: Literal[
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ]
    start_time: time
    end_time: time


class ClassBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    course_code: str
    course_name: str
    schedule: list[Schedule]


class ClassCreate(ClassBase):
    model_config = ConfigDict(use_enum_values=True)

    teacher_id: str


class ClassUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    teacher_id: str | None = None
    course_code: str | None = None
    course_name: str | None = None
    schedule: list[Schedule] | None = None


class ClassResponse(ClassBase):
    id: str
    teacher_id: str

    class Config:
        from_attributes = True


# Class enrollments
class ClassEnrollmentBase(BaseModel):
    class_id: str
    student_id: str


class ClassEnrollmentCreate(ClassEnrollmentBase):
    pass


class ClassEnrollmentUpdate(BaseModel):
    class_id: str | None = None
    student_id: str | None = None


class ClassEnrollmentResponse(ClassEnrollmentBase):
    id: str

    class Config:
        from_attributes = True


# Attendance sessions
class AttendanceSessionBase(BaseModel):
    class_id: str
    start_time: datetime
    end_time: datetime
    status: str
    dynamic_token: str


class AttendanceSessionCreate(AttendanceSessionBase):
    pass


class AttendanceSessionUpdate(BaseModel):
    class_id: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    dynamic_token: str | None = None


class AttendanceSessionResponse(AttendanceSessionBase):
    id: str

    class Config:
        from_attributes = True


# Attendance records
class AttendanceRecordStatus(str, Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"


class AttendanceRecordVerificationMethods(str, Enum):
    DEVICE = "device"
    PASSKEY = "passkey"
    BLUETOOTH = "bluetooth"
    NETWORK = "network"
    GPS = "gps"
    MANUAL = "manual"


class AttendanceRecordBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    user_id: str
    is_flagged: bool = False
    flag_reason: str | None = None
    timestamp: datetime
    verification_methods: list[AttendanceRecordVerificationMethods]
    assurance_score: int
    status: AttendanceRecordStatus


class AttendanceRecordCreate(AttendanceRecordBase):
    model_config = ConfigDict(use_enum_values=True)

    pass


class AttendanceRecordUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str | None = None
    user_id: str | None = None
    is_flagged: bool | None = None
    flag_reason: str | None = None
    timestamp: datetime | None = None
    verification_methods: list[AttendanceRecordVerificationMethods] | None = None
    status: AttendanceRecordStatus | None = None


class AttendanceRecordResponse(AttendanceRecordBase):
    id: str

    class Config:
        from_attributes = True


# Registration
class RegistrationOptionsBase(BaseModel):
    user_id: str
    registration_token: str


class RegistrationResponseBase(BaseModel):
    user_id: str
    registration_token: str
    device_signature: str
    credential: dict


class RegistrationSessionBase(BaseModel):
    user_id: str
    registration_token: str
    expires_in: int
    url: str


# Authentication
class AuthenticationOptionsBase(BaseModel):
    user_id: str


class AuthenticationResponseBase(BaseModel):
    user_id: str
    session_id: str
    credential: dict
    device_signature: str
    device_id: str


# Login
class LoginOptionsBase(BaseModel):
    user_id: str


class LoginResponseBase(BaseModel):
    user_id: str
    credential: dict


class LoginSessionBase(BaseModel):
    user_id: str
    session_token: str
    expires_in: int


# Logout
class LogoutOptionsBase(BaseModel):
    user_id: str
    session_token: str
