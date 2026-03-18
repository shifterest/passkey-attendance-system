---
description: "Use when implementing or reviewing SQLAlchemy models, database schema, model relationships, field semantics, or migration planning for the passkey attendance system."
name: "Data Model Reference"
---
# Data Model Reference

All models live in `backend/database/models.py`. The ORM is SQLAlchemy with `Mapped`/`mapped_column` declarative style. The `Base` is imported from `database.connection`. IDs are `uuid.uuid4()` strings at creation time. SQLite is the default database; PostgreSQL is supported via `DATABASE_URL` env swap.

---

## Model Map

```
User
 ├─ credentials: list[Credential]
 ├─ classes: list[Class]           (teacher_id FK; classes taught)
 ├─ enrollments: list[ClassEnrollment]
 ├─ registration_sessions: list[RegistrationSession]
 └─ login_sessions: list[LoginSession]

Class
 ├─ teacher: User
 ├─ policies: list[ClassPolicy]
 ├─ enrollments: list[ClassEnrollment]
 └─ check_in_sessions: list[CheckInSession]

ClassEnrollment
 ├─ enrolled_class: Class
 └─ student: User

ClassPolicy
 └─ class_: Class | None

CheckInSession
 ├─ attended_class: Class
 └─ records: list[AttendanceRecord]

AttendanceRecord
 └─ session: CheckInSession

Credential
 └─ user: User

RegistrationSession
 └─ user: User

LoginSession
 └─ user: User

AuditEvent        (no ORM relationships; self-contained)
```

---

## User

**Table:** `users`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `role` | `str` | One of: `student`, `teacher`, `admin`, `operator` |
| `full_name` | `str` | Display name |
| `email` | `str` | |
| `school_id` | `str \| None` | External student/employee ID; optional |

**Role semantics:**
- `student` — can check in; can see own records; cannot manage classes or users
- `teacher` — can open/close sessions; can see own classes and enrolled students; cannot manage users
- `admin` — full read/write on all resources; can create users and register passkeys
- `operator` — same as admin for API access; intended for service accounts

A user can hold only **one role**. The deferred Organizations model allows a single person to hold org-level roles simultaneously — see `organizations-events.instructions.md`.

---

## Credential

**Table:** `credentials`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `user_id` | `str` FK → `users.id` | |
| `device_public_key` | `str` | Base64 DER-encoded ECDSA P-256 public key from Android Keystore |
| `public_key` | `str` | WebAuthn credential public key (CBOR-encoded, stored as base64) |
| `credential_id` | `str` | WebAuthn credential ID (base64url) |
| `sign_count` | `int` | Last verified WebAuthn sign count |
| `sign_count_anomaly` | `bool` | `True` if backend detected a sign count regression (possible cloned authenticator) |
| `key_security_level` | `str \| None` | `strongbox`, `tee`, or `None` if not yet determined |
| `attestation_crl_verified` | `bool \| None` | `None` = not yet checked; `True` = clean; `False` = revoked |
| `registered_at` | `datetime` | UTC |

**Invariant:** only one active credential per user by default (`MAX_ACTIVE_CREDENTIALS_PER_USER` config). Admin can revoke + re-register to replace a lost device.

---

## Class

**Table:** `classes`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `teacher_id` | `str` FK → `users.id` | Must have role `teacher` |
| `course_code` | `str` | e.g. `CS101` |
| `course_name` | `str` | e.g. `Introduction to Computing` |
| `schedule` | `list[dict]` (JSON) | List of schedule blocks — see below |
| `standard_assurance_threshold` | `int` | Default 5; see `assurance-scoring.instructions.md` |
| `high_assurance_threshold` | `int` | Default 9; see `assurance-scoring.instructions.md` |

**Schedule block shape:**
```json
{
  "days": ["Monday", "Wednesday"],
  "start_time": "08:00:00",
  "end_time": "09:30:00"
}
```
`days` enum values: `Monday Tuesday Wednesday Thursday Friday Saturday Sunday`. Duplicate days in one block are rejected. `end_time` must be after `start_time`. A class can have multiple blocks (e.g. lecture + lab). Schedule matching at session open compares current UTC-adjusted server time (using `SERVER_TIMEZONE`) against all blocks.

