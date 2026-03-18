---
description: "Use when discussing architecture planning, attack path coverage, security hardening priorities, remaining implementation gaps, or IMRAD architecture writing for the passkey attendance system."
name: "Architecture Backlog Guidance"
---
# Architecture Backlog Guidance

## Response Style for Architecture Tasks
- Lead with architectural goals and trust boundaries before implementation details.
- Use implementation state only as evidence for coverage or gaps, not as the main framing.
- When reviewing security posture, map each attack path to: coverage status, missing control, residual risk, recommended priority (P0/P1/P2).

## Prioritization Heuristic
- P0: controls that change correctness or security guarantees.
- P1: controls that reduce abuse/replay/operational risk but do not block core flow correctness.
- P2: reliability and scaling hardening once core controls are in place.

## Update Rules
- When new deferred tasks are identified, add them to the backlog sections below.
- When a backlog item is completed, mark it ✅ Done here and note what was implemented.
- Settled decisions belong in `.github/copilot-instructions.md`, `assurance-scoring.instructions.md`, or `auth-flows.instructions.md`, not in this backlog.

---

## Attack Path Coverage

| Attack | Coverage status | Residual risk |
|---|---|---|
| Synced passkey / proxy attendance | ✅ Covered — device_public_key + device_signature + attestation-backed device trust | BLE relay via unmodified enrolled devices remains; see BLE relay notes in `auth-flows.instructions.md` |
| Emulator or scripted API client | Partially covered — Android Key Attestation rejects emulators at registration; Play Integrity (when enabled) blocks modified apps through the daily vouch flow. | CRL lazy verification is not yet wired |
| RSSI injection | Blocked when PI vouch present; otherwise residual for modified apps | Flutter now collects and submits RSSI reading arrays; backend averages before bucketing |
| GPS spoofing | ✅ `isMock()` flag detected in Flutter, submitted in check-in payload, and stored as `gps_is_mock` on the record as an integrity indicator. PI blocks state-changed modified apps when vouched. | Residual for apps that can spoof `isMocked` without triggering PI |
| Offline QR pre-staging | Bounded by session window enforcement; nonce hardening planned (see backlog) | Pre-staged payload within valid session window is not yet blocked |
| Duplicate / replayed attendance | ✅ Covered — GETDEL atomic challenge, issued_at_ms staleness check, idempotency key (Redis-scoped per user), device_signature hash cache | |
| Manual override abuse | ✅ Covered — append-only audit + actor attribution |  |
| Bootstrap takeover | ✅ Covered — disabled by default, one-time console token, completion lock |  |
| Session token theft / brute-force | Partially covered — per-user rate limiting done; token hardening and anomaly alerts not yet done |  |
| MITM on transport | Out of scope — certificate pinning rejected by design |  |

---

## P0 — Core Security Correctness

- ✅ `userVerification: required` in all WebAuthn option generators
- ✅ `device_signature` verified server-side in registration and check-in
- ✅ `device_public_key` on `Credential` model
- ✅ `verification_methods` persisted with concrete values per event
- ✅ `assurance_score` computed and persisted (proximity-only effective score)
- ✅ `assurance_band_recorded`, `standard_threshold_recorded`, `high_threshold_recorded` stored at write time; `POST /records/assurance/evaluate` endpoint for current-policy band and drift detection
- ✅ Enrollment check at check-in
- ✅ One active credential per student (application layer; admin-controlled revocation)
- ✅ Role-based authorization on all non-public endpoints
- ✅ Bootstrap disabled by default; one-time console token; completion lock
- ✅ Sign-count anomaly flag on `Credential`; detected in check-in and login verify; surfaced in `CredentialResponse`
- ❌ **Android Key Attestation CRL verification** — `Credential.attestation_crl_verified` field exists and check-in rejects if it is explicitly `False`, but the lazy fetch/update path is not yet implemented.
- ✅ **Play Integrity Flutter integration** — `play_integrity_service.dart` calls Google PI once per day after successful login, submits the token to `POST /auth/play-integrity/vouch` with the stored session token, and persists the last-vouched date locally.

