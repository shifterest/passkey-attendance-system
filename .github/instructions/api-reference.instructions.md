---
description: "Use when implementing, reviewing, or testing any backend API endpoint — route guards, request bodies, response shapes, error codes, or auth requirements — for the passkey attendance system."
name: "API Reference"
---
# API Reference

Backend is FastAPI. All routes are registered in `backend/api/api.py`. Auth guards are dependency-injected per route. All IDs are UUID strings. All timestamps are UTC ISO 8601.

---

## Auth Guards

| Guard | Who passes | Checked how |
|---|---|---|
| `admin, operator` | `role == "admin"` or `role == "operator"` | Session token → Redis lookup → `users.role` |
| `teacher` | `role == "teacher"` | Same |
| `admin, operator, teacher` | Any of the three | Same |
| `student` | `role == "student"` | Same |
| Self-only | Row `user_id == authenticated user_id` | Enforced in route handler, not middleware |
| None / public | No token required | Registration + login + bootstrap endpoints |

Session token is read from a cookie or authorization header (implementation-specific; verify in route `get_current_user` dependency). Unauthenticated requests to guarded endpoints → 401. Authenticated requests outside role scope → 403.

---

## Admin — `/admin`

### `POST /admin/register/{user_id}`
**Auth:** admin, operator  
**Body:** none  
**Response:**
```json
{ "token": "<registration_token>", "deep_link_url": "<shifterest-pas://register?token=...&user_id=...>" }
```
Creates a `RegistrationSession` row + stores token in Redis (`registration_token:{token}` → `user_id`) with `REGISTRATION_TIMEOUT` TTL. The deep link is the value the admin presents to the student as a QR code.

### `POST /admin/unregister/{user_id}`
**Auth:** admin, operator  
**Body:** none  
**Response:** 204  
Deletes all `Credential` rows for the user. Student must re-register from scratch.

### `POST /admin/import-users`
**Auth:** admin, operator  
**Body:** `multipart/form-data` — `file` (CSV or JSON), `format` (`generic` or `banner`), `dry_run` (bool)  
**Response:** import result with `created`, `updated`, `skipped`, `errors` counts  
Delegates to `import_service.process_import`. `dry_run=true` validates without writing.

---

## Authentication — Registration `/auth/register`

### `POST /auth/register/options`
**Auth:** public (registration token required in body)  
**Body:**
```json
{ "user_id": "...", "registration_token": "..." }
```
**Response:** WebAuthn `PublicKeyCredentialCreationOptions` JSON + `issued_at_ms`  
Validates registration token from Redis (must map to `user_id`). Checks credential limit. Generates challenge with `attestation: "direct"`, platform authenticator only, `userVerification: "required"`. Caches challenge in Redis.

### `POST /auth/register/verify`
**Auth:** public (registration token required in body)  
**Body:**
```json
{
  "user_id": "...",
  "registration_token": "...",
  "device_signature": "<base64>",
  "device_public_key": "<base64>",
  "credential": { ...WebAuthn response... }
}
```
**Response:** `CredentialResponse`  
Full registration pipeline: verifies WebAuthn response (UV required), verifies device signature over PAS JSON v1 (`flow: "register"`), verifies Android Key Attestation chain (must root to pinned Google Hardware Attestation Root, must report `tee` or `strongbox`). On success creates `Credential` with `key_security_level`. Emits attestation audit events.

---

## Authentication — Login `/auth`

### `POST /auth/login/options`
**Auth:** public  
**Body:** `{ "user_id": "..." }`  
**Response:** WebAuthn `PublicKeyCredentialRequestOptions` JSON + `issued_at_ms`  
Generates challenge with `userVerification: "required"`. Caches challenge + `issued_at_ms` in Redis.

### `POST /auth/login/verify`
**Auth:** public  
**Body:**
```json
{
  "user_id": "...",
  "credential": { ...WebAuthn assertion... },
  "device_signature": "<base64>",
  "device_public_key": "<base64>"
}
```
**Response:** `LoginSessionBase` → `{ user_id, session_token, created_at, expires_at, expires_in }`  
Verifies passkey (UV required), device public key match against enrolled credential, device signature over PAS JSON v1 (`flow: "login"`, `session_id: null`), sign count anomaly detection. Creates `LoginSession` + stores token in Redis.