---

## ClassPolicy

**Table:** `class_policies`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `created_by` | `str \| None` | User ID of creating teacher or admin |
| `class_id` | `str \| None` FK → `classes.id` | Null = deployment default policy; non-null = class-scoped override |
| `standard_assurance_threshold` | `int` | Default 5 |
| `high_assurance_threshold` | `int` | Default 9 |
| `present_cutoff_minutes` | `int` | Default 5 |
| `late_cutoff_minutes` | `int` | Default 15 |
| `max_check_ins` | `int` | Default 3 |

**Two-tier inheritance:** A null-`class_id` policy is the deployment default for class-specific thresholds and timing. A class-scoped policy overrides the default for that class. Only one policy per (creator, class_id) pair is allowed. The `Class` model also directly stores `standard_assurance_threshold` and `high_assurance_threshold` — these are the authoritative values used at band computation time; `ClassPolicy` thresholds are an override input. Play Integrity and Android Key Attestation enforcement are deployment-level config, not per-class fields.

---

## ClassEnrollment

**Table:** `class_enrollments`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `class_id` | `str` FK → `classes.id` | |
| `student_id` | `str` FK → `users.id` | Must have role `student` |

Uniqueness: one enrollment per (class_id, student_id) pair enforced in the route layer (409 on duplicate). Enrollment is checked at check-in options time; missing enrollment → rejected before a challenge is issued.

---

## CheckInSession

**Table:** `check_in_sessions`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `class_id` | `str` FK → `classes.id` | |
| `start_time` | `datetime` | UTC; when teacher opened the window |
| `end_time` | `datetime` | UTC; `start_time + late_cutoff_minutes` |
| `status` | `str` | `open` or `closed` |
| `present_cutoff_minutes` | `int` | Default 5; copied from policy at session open time |
| `late_cutoff_minutes` | `int` | Default 15; copied from policy at session open time |

**Status semantics:** `open` allows new check-in attempts. `closed` makes the window immutable. After close, attendance status on all records for this session becomes immutable. Only one `open` session per class at a time (enforced in route layer).

**BLE nonce storage:** the live BLE nonce is stored in Redis at `ble_token:{session_id}` with TTL controlled by deployment config (`BLE_TOKEN_TTL_SECONDS`, default 30). It is not stored on the SQL row.

**Session window:** `status` transitions from `open` → `closed` when the teacher explicitly closes it, or when the late cutoff elapses (the system does not auto-close — the teacher must close manually or via the dashboard). Within one active schedule block, the first opened session is treated as the attendance window; any later sessions are implicit presence checks. No stored `session_type` field exists.

---

## AttendanceRecord

**Table:** `attendance_records`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `session_id` | `str` FK → `check_in_sessions.id` | |
| `user_id` | `str` FK → `users.id` | |
| `is_flagged` | `bool` | Manual teacher flag only — never auto-set |
| `flag_reason` | `str \| None` | Free-text reason for flag |
| `manually_approved` | `bool` | Teacher override; does not change assurance_score |
| `manually_approved_by` | `str \| None` | User ID of approving teacher/admin |
| `manually_approved_reason` | `str \| None` | Optional reason |
| `sync_pending` | `bool` | `True` for offline QR records until device signature verified on sync |
| `network_anomaly` | `bool` | Source IP did not match `SCHOOL_SUBNET_CIDR` at options time |
| `gps_is_mock` | `bool` | `Position.isMocked` as reported by device |
| `gps_in_geofence` | `bool \| None` | `None` if geofence not configured; `True/False` when evaluated |
| `timestamp` | `datetime` | UTC; time of check-in attempt |
| `verification_methods` | `list[str]` (JSON) | Evidence array — see method tokens below |
| `assurance_score` | `int` | Proximity-only effective score |
| `assurance_band_recorded` | `str \| None` | `low`, `standard`, or `high`; band at write time |
| `standard_threshold_recorded` | `int \| None` | Threshold snapshot at write time |
| `high_threshold_recorded` | `int \| None` | Threshold snapshot at write time |
| `status` | `str` | `present`, `late`, or `absent` |

