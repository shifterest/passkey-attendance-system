from datetime import datetime, time
from enum import Enum

from api.contracts.device import DeviceBindingFlow, DevicePayloadVersion
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
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    pass


class UserUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    role: UserRole | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    school_id: str | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


class UserStudentResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ongoing_class: str | None = None
    in_class: bool
    records: int
    flagged: int
    enrollments: int
    registered: bool


# Credentials
class CredentialBase(BaseModel):
    user_id: str
    device_public_key: str
    public_key: str
    credential_id: str
    sign_count: int
    registered_at: datetime


class CredentialCreate(CredentialBase):
    model_config = ConfigDict(extra="forbid")

    pass


class CredentialUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str | None = None
    public_key: str | None = None
    credential_id: str | None = None
    sign_count: int | None = None
    registered_at: datetime | None = None


class CredentialResponse(CredentialBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


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
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    teacher_id: str


class ClassUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    teacher_id: str | None = None
    course_code: str | None = None
    course_name: str | None = None
    schedule: list[Schedule] | None = None


class ClassResponse(ClassBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    teacher_id: str


# Class enrollments
class ClassEnrollmentBase(BaseModel):
    class_id: str
    student_id: str


class ClassEnrollmentCreate(ClassEnrollmentBase):
    model_config = ConfigDict(extra="forbid")

    pass


class ClassEnrollmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str | None = None
    student_id: str | None = None


class ClassEnrollmentResponse(ClassEnrollmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


# Attendance sessions
class CheckInSessionBase(BaseModel):
    class_id: str
    start_time: datetime
    end_time: datetime
    status: str
    dynamic_token: str


class CheckInSessionCreate(CheckInSessionBase):
    model_config = ConfigDict(extra="forbid")

    pass


class CheckInSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    dynamic_token: str | None = None


class CheckInSessionResponse(CheckInSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


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
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    pass


class AttendanceRecordUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    session_id: str | None = None
    user_id: str | None = None
    is_flagged: bool | None = None
    flag_reason: str | None = None
    timestamp: datetime | None = None
    verification_methods: list[AttendanceRecordVerificationMethods] | None = None
    status: AttendanceRecordStatus | None = None


class AttendanceRecordResponse(AttendanceRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


# Registration
class RegistrationOptionsBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    registration_token: str


class RegistrationResponseBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    registration_token: str
    device_signature: str
    device_public_key: str
    credential: dict


class RegistrationSessionBase(BaseModel):
    user_id: str
    registration_token: str
    created_at: datetime
    expires_at: datetime
    expires_in: int
    url: str


class DeviceBindingPayload(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    v: DevicePayloadVersion
    flow: DeviceBindingFlow
    user_id: str
    session_id: str | None
    credential_id: str | None
    challenge: str
    issued_at_ms: int


# Check-in
class CheckInOptionsBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str


class CheckInResponseBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    session_id: str
    credential: dict
    device_signature: str
    device_public_key: str


# Login
class LoginOptionsBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str


class LoginResponseBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    credential: dict
    device_signature: str
    device_public_key: str


class LoginSessionBase(BaseModel):
    user_id: str
    session_token: str
    created_at: datetime
    expires_at: datetime
    expires_in: int


# Logout
class LogoutOptionsBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    session_token: str
