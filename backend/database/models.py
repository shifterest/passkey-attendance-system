from datetime import date, datetime
from typing import Any

from database.connection import Base
from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    role: Mapped[str]
    full_name: Mapped[str]
    email: Mapped[str]
    school_id: Mapped[str | None] = mapped_column(None)
    program: Mapped[str | None] = mapped_column(None)
    year_level: Mapped[int | None] = mapped_column(None)
    enrollment_year: Mapped[int | None] = mapped_column(None)
    credentials: Mapped[list["Credential"]] = relationship(back_populates="user")
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
    sign_count_anomaly: Mapped[bool] = mapped_column(default=False)
    key_security_level: Mapped[str | None] = mapped_column(None)
    attestation_crl_verified: Mapped[bool | None] = mapped_column(None)
    attestation_cert_serial: Mapped[str | None] = mapped_column(None)
    registered_at: Mapped[datetime]
    user: Mapped["User"] = relationship(back_populates="credentials")


class ClassPolicy(Base):
    __tablename__ = "class_policies"
    id: Mapped[str] = mapped_column(primary_key=True)
    created_by: Mapped[str | None] = mapped_column(None)
    class_id: Mapped[str | None] = mapped_column(ForeignKey("classes.id"), default=None)
    standard_assurance_threshold: Mapped[int] = mapped_column(default=5)
    high_assurance_threshold: Mapped[int] = mapped_column(default=9)
    present_cutoff_minutes: Mapped[int] = mapped_column(default=5)
    late_cutoff_minutes: Mapped[int] = mapped_column(default=15)
    max_check_ins: Mapped[int] = mapped_column(default=3)
    class_: Mapped["Class | None"] = relationship(
        back_populates="policies", foreign_keys="[ClassPolicy.class_id]"
    )


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[str] = mapped_column(primary_key=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    semester_id: Mapped[str | None] = mapped_column(
        ForeignKey("semesters.id"), default=None
    )
    course_code: Mapped[str]
    course_name: Mapped[str]
    schedule: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    standard_assurance_threshold: Mapped[int] = mapped_column(default=5)
    high_assurance_threshold: Mapped[int] = mapped_column(default=9)
    teacher: Mapped["User"] = relationship(back_populates="classes")
    semester: Mapped["Semester | None"] = relationship(back_populates="classes")
    policies: Mapped[list["ClassPolicy"]] = relationship(
        back_populates="class_", foreign_keys="[ClassPolicy.class_id]"
    )
    enrollments: Mapped[list["ClassEnrollment"]] = relationship(
        back_populates="enrolled_class"
    )
    check_in_sessions: Mapped[list["CheckInSession"]] = relationship(
        back_populates="attended_class"
    )


class Semester(Base):
    __tablename__ = "semesters"
    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    start_date: Mapped[date]
    end_date: Mapped[date]
    is_active: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime]
    classes: Mapped[list["Class"]] = relationship(back_populates="semester")


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime | None] = mapped_column(None)
    enrolled_at: Mapped[datetime | None] = mapped_column(None)
    enrolled_class: Mapped["Class"] = relationship(back_populates="enrollments")
    student: Mapped["User"] = relationship(back_populates="enrollments")


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str | None] = mapped_column(None)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime]
    membership_rules: Mapped[list["OrganizationMembershipRule"]] = relationship(
        back_populates="organization"
    )
    memberships: Mapped[list["OrganizationMembership"]] = relationship(
        back_populates="organization"
    )


class OrganizationMembershipRule(Base):
    __tablename__ = "organization_membership_rules"
    id: Mapped[str] = mapped_column(primary_key=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    rule_type: Mapped[str]
    rule_value: Mapped[str | None] = mapped_column(None)
    rule_group: Mapped[int | None] = mapped_column(None)
    organization: Mapped["Organization"] = relationship(
        back_populates="membership_rules"
    )


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    id: Mapped[str] = mapped_column(primary_key=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    membership_type: Mapped[str]
    org_role: Mapped[str | None] = mapped_column(None)
    granted_at: Mapped[datetime]
    expires_at: Mapped[datetime | None] = mapped_column(None)
    granted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    organization: Mapped["Organization"] = relationship(back_populates="memberships")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id: Mapped[str] = mapped_column(primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("check_in_sessions.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    is_flagged: Mapped[bool]
    flag_reason: Mapped[str | None] = mapped_column(None)
    manually_approved: Mapped[bool] = mapped_column(default=False)
    manually_approved_by: Mapped[str | None] = mapped_column(None)
    manually_approved_reason: Mapped[str | None] = mapped_column(None)
    sync_pending: Mapped[bool] = mapped_column(default=False)
    sync_escalated: Mapped[bool] = mapped_column(default=False)
    network_anomaly: Mapped[bool] = mapped_column(default=False)
    gps_is_mock: Mapped[bool] = mapped_column(default=False)
    gps_in_geofence: Mapped[bool | None] = mapped_column(None)
    timestamp: Mapped[datetime]
    verification_methods: Mapped[list[str]] = mapped_column(JSON)
    assurance_score: Mapped[int]
    assurance_band_recorded: Mapped[str | None] = mapped_column(None)
    standard_threshold_recorded: Mapped[int | None] = mapped_column(None)
    high_threshold_recorded: Mapped[int | None] = mapped_column(None)
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
    client_type: Mapped[str] = mapped_column(default="app")
    created_at: Mapped[datetime]
    expires_at: Mapped[datetime]
    last_activity_at: Mapped[datetime | None] = mapped_column(None)
    user: Mapped["User"] = relationship(back_populates="login_sessions")


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(primary_key=True)
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str]
    description: Mapped[str | None] = mapped_column(None)
    schedule: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    standard_assurance_threshold: Mapped[int] = mapped_column(default=5)
    high_assurance_threshold: Mapped[int] = mapped_column(default=9)
    play_integrity_enabled: Mapped[bool] = mapped_column(default=False)
    max_check_ins: Mapped[int] = mapped_column(default=3)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), default=None)
    created_at: Mapped[datetime]
    attendee_rules: Mapped[list["EventAttendeeRule"]] = relationship(
        back_populates="event"
    )
    check_in_sessions: Mapped[list["CheckInSession"]] = relationship(
        back_populates="event", foreign_keys="[CheckInSession.event_id]"
    )


class EventAttendeeRule(Base):
    __tablename__ = "event_attendee_rules"
    id: Mapped[str] = mapped_column(primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"))
    rule_type: Mapped[str]
    rule_value: Mapped[str | None] = mapped_column(None)
    rule_group: Mapped[int | None] = mapped_column(None)
    event: Mapped["Event"] = relationship(back_populates="attendee_rules")


class CheckInSession(Base):
    __tablename__ = "check_in_sessions"
    id: Mapped[str] = mapped_column(primary_key=True)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id"))
    event_id: Mapped[str | None] = mapped_column(ForeignKey("events.id"), default=None)
    start_time: Mapped[datetime]
    end_time: Mapped[datetime]
    status: Mapped[str]
    present_cutoff_minutes: Mapped[int] = mapped_column(default=5)
    late_cutoff_minutes: Mapped[int] = mapped_column(default=15)
    attended_class: Mapped["Class"] = relationship(back_populates="check_in_sessions")
    event: Mapped["Event | None"] = relationship(
        back_populates="check_in_sessions", foreign_keys="[CheckInSession.event_id]"
    )
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(primary_key=True)
    event_type: Mapped[str]
    actor_id: Mapped[str | None] = mapped_column(None)
    target_id: Mapped[str | None] = mapped_column(None)
    detail: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime]