### `POST /auth/logout`
**Auth:** public (session token in body)  
**Body:** `{ "user_id": "...", "session_token": "..." }`  
**Response:** 204  
Validates Redis key `session_token:{token}` maps to `user_id`. Deletes key. No-op if token not found.

---

## Authentication — Check-In `/auth/check-in`

### `POST /auth/check-in/options`
**Auth:** student (self-only)  
**Body:** `{ "user_id": "..." }`  
**Response:** WebAuthn `PublicKeyCredentialRequestOptions` JSON + `session_id`, `issued_at_ms`, threshold fields  
Checks: open session exists for student's enrolled class, enrollment is valid, retry limit not yet reached. Checks network subnet against `SCHOOL_SUBNET_CIDR`; stores result in Redis (`check_in_network_ok:{user_id}`). Generates challenge. Rate-limited.

### `POST /auth/check-in/verify`
**Auth:** student (self-only)  
**Body:**
```json
{
  "user_id": "...",
  "session_id": "...",
  "bluetooth_rssi_readings": [−72, −75, −68],
  "ble_token": "<nonce>",
  "gps_latitude": 10.3157,
  "gps_longitude": 123.8854,
  "gps_is_mock": false,
  "credential": { ...WebAuthn assertion... },
  "device_signature": "<base64>",
  "device_public_key": "<base64>"
}
```
**Headers:** `X-Idempotency-Key: <client-uuid>` (optional; deduplicates retried requests)  
**Response:** `AttendanceRecordResponse`  

Full check-in pipeline in order:
1. Verify passkey (UV required)
2. Verify device public key matches enrolled credential; emit `DEVICE_KEY_MISMATCH` audit if not
3. Verify device signature over PAS JSON v1 (`flow: "check_in"`); emit `DEVICE_SIGNATURE_FAILURE` audit if not
4. Check enrollment
5. Check retry limit
6. Check BLE token matches Redis or DB `dynamic_token`
7. Average RSSI readings; bucket into BLE score
8. Evaluate GPS geofence (if configured), store `gps_in_geofence`, store `gps_is_mock`
9. Check PI vouch state (`play_integrity_enabled` from class policy → Redis vouch key)
10. Consume network proximity flag from Redis
11. Lazy CRL check on `Credential.attestation_crl_verified` (if `INTERNET_FEATURES_ENABLED` and `CRL_CHECK_ENABLED`)
12. Compute `assurance_score`, `assurance_band`, attendance `status`
13. Write `AttendanceRecord`; cache idempotency response in Redis

---

## Play Integrity — `/auth`

### `POST /auth/play-integrity/vouch`
**Auth:** student  
**Body:** `{ "integrity_token": "..." }`  
**Response:** `{ "vouched": true, "slots_remaining": <int> }`  
503 when `PLAY_INTEGRITY_PACKAGE_NAME` or `PLAY_INTEGRITY_API_KEY` is empty (PI not configured server-side). Requires `MEETS_DEVICE_INTEGRITY` in the verdict. Rate-limited to 3 successful vouches per `credential_id` per calendar day (Redis key: `pi_vouch_daily_count:{credential_id}:{YYYY-MM-DD}`). Stores 24h vouch in Redis (`pi_vouch:{credential_id}`). A failed attempt does not consume a slot or invalidate an existing vouch.

---

## Users — `/users`

### `GET /users/`
**Auth:** admin, operator  
**Query:** `role?` (filter by role string)  
**Response:** `list[UserResponse]`

### `GET /users/{user_id}`
**Auth:** admin, operator, teacher, student (self)  
**Response:** `UserResponse`

### `POST /users/`
**Auth:** admin, operator  
**Body:** `UserCreate` → `{ role, full_name, email, school_id? }`  
**Response:** `UserResponse`

### `PUT /users/{user_id}`
**Auth:** admin, operator  
**Body:** `UserUpdate` → all optional  
**Response:** `UserResponse`  
Emits `USER_UPDATED` audit event with old/new values when role changes.

### `DELETE /users/{user_id}`
**Auth:** admin, operator  
**Response:** 204