---

## P1 — Data Access and Dashboard Support

- ✅ `GET /records/by-session/{id}?canonical=true` — one canonical record per enrolled student
- ✅ `GET /students/by-class/{class_id}` and `GET /students/by-teacher/{teacher_id}`
- ✅ Sign-count anomaly model + Alembic migration
- ✅ ClassPolicy model with two-tier inheritance (model and DB exist; UI "Use defaults" toggle is not yet built)
- ✅ `network_anomaly` flag on attendance records; set in check-in verify when subnet check fails

---

## P1 — Duplicate and Relay Protection

- ✅ GETDEL single-use challenge
- ✅ `issued_at_ms` staleness check (30s, configurable)
- ✅ Per-user rate limiting on auth option and verify endpoints
- ✅ **Idempotency key** — `X-Idempotency-Key` header on check-in verify; Flutter generates a UUID per attempt; backend caches response in Redis scoped to `{user_id}:{key}` with challenge TTL.
- ✅ **BLE session nonce rotation** — session nonce stored in Redis (`ble_token:{session_id}`) with TTL from `BLE_TOKEN_TTL_SECONDS` on session open. `GET /sessions/{id}/ble-token` endpoint auto-rotates on expiry (teacher/admin/operator only). Check-in verify reads Redis only. Teacher device polls this endpoint to get current broadcast nonce.
- ✅ **BLE RSSI averaging window** — Flutter collects full array of RSSI readings during 30s scan; backend averages the array before RSSI bucketing.
- ❌ **Offline QR nonce hardening** — teacher device nonce broadcast + server cross-check on sync (see `auth-flows.instructions.md` offline section for full design)

---

## P1 — Account Lifecycle and Emergency Access

- ✅ Credential revocation (`DELETE /credentials/{id}`; teachers scoped to enrolled students; audit event)
- ✅ Manual attendance via `POST /records/manual` (reason: free string, optional backdated_timestamp and status)
- ❌ Office SOP documentation for lost / replaced phone re-registration (operational, not code)

---

## P1 — Immutability and Auditing

- ✅ Append-only `AuditEvent` model; `log_audit_event()` service; `GET /audit/` endpoint
- ✅ Audit coverage: manual_approval, credential_revoked, device_key_mismatch, device_signature_failure, sign_count_anomaly, attestation verified/failed, enrollment deleted, user updated, manual_attendance, bootstrap_attempt, bootstrap_completed
- ✅ Old/new values in audit detail models (`api/models.py`)
- ✅ No direct POST/DELETE on audit data from application endpoints
- ✅ **Audit export** — `GET /audit/export` returns filtered CSV of all audit events; auth-gated to admin/operator; same filter params as `GET /audit/`.

---

## P1 — Flutter Client Gaps

- ✅ **Daily PI vouch call** — `play_integrity_service.dart`; triggered after successful login once an authenticated session exists
- ❌ **Post-check-in outcome screen** — display assurance band and whether a retry would improve it
- ✅ **`gps_is_mock` flag submission** — `Position.isMocked` read from `geolocator`, included in check-in verify payload, stored as `gps_is_mock` on `AttendanceRecord`
- ❌ **Offline QR attendance UI** — device-signed QR generation screen for offline sessions

---

## P2 — Operational Reliability

- ✅ Pagination (limit/offset) and sorting on all high-volume list endpoints
- ✅ **Health checks** — `GET /health` performs live `SELECT 1` against the database and `PING` against Redis; returns 503 with per-service status if either fails.
- ❌ Backup cadence and restore test schedule (operational SOP, not code)
- ✅ **PostgreSQL migration path** — `docker-compose.postgres.yml` scaffold provided; connection string switches from `sqlite+pysqlite://` to `postgresql+psycopg2://` via `DATABASE_URL` env. Install `psycopg2-binary` and run Alembic migrations before switching.
- ✅ Flutter `authenticate*` → `checkIn*` rename — confirmed unnecessary; `_authenticate()` is legitimately dual-purpose (handles both login and check-in flows)
- ❌ iOS device-binding parity (Secure Enclave + App Attest/DeviceCheck) — deferred until macOS signing environment is available
- ✅ **Payload hash cache** — `device_signature` SHA-256 hash cached in Redis per user with challenge TTL; blocks identical signatures being replayed within the same window.

