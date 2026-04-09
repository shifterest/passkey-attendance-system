from datetime import date, datetime, time
from enum import Enum

from api.contracts.device import DeviceBindingFlow, DevicePayloadVersion
from api.strings import Messages
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)
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
    program: str | None = None
    year_level: int | None = None
    enrollment_year: int | None = None


class UserCreate(UserBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    pass


class UserUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    role: UserRole | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    school_id: str | None = None
    program: str | None = None
    year_level: int | None = None
    enrollment_year: int | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    registered: bool = False


class UserStudentResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    ongoing_class: str | None = None
    in_class: bool
    records: int
    flagged: int
    low_assurance: int = 0
    enrollments: int
    registered: bool


class UserTeacherResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    class_count: int
    student_count: int
    has_open_session: bool
    registered: bool
    default_policy: "ClassPolicyResponse | None" = None


# Credentials
class CredentialBase(BaseModel):
    user_id: str
    device_public_key: str
    public_key: str
    credential_id: str
    sign_count: int
    key_security_level: str | None = None
    attestation_cert_serial: str | None = None
    registered_at: datetime


class CredentialCreate(CredentialBase):
    model_config = ConfigDict(extra="forbid")

    pass


class CredentialUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sign_count: int | None = None


class CredentialResponse(CredentialBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sign_count_anomaly: bool


# Class policies
class ClassPolicyBase(BaseModel):
    class_id: str | None = None
    standard_assurance_threshold: int = Field(default=5, ge=0)
    high_assurance_threshold: int = Field(default=9, ge=0)
    present_cutoff_minutes: int = Field(default=5, ge=0)
    late_cutoff_minutes: int = Field(default=15, ge=0)
    max_check_ins: int = Field(default=3, ge=1)


class ClassPolicyCreate(ClassPolicyBase):
    model_config = ConfigDict(extra="forbid")

    pass


class ClassPolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    standard_assurance_threshold: int | None = Field(default=None, ge=0)
    high_assurance_threshold: int | None = Field(default=None, ge=0)
    present_cutoff_minutes: int | None = Field(default=None, ge=0)
    late_cutoff_minutes: int | None = Field(default=None, ge=0)
    max_check_ins: int | None = Field(default=None, ge=1)


class ClassPolicyResponse(ClassPolicyBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: str | None = None


# Classes
class Schedule(BaseModel):
    days: list[
        Literal[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
    ] = Field(min_length=1)
    start_time: time
    end_time: time

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError(Messages.SCHEDULE_DAYS_DUPLICATE)
        return value

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError(Messages.SCHEDULE_END_TIME_INVALID)
        return self


class ClassBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    course_code: str
    course_name: str
    schedule: list[Schedule]
    standard_assurance_threshold: int = Field(default=5, ge=0)
    high_assurance_threshold: int = Field(default=9, ge=0)


class ClassCreate(ClassBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    teacher_id: str
    semester_id: str | None = None


class ClassUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    teacher_id: str | None = None
    semester_id: str | None = None
    course_code: str | None = None
    course_name: str | None = None
    schedule: list[Schedule] | None = None
    standard_assurance_threshold: int | None = Field(default=None, ge=0)
    high_assurance_threshold: int | None = Field(default=None, ge=0)


class ClassResponse(ClassBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    teacher_id: str
    semester_id: str | None = None


# Class enrollments
class ClassEnrollmentBase(BaseModel):
    class_id: str
    student_id: str
    expires_at: datetime | None = None
    enrolled_at: datetime | None = None


class ClassEnrollmentCreate(ClassEnrollmentBase):
    model_config = ConfigDict(extra="forbid")

    pass


class ClassEnrollmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str | None = None
    student_id: str | None = None
    expires_at: datetime | None = None


class ClassEnrollmentResponse(ClassEnrollmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


# Attendance sessions
class CheckInSessionBase(BaseModel):
    class_id: str
    event_id: str | None = None
    start_time: datetime
    end_time: datetime
    status: str
    present_cutoff_minutes: int = Field(default=5, ge=0)
    late_cutoff_minutes: int = Field(default=15, ge=0)


class CheckInSessionCreate(CheckInSessionBase):
    model_config = ConfigDict(extra="forbid")

    pass


class CheckInSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = None
    present_cutoff_minutes: int | None = Field(default=None, ge=0)
    late_cutoff_minutes: int | None = Field(default=None, ge=0)


class CheckInSessionResponse(CheckInSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


class OpenTeacherSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    teacher_id: str
    client_time: datetime | None = None


# Attendance records
class AttendanceRecordStatus(str, Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"


class AttendanceRecordVerificationMethods(str, Enum):
    DEVICE = "device"
    PASSKEY = "passkey"
    BLUETOOTH = "bluetooth"
    QR_PROXIMITY = "qr_proximity"
    PLAY_INTEGRITY = "play_integrity"
    GPS = "gps"
    NETWORK = "network"
    NFC = "nfc"
    MANUAL = "manual"


class AttendanceRecordBase(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    session_id: str
    user_id: str
    is_flagged: bool = False
    flag_reason: str | None = None
    manually_approved: bool = False
    manually_approved_by: str | None = None
    manually_approved_reason: str | None = None
    sync_pending: bool = False
    sync_escalated: bool = False
    network_anomaly: bool = False
    gps_is_mock: bool = False
    gps_in_geofence: bool | None = None
    timestamp: datetime
    verification_methods: list[str]
    assurance_score: int
    assurance_band_recorded: str | None = None
    standard_threshold_recorded: int | None = None
    high_threshold_recorded: int | None = None
    status: AttendanceRecordStatus


class AttendanceRecordCreate(AttendanceRecordBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    pass


class AttendanceRecordUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    is_flagged: bool | None = None
    flag_reason: str | None = None
    sync_pending: bool | None = None


class AttendanceRecordResponse(AttendanceRecordBase):
    model_config = ConfigDict(from_attributes=True)

    id: str


class ManualApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = None


class ManualAttendanceRequest(BaseModel):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    session_id: str
    student_id: str
    reason: str
    backdated_timestamp: datetime | None = None
    status: AttendanceRecordStatus | None = None


class AssuranceEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_ids: list[str] | None = None
    session_id: str | None = None
    canonical: bool = False
    standard_threshold: int | None = Field(default=None, ge=0)
    high_threshold: int | None = Field(default=None, ge=0)


class AssuranceEvaluateRowResponse(BaseModel):
    record_id: str
    user_id: str
    assurance_score: int
    assurance_band_recorded: str | None = None
    standard_threshold_recorded: int | None = None
    high_threshold_recorded: int | None = None
    assurance_band_current: str
    standard_threshold_current: int
    high_threshold_current: int
    policy_drift: bool


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    actor_id: str | None = None
    target_id: str | None = None
    detail: dict
    created_at: datetime


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
    session_id: str | None = None
    credential_id: str | None = None
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
    bluetooth_rssi_readings: list[int] | None = None
    ble_token: str | None = None
    nfc_token: str | None = None
    gps_latitude: float | None = None
    gps_longitude: float | None = None
    gps_is_mock: bool | None = None
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


# Semesters
class SemesterBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = False

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be later than start_date")
        return self


class SemesterCreate(SemesterBase):
    model_config = ConfigDict(extra="forbid")

    pass


class SemesterUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class SemesterResponse(SemesterBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


# Web login (QR-scanned login flow)
class WebLoginInitiateResponse(BaseModel):
    token: str
    url: str
    ttl: int
    poll_interval: int


class WebLoginVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    web_login_token: str
    user_id: str
    credential: dict
    device_signature: str
    device_public_key: str


class WebLoginPollResponse(BaseModel):
    status: str
    session: LoginSessionBase | None = None


# Play Integrity
class PlayIntegrityVouchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    integrity_token: str


# Audit event detail shapes
class CredentialKeyDetail(BaseModel):
    credential_id: str
    key_security_level: str | None = None


class CredentialRevokedDetail(BaseModel):
    credential_id: str
    old_value: CredentialKeyDetail


class DeviceKeyMismatchDetail(BaseModel):
    credential_id: str


class DeviceSignatureFailureDetail(BaseModel):
    credential_id: str


class SignCountAnomalyDetail(BaseModel):
    credential_id: str
    old_count: int
    new_count: int


class DeviceAttestationFailureDetail(BaseModel):
    reason: str


class DeviceAttestationVerifiedDetail(BaseModel):
    credential_id: str
    root_serial_hex: str
    is_legacy_root: bool
    key_security_level: str


class EnrollmentDeletedOldValue(BaseModel):
    student_id: str
    class_id: str


class EnrollmentDeletedDetail(BaseModel):
    old_value: EnrollmentDeletedOldValue


class ApprovalStateDetail(BaseModel):
    manually_approved: bool


class ManualApprovalDetail(BaseModel):
    reason: str | None = None
    record_user_id: str
    old_value: ApprovalStateDetail
    new_value: ApprovalStateDetail


class ManualAttendanceDetail(BaseModel):
    student_id: str
    session_id: str
    reason: str
    backdated_timestamp: str | None = None
    status: str | None = None


class UserRoleChange(BaseModel):
    role: str


class UserUpdatedDetail(BaseModel):
    updated_fields: list[str]
    old_value: UserRoleChange | None = None
    new_value: UserRoleChange | None = None


# Organizations
class OrgMembershipRuleType(str, Enum):
    ALL = "all"
    ROLE = "role"
    PROGRAM = "program"
    YEAR_LEVEL = "year_level"


class OrgMembershipType(str, Enum):
    EXPLICIT_GRANT = "explicit_grant"
    EXPLICIT_REVOCATION = "explicit_revocation"
    ROLE_ELEVATION = "role_elevation"


class OrgRole(str, Enum):
    MEMBER = "member"
    MODERATOR = "moderator"
    EVENT_CREATOR = "event_creator"
    ADMIN = "admin"


class OrganizationBase(BaseModel):
    name: str
    description: str | None = None


class OrganizationCreate(OrganizationBase):
    model_config = ConfigDict(extra="forbid")


class OrganizationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None


class OrganizationResponse(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: str | None = None
    created_at: datetime


class OrgMembershipRuleBase(BaseModel):
    rule_type: OrgMembershipRuleType
    rule_value: str | None = None
    rule_group: int | None = None


class OrgMembershipRuleCreate(OrgMembershipRuleBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")


class OrgMembershipRuleResponse(OrgMembershipRuleBase):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: str
    org_id: str


class OrgMembershipBase(BaseModel):
    membership_type: OrgMembershipType
    org_role: OrgRole | None = None
    expires_at: datetime | None = None


class OrgMembershipCreate(OrgMembershipBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")

    user_id: str


class OrgMembershipResponse(OrgMembershipBase):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: str
    org_id: str
    user_id: str
    granted_at: datetime
    granted_by: str | None = None


# Events
class EventAttendeeRuleType(str, Enum):
    ALL = "all"
    ROLE = "role"
    PROGRAM = "program"
    YEAR_LEVEL = "year_level"
    ORG_MEMBER = "org_member"


class EventBase(BaseModel):
    name: str
    description: str | None = None
    schedule: list[dict] = Field(default_factory=list)
    standard_assurance_threshold: int = 5
    high_assurance_threshold: int = 9
    play_integrity_enabled: bool = False
    max_check_ins: int = 3


class EventCreate(EventBase):
    model_config = ConfigDict(extra="forbid")


class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    schedule: list[dict] | None = None
    standard_assurance_threshold: int | None = None
    high_assurance_threshold: int | None = None
    play_integrity_enabled: bool | None = None
    max_check_ins: int | None = None


class EventResponse(EventBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    org_id: str
    created_by: str | None = None
    created_at: datetime


class EventAttendeeRuleBase(BaseModel):
    rule_type: EventAttendeeRuleType
    rule_value: str | None = None
    rule_group: int | None = None


class EventAttendeeRuleCreate(EventAttendeeRuleBase):
    model_config = ConfigDict(use_enum_values=True, extra="forbid")


class EventAttendeeRuleResponse(EventAttendeeRuleBase):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: str
    event_id: str


# Offline sync
class OfflineSyncRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    credential_id: str
    issued_at_ms: int
    device_signature: str
    device_public_key: str
    challenge: str


class OfflineSyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str
    opened_at: datetime
    closed_at: datetime
    nonce_set: list[str]
    records: list[OfflineSyncRecord]


class OfflineSyncRecordResult(BaseModel):
    user_id: str
    status: str
    record_id: str | None = None
    reason: str | None = None


class OfflineSyncResponse(BaseModel):
    session_id: str
    results: list[OfflineSyncRecordResult]