---

## Teachers — `/teachers`

### `GET /teachers/`
**Auth:** admin, operator  
**Response:** `list[UserTeacherResponse]`  
Augmented response includes: `class_count`, `student_count`, `has_open_session`, `default_policy`.

### `GET /teachers/{teacher_id}`
**Auth:** teacher (self), admin, operator  
**Response:** `UserTeacherResponse`  
400 if user is not a teacher.

### `GET /teachers/{teacher_id}/classes`
**Auth:** teacher (self), admin, operator  
**Response:** `list[ClassResponse]`

---

## Students — `/students`

### `GET /students/`
**Auth:** admin, operator  
**Response:** `list[UserStudentResponse]`  
Augmented response includes: `ongoing_class`, `in_class`, `records`, `flagged`, `enrollments`, `registered`.

### `GET /students/{student_id}`
**Auth:** student (self), teacher, admin, operator  
**Response:** `UserStudentResponse`  
400 if user is not a student.

### `GET /students/by-class/{class_id}`
**Auth:** teacher (own class), admin, operator  
**Response:** `list[UserStudentResponse]`

### `GET /students/by-teacher/{teacher_id}`
**Auth:** teacher (self), admin, operator  
**Response:** `list[UserStudentResponse]`  
Deduplicated students across all of teacher's classes.

---

## Classes — `/classes`

### `GET /classes/`
**Auth:** admin, operator  
**Response:** `list[ClassResponse]`

### `GET /classes/{class_id}`
**Auth:** teacher (own only), admin, operator  
**Response:** `ClassResponse`

### `POST /classes`
**Auth:** admin, operator  
**Body:** `ClassCreate` → `{ teacher_id, course_code, course_name, schedule, standard_assurance_threshold?, high_assurance_threshold? }`  
**Response:** `ClassResponse`  
Validates teacher exists and has `teacher` role.

### `PUT /classes/{class_id}`
**Auth:** teacher (own only), admin, operator  
**Body:** `ClassUpdate` → all optional  
**Response:** `ClassResponse`

### `DELETE /classes/{class_id}`
**Auth:** admin, operator  
**Response:** 204

---

## Enrollments — `/enrollments`

### `GET /enrollments/`
**Auth:** admin, operator  
**Response:** `list[ClassEnrollmentResponse]`

### `GET /enrollments/by-class/{class_id}`
**Auth:** teacher (own only), admin, operator  
**Response:** `list[ClassEnrollmentResponse]`

### `GET /enrollments/by-student/{student_id}`
**Auth:** student (self), teacher, admin, operator  
**Response:** `list[ClassEnrollmentResponse]`

### `GET /enrollments/by-class/{class_id}/by-student/{student_id}/`
**Auth:** student (self), teacher (own), admin, operator  
**Response:** `ClassEnrollmentResponse`

### `POST /enrollments/`
**Auth:** admin, operator  
**Body:** `ClassEnrollmentCreate` → `{ class_id, student_id }`  
**Response:** `ClassEnrollmentResponse`  
409 if the student is already enrolled in that class.

### `PUT /enrollments/{enrollment_id}`
**Auth:** admin, operator  
**Body:** `ClassEnrollmentUpdate`  
**Response:** `ClassEnrollmentResponse`

### `DELETE /enrollments/{enrollment_id}`
**Auth:** admin, operator  
**Response:** 204  
Emits `ENROLLMENT_DELETED` audit event.

---

## Check-In Sessions — `/sessions`

### `GET /sessions/`
**Auth:** admin, operator  
**Query:** `limit`, `offset`  
**Response:** `list[CheckInSessionResponse]`

### `GET /sessions/by-class/{class_id}`
**Auth:** teacher (own only), admin, operator  
**Query:** `order` (`asc`/`desc`), `limit`, `offset`  
**Response:** `list[CheckInSessionResponse]`

### `GET /sessions/{session_id}`
**Auth:** teacher (own only), admin, operator  
**Response:** `CheckInSessionResponse`

### `POST /sessions/`
**Auth:** admin, operator  
**Body:** `CheckInSessionCreate`  
**Response:** `CheckInSessionResponse`  
Manual session creation (admin override).