---

## P2 — User-Facing Interface

- ❌ Teacher dashboard: session roster, assurance band indicators, anomaly flags (network, mock GPS, sign-count), manual approval/rejection for low-assurance records
- ❌ Admin dashboard: credential management, user lifecycle, audit log view
- ❌ Student app: check-in outcome screen, credential health indicator, vouch status
- ❌ Navigation flow and route hierarchy across web and Flutter

---

## School-Network-Only Deployment Notes

- No major architectural redesign required — same clients, backend, database, and Redis topology.
- Require stable DNS hostname and trusted HTTPS for WebAuthn secure context.
- Add strict internal segmentation; insider risk increases without perimeter.
- If outbound internet is restricted: Play Integrity cannot verify with Google; must disable `play_integrity_enabled`. Without PI, proximity weights are reduced; maximum achievable score is 7 (BLE strong + GPS + network = 4+1+2) — all records land in Standard band at best. Operators must document this.
- CRL lazy verification is not yet wired. When implemented, it will require outbound HTTP during post-registration validation; document it as unavailable in fully air-gapped deployments.

---

## Deployment Profile Notes

- **Internet-connected**: Play Integrity enabled; full scoring available.
- **School-network-only**: same as above but ensure DNS/TLS/segmentation; PI available if outbound permitted.
- **Air-gapped**: PI must be disabled. Without vouch, max proximity score = 7 (BLE strong + GPS + network = 4+1+2). All records land in Standard band at best. Operators must explicitly lower `high_assurance_threshold` to make High band reachable without PI.

---

## Organizations and Events (Deferred — Class-Based System to Ship First)

Full design is locked in session memory and the conversation summary. Implementation deferred until the class-based attendance system is working end-to-end in production.

### Locked Design Decisions

**User model additions**
- `program: str | None` (e.g. BSCS, BSIT, BLIS)
- `year_level: int | None`
- `department` dropped (derivable from program); `section` dropped (enrollment-dependent)

**Organization model**
- `Organization` — `id`, `name`, `description`, `created_by FK → users`, `created_at`
- `OrganizationMembershipRule` — `id`, `org_id FK`, `rule_type` (`all | role | program | year_level` — **`org_member` is FORBIDDEN in org rules**, prevents recursion), `rule_value`, `rule_group` (present but ignored; deferred AND logic; current evaluation is pure OR)
- `OrganizationMembership` — `id`, `org_id FK`, `user_id FK`, `membership_type` (`explicit_grant | explicit_revocation | role_elevation`), `org_role` (`member | moderator | event_creator | admin`), `granted_at`, `expires_at (nullable)`, `granted_by FK nullable`

**Event model**
- `Event` — owned by `Organization`; `id`, `org_id FK`, `name`, `description`, `schedule JSON`, `standard_assurance_threshold` (default 5), `high_assurance_threshold` (default 9), `play_integrity_enabled` (default False), `max_check_ins` (default 3), `created_by FK nullable`, `created_at`
- `EventAttendeeRule` — `id`, `event_id FK`, `rule_type` (`all | role | program | year_level | org_member`), `rule_value` (`org_id` when type is `org_member`), `rule_group (nullable)`
- No separate EventPolicy model — Event owns its own thresholds directly
- Empty attendee rules = closed by default (no one qualifies)

**Session bucketing**
- `CheckInSession` gains `event_id: nullable FK → events.id`
- `class_id` and `event_id` are mutually exclusive (exactly one non-null, enforced at application layer)
- `ClassEnrollment` gains `expires_at: nullable`

**Membership resolution algorithm (lazy, no materialization)**
1. Check explicit revocation row for user+org → if found, reject
2. Check explicit grant/role_elevation row with expiry check → if found and not expired, accept
3. Evaluate org's flat rules against user properties → accept if any match (OR composition)