**`verification_methods` token values:**
- `passkey` — WebAuthn assertion with UV passed
- `device` — device signature over PAS JSON v1 verified successfully
- `play_integrity` — PI daily vouch was present and valid at the time of check-in
- `bluetooth:<RSSI>` — BLE RSSI submitted; e.g. `bluetooth:-72`
- `gps` — GPS coordinates submitted (mock flag stored separately)
- `network` — source IP matched `SCHOOL_SUBNET_CIDR`
- `qr_proximity` — offline QR proximity (offline flow only)
- `manual` — record was created manually by teacher/admin

**Multiple records per session-student pair** are allowed (up to `max_check_ins`). The canonical record is derived at query time via `GET /records/by-session/{id}?canonical=true` — it returns the single best record per student (present > late > absent; highest score within tier).

---

## RegistrationSession

**Table:** `registration_sessions`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `user_id` | `str` FK → `users.id` | |
| `created_at` | `datetime` | UTC |
| `expires_at` | `datetime` | UTC; `created_at + REGISTRATION_TIMEOUT` |

Created by `POST /admin/register/{user_id}`. The registration token is stored in **Redis** (not in this table), keyed as `registration_token:{token}` → `user_id`, with TTL = `REGISTRATION_TIMEOUT`. This table is a secondary record for admin auditability.

---

## LoginSession

**Table:** `login_sessions`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `user_id` | `str` FK → `users.id` | |
| `created_at` | `datetime` | UTC |
| `expires_at` | `datetime` | UTC; `created_at + LOGIN_TIMEOUT` |
| `last_activity_at` | `datetime \| None` | Updated on activity; not currently used in session validity checks |

The session token itself is stored in **Redis** (not in this table), keyed as `session_token:{token}` → `user_id`. This table is a secondary record. Session validity is checked by looking up the Redis key; the DB row is used for admin visibility and audit only.

---

## AuditEvent

**Table:** `audit_events`

| Field | Type | Notes |
|---|---|---|
| `id` | `str` PK | UUID |
| `event_type` | `str` | See event type list below |
| `actor_id` | `str \| None` | User who performed the action (null for system events) |
| `target_id` | `str \| None` | User/record/credential affected |
| `detail` | `dict` (JSON) | Structured detail; shape varies by event type |
| `created_at` | `datetime` | UTC |

**Append-only:** there are no update or delete endpoints for audit events. The API guard returns 405 for any mutation attempt.

**Covered event types:**
- `manual_approval` — teacher approved a low-assurance record
- `credential_revoked` — credential deleted; detail includes old key hash and security level
- `device_key_mismatch` — submitted device public key did not match enrolled credential
- `device_signature_failure` — device signature verification failed
- `sign_count_anomaly` — sign count regression detected (possible cloned authenticator)
- `attestation_verified` — Android Key Attestation chain verified clean
- `attestation_failed` — attestation chain rejected; includes reason
- `enrollment_deleted` — student removed from a class
- `user_updated` — role or other user field changed; includes old/new values
- `manual_attendance` — teacher/admin created a record manually
- `bootstrap_attempt` — bootstrap endpoint was hit; includes IP
- `bootstrap_completed` — operator account created successfully via bootstrap

---

## Schema Patterns

All Pydantic schemas in `backend/api/schemas.py` follow the pattern:

```
<Entity>Base    — shared fields for create + response
<Entity>Create  — Base + any creation-only fields; extra="forbid"
<Entity>Update  — all optional fields; extra="forbid"
<Entity>Response — Base + id + computed/joined fields; from_attributes=True
```

`extra="forbid"` on Create and Update schemas prevents undeclared fields from being accepted. `from_attributes=True` on Response enables ORM → Pydantic conversion.

---

## Migration Notes

- Do not create or apply Alembic migrations until architecture is finalized.
- Schema changes go to `database/models.py`; Alembic versions are added manually at freeze time.
- `db/migrations.py` contains `ensure_database_schema()` which runs `Base.metadata.create_all()` on startup — safe for development; does not handle column additions or drops.
- All existing Alembic versions in `alembic/versions/` reflect historical changes; the current live schema is fully described by `models.py`.