### `POST /sessions/open/teacher`
**Auth:** teacher (self), admin, operator  
**Body:** `{ teacher_id, present_cutoff_minutes?, late_cutoff_minutes?, client_time? }`  
**Response:** `CheckInSessionResponse`  
Matches current server time (adjusted to `SERVER_TIMEZONE`) against all schedule blocks for all of teacher's classes. Rejects if 0 matching blocks (409) or >1 matching block (409 ambiguous). Creates session with `dynamic_token`, stores BLE nonce in Redis (`ble_token:{session_id}`) with 30s TTL.

### `GET /sessions/{session_id}/ble-token`
**Auth:** teacher (own only), admin, operator  
**Response:** `{ ble_token: str, ttl: int }`  
Returns current BLE token from Redis. If key has expired, generates and stores a new 30s nonce. Teacher device polls this to get the current broadcast value.

### `POST /sessions/{session_id}/close`
**Auth:** teacher (own only), admin, operator  
**Response:** `CheckInSessionResponse`  
Sets `status = "closed"`. 409 if already closed.

### `PUT /sessions/{session_id}`
**Auth:** teacher (own only), admin, operator  
**Body:** `CheckInSessionUpdate`  
**Response:** `CheckInSessionResponse`

### `DELETE /sessions/{session_id}`
**Auth:** admin, operator  
**Response:** 204

---

## Attendance Records — `/records`

### `GET /records/`
**Auth:** admin, operator  
**Query:** `limit`, `offset`  
**Response:** `list[AttendanceRecordResponse]`

### `GET /records/by-session/{session_id}`
**Auth:** teacher (own only), admin, operator  
**Query:** `canonical` (bool), `sort_by`, `order`, `limit`, `offset`  
**Response:** `list[AttendanceRecordResponse]`  
`canonical=true` returns one best record per enrolled student: (1) lowest status tier (present > late > absent); (2) highest assurance score within that tier.

### `GET /records/by-user/{user_id}`
**Auth:** student (self), teacher, admin, operator  
**Query:** `sort_by`, `order`, `limit`, `offset`  
**Response:** `list[AttendanceRecordResponse]`

### `GET /records/by-session/{session_id}/by-user/{user_id}/`
**Auth:** student (self), teacher (own), admin, operator  
**Response:** `list[AttendanceRecordResponse]`

### `GET /records/{record_id}`
**Auth:** student (self), teacher (own), admin, operator  
**Response:** `AttendanceRecordResponse`

### `POST /records/{record_id}/approve`
**Auth:** teacher (own), admin, operator  
**Body:** `{ "reason": "..." }`  
**Response:** `AttendanceRecordResponse`  
Sets `manually_approved = True`, stores `manually_approved_by` and `manually_approved_reason`. `assurance_score` is not modified. Emits `MANUAL_APPROVAL` audit event.

### `POST /records/manual`
**Auth:** teacher (own), admin, operator  
**Body:**
```json
{
  "session_id": "...",
  "student_id": "...",
  "reason": "...",
  "backdated_timestamp": "2026-03-18T08:00:00Z",
  "status": "present"
}
```
**Response:** `AttendanceRecordResponse`  
Creates record with `assurance_score = 0`, `is_flagged = True`, `verification_methods = ["manual"]`. `backdated_timestamp` is optional. `status` defaults to `present`. Emits `MANUAL_ATTENDANCE` audit event.

### `POST /records/assurance/evaluate`
**Auth:** teacher (own), admin, operator  
**Body:**
```json
{
  "record_ids": ["..."],
  "session_id": "...",
  "canonical": false,
  "standard_threshold": 5,
  "high_threshold": 9
}
```
**Response:** `list[AssuranceEvaluateRowResponse]`  
Re-evaluates assurance band for each record. If `session_id` provided, fetches all records for that session (optionally canonical). Returns per-record: recorded band + threshold snapshot, current-policy band + thresholds, and `policy_drift: bool` (true when bands differ).

### `POST /records/`
**Auth:** any  
**Response:** 405  
Guard endpoint — direct record creation is prohibited.

---

## Class Policies — `/policies`

