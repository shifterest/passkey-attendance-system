from pydantic import BaseModel


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
    reason: str | None
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