**Event attendee evaluation**
- For `org_member` rule: run org membership resolution for that `org_id` — bounded at 2 hops max (org rules are guaranteed flat, no `org_member` in org rules)
- All other rule types: direct user property match

**Cross-class/event: closed** — class attendance ≠ event attendance; no bridge model; no shared sessions

**Auth is ReBAC, not role-based** — `User.role` is not extended; teacher+student+organizer are simultaneous relationships, not a role value

### Implementation Checklist (all ❌ pending)

- ❌ `User.program` + `User.year_level` fields
- ❌ `Organization`, `OrganizationMembershipRule`, `OrganizationMembership` models
- ❌ `Event`, `EventAttendeeRule` models
- ❌ `CheckInSession.event_id` nullable FK, `ClassEnrollment.expires_at` nullable
- ❌ Strings: `ORG_NOT_FOUND`, `EVENT_NOT_FOUND`, `NOT_EVENT_ATTENDEE`, `ORG_RULE_ORG_MEMBER_FORBIDDEN`, `MEMBERSHIP_EXPIRED`
- ❌ Schemas: user update fields, all org/event/rule shapes
- ❌ `membership_service.py` — `is_org_member`, `get_org_role`, `is_event_attendee`, rule evaluators
- ❌ `organizations.py` routes — CRUD + membership grant/revoke + rule management (validate: no `org_member` rule_type in org rules)
- ❌ `events.py` routes — CRUD + attendee rule management + `GET /{event_id}/qualifies/{user_id}`
- ❌ `check_in.py` event session branch — attendee gate (replaces enrollment check), event thresholds, event.max_check_ins, event.play_integrity_enabled
- ❌ `users.py` — expose `program`/`year_level` in create/update
- ❌ `api.py` — register `organizations.router` and `events.router`
- ❌ Instruction file updates: `auth-flows.instructions.md` (event options/verify flow), `copilot-instructions.md` (settled decisions)
- ❌ `ARCHITECTURE_DECISIONS.md` new section — org/event model, membership resolution, 2-hop bound, safety constraint

---

## Future Proximity Indicators (Research / Deferred)

These are proximity signal candidates documented for future consideration. None are currently scored.

| Signal | Notes | Status |
|---|---|---|
| **UWB (Ultra-Wideband)** | Centimeter-level ranging; requires UWB hardware on both teacher and student devices. Strong anti-relay properties due to physics-layer ToF. Would contribute a high-confidence proximity score. | Deferred — hardware availability constraint |
| **Ultrasonic** | Encodes a one-time nonce in a ~18–22 kHz tone broadcast from teacher device speakers; student app microphone detects it. Short range (~5 m). Nonce embeds session binding. Good relay resistance; microphone permission required. | Deferred — UX and permission friction |
| **WPA-Enterprise / RADIUS** | School Wi-Fi infrastructure can attest the BSSID and authenticated SSID at connection time. Stronger than IP subnet because it identifies the specific AP and requires 802.1X authentication. Would replace or augment the current subnet IP check. Requires backend integration with RADIUS server or WLAN controller API. | Deferred — infrastructure dependency |
| **NFC** | Teacher taps student phone; strong physical proximity proof. Short range (~4 cm). Good for spot checks or supplemental presence checks. Does not require infrastructure. Would score as a high-confidence proximity event. | Deferred — UX friction for large classes |

Wi-Fi BSSID (plain AP MAC address) was considered and superseded by the current IP subnet check, which is simpler to deploy and achieves the same zone-level proximity evidence without AP-level integration.

---

## Data Management Notes

- **Seed scripts** (`seed_users.py`, `seed_data.py`) are deprecated. Use `POST /admin/import-users` for bulk user provisioning.
- **Import adapters**: `generic` (columns: `full_name`, `email`, `school_id`, `role`) and `banner` (Banner SIS: `FIRST_NAME`, `LAST_NAME`, `EMAIL_ADDRESS`, `ID`). Implemented in `api/services/import_service.py`.
- **CLI tool**: `tools/import_users.py` wraps the import API endpoint for one-off provisioning from the console.