### `GET /policies/`
**Auth:** teacher (own only), admin, operator  
**Response:** `list[ClassPolicyResponse]`  
Teachers see only policies they created.

### `GET /policies/{policy_id}`
**Auth:** teacher (own only), admin, operator  
**Response:** `ClassPolicyResponse`

### `POST /policies`
**Auth:** teacher, admin, operator  
**Body:** `ClassPolicyCreate` → `{ class_id?, play_integrity_enabled?, standard_assurance_threshold?, high_assurance_threshold?, present_cutoff_minutes?, late_cutoff_minutes?, max_check_ins? }`  
**Response:** `ClassPolicyResponse`  
`created_by` is set to the requesting user's ID. 409 if a policy for this (creator, class_id) already exists.

### `PUT /policies/{policy_id}`
**Auth:** teacher (own), admin, operator  
**Body:** `ClassPolicyUpdate`  
**Response:** `ClassPolicyResponse`

### `DELETE /policies/{policy_id}`
**Auth:** teacher (own), admin, operator  
**Response:** 204

---

## Credentials — `/credentials`

### `GET /credentials/`
**Auth:** admin, operator  
**Response:** `list[CredentialResponse]`

### `GET /credentials/by-user/{user_id}`
**Auth:** student (self), admin, operator  
**Response:** `list[CredentialResponse]`

### `GET /credentials/{credential_id}`
**Auth:** admin, operator  
**Response:** `CredentialResponse`

### `POST /credentials/`
**Auth:** any  
**Response:** 405  
Guard — direct creation is prohibited; use `/auth/register/verify`.

### `PUT /credentials/{credential_id}`
**Auth:** admin, operator  
**Body:** `CredentialUpdate`  
**Response:** `CredentialResponse`

### `DELETE /credentials/{credential_id}`
**Auth:** admin, operator  
**Response:** 204  
Emits `CREDENTIAL_REVOKED` audit event with old key details.

---

## Audit — `/audit`

### `GET /audit/`
**Auth:** admin, operator  
**Query:** `event_type?`, `actor_id?`, `target_id?`, `start_at?` (ISO), `end_at?` (ISO), `limit`, `offset`  
**Response:** `list[AuditEventResponse]`  
Descending by `created_at`.

### `GET /audit/{event_id}`
**Auth:** admin, operator  
**Response:** `AuditEventResponse`

### `GET /audit/export`
**Auth:** admin, operator  
**Query:** same filters as `GET /audit/` (no pagination)  
**Response:** `text/csv` streaming  
Downloads all matching audit events as a CSV file.

---

## Bootstrap — `/bootstrap`

### `GET /bootstrap/status`
**Auth:** public  
**Response:** `bool`  
Returns `true` only if: `BOOTSTRAP_ENABLED=true` AND Redis key `bootstrap:completed` is absent AND no `admin`/`operator` users exist in DB. All three conditions must hold.

### `POST /bootstrap/operator`
**Auth:** public (`X-Bootstrap-Token` header required)  
**Body:** none  
**Response:** `LoginSessionBase`  
First-run only. Validates OTP token from Redis. Creates operator user. Creates 30-minute login session. Consumes token (deletes from Redis). Sets `bootstrap:completed` in Redis. Emits `BOOTSTRAP_ATTEMPT` + `BOOTSTRAP_COMPLETED` audit events. Rate-limited: 5 attempts per IP per 60 seconds. Auto-login of existing privileged accounts via this endpoint is prohibited.

---

## Health — `/`

### `GET /health`
**Auth:** public  
**Response:** `{ "database": "ok"|"error", "redis": "ok"|"error" }` (503 if either fails)  
Performs live `SELECT 1` against the database and `PING` against Redis.

---

## Common Error Shapes

All errors return JSON:
```json
{ "detail": "<message string or array>" }
```
Message strings are sourced from `backend/api/strings.py:Messages` constants — never inline. HTTP codes:
- `400` — bad request / validation failed
- `401` — unauthenticated
- `403` — insufficient role
- `404` — entity not found
- `405` — forbidden method (guard endpoints)
- `409` — conflict (duplicate, already closed, already open)
- `429` — rate limited
- `503` — dependency unavailable (PI not configured, DB/Redis down)
