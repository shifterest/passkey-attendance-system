---
description: "Use when implementing or reviewing backend code structure, service layer conventions, config settings, Redis key patterns, deployment configuration, or code style rules for the passkey attendance system."
name: "Backend Conventions and Configuration"
---
# Backend Conventions and Configuration

---

## Project Layout

```
backend/
  main.py                    — entry point: uvicorn launch
  pyproject.toml             — dependencies (uv)
  api/
    api.py                   — FastAPI app, middleware, router registration
    config.py                — Settings via pydantic-settings
    schemas.py               — All Pydantic DTOs
    strings.py               — All message/log string constants
    redis.py                 — Redis client dependency
    contracts/
      device.py              — DeviceBindingFlow and DevicePayloadVersion enums
    routes/
      admin.py               — /admin
      audit.py               — /audit
      bootstrap.py           — /bootstrap
      check_in.py            — /auth/check-in
      classes.py             — /classes
      credentials.py         — /credentials
      enrollments.py         — /enrollments
      integrity.py           — /auth/play-integrity
      login.py               — /auth/login + /auth/logout
      policies.py            — /policies
      records.py             — /records
      register.py            — /auth/register
      root.py                — /health
      sessions.py            — /sessions
      students.py            — /students
      teachers.py            — /teachers
      users.py               — /users
    services/
      assurance_service.py   — scoring, band computation, attendance status
      attestation_service.py — Android Key Attestation chain verification
      device_binding_service.py — device signature verification (PAS JSON v1)
      import_service.py      — bulk user import (CSV/JSON)
      audit_service.py       — log_audit_event() helper
  database/
    models.py                — SQLAlchemy ORM models
    connection.py            — Base, engine, SessionLocal
    migrations.py            — ensure_database_schema() (create_all on startup)
  db/
    migrations.py            — re-export of database/migrations.py (legacy path)
  alembic/                   — migration history (frozen; see migration notes)
  tests/
    conftest.py              — pytest fixtures
    test_assurance_service.py
    test_attestation_service.py
    test_device_binding_service.py
    test_register_options_route.py
  tools/
    issue_bootstrap_token.py — CLI to issue a one-time bootstrap OTP
```

---

## Code Organisation Rules

- **HTTP handlers live in `routes/`.** Route files import services; they do not contain business logic directly.
- **Reusable logic lives in `services/`.** Services are plain Python functions (not classes), imported directly by routes. Services do not import from `routes/`.
- **Models live in `database/models.py`.** Do not split models across files.
- **All messages are constants in `api/strings.py:Messages`.** Never write inline error strings in route or service files. New messages go in `Messages` before use.
- **All Pydantic schemas live in `api/schemas.py`.** Follow the `Base → Create → Update → Response` pattern and set `extra="forbid"` on Create and Update schemas.
- **Config is accessed via `from api.config import settings`.** Never read `os.environ` directly in application code.

---

## Configuration Reference (`api/config.py`)

All fields are read from environment or `.env` file via `pydantic-settings`. Env var name = field name uppercased.

### Core Infrastructure

| Setting | Default | Purpose |
|---|---|---|
| `redis_url` | `redis://localhost:6379` | Redis connection URL |
| `database_url` | `sqlite+pysqlite:///sqlite/attendance.db` | SQLAlchemy DB URL; swap to `postgresql+psycopg2://...` for Postgres |
| `trusted_proxy` | `None` | Trusted reverse proxy IP; enables `ProxyHeadersMiddleware` for real client IP |

### WebAuthn

| Setting | Default | Purpose |
|---|---|---|
| `web_origin` | `http://localhost:3000` | Accepted WebAuthn origin for the web client |
| `app_origin` | `android:apk-key-hash:3mg2iB-...` | Accepted WebAuthn origin for the Flutter APK |
| `rp_id` | `attendance.whatta.top` | WebAuthn Relying Party ID |
| `rp_name` | `Passkey Attendance System` | Human-readable RP name |
| `registration_protocol` | `shifterest-pas` | Deep link scheme prefix for registration QR |
| `challenge_timeout` | `180` (s) | WebAuthn challenge TTL in Redis |
| `registration_timeout` | `180` (s) | Registration session TTL |
| `login_timeout` | `1800` (s) | Login session TTL |

### Device Binding

| Setting | Default | Purpose |
|---|---|---|
| `device_payload_max_age_ms` | `30000` | Max age of device signature payload (`issued_at_ms` window) |
| `max_active_credentials_per_user` | `1` | Credential limit per user (admin-controlled override via revoke+re-register) |

### Attendance Behavior

| Setting | Default | Purpose |
|---|---|---|
| `max_check_ins_per_session` | `3` | App-wide default retry cap; can be overridden per class via `ClassPolicy.max_check_ins` |
| `auth_user_ratelimit_max` | `5` | Max auth attempts per user before rate limit triggers |
| `auth_user_ratelimit_window` | `60` (s) | Window for per-user rate limit |

### Play Integrity

| Setting | Default | Purpose |
|---|---|---|
| `play_integrity_package_name` | `""` | Android package name for PI verification; empty = PI disabled server-side |
| `play_integrity_api_key` | `""` | Google API key for PI token verification |

### Internet Features and CRL

| Setting | Default | Purpose |
|---|---|---|
| `outbound_integrity_checks_enabled` | `False` | Master gate for all outbound integrity checks (CRL, PI verification) |
| `crl_check_enabled` | `True` | Whether CRL checking runs (only when `outbound_integrity_checks_enabled=True`) |

### Network Proximity

| Setting | Default | Purpose |
|---|---|---|
| `subnet_cidr` | `None` | School network CIDR (e.g. `10.10.0.0/16`); unset = network signal never scored |

### Geofence

| Setting | Default | Purpose |
|---|---|---|
| `school_lat` | `None` | School latitude; geofence inactive if unset |
| `school_lng` | `None` | School longitude; geofence inactive if unset |
| `school_geofence_radius_m` | `200.0` | Radius in meters |

### Timezone and Scheduling

| Setting | Default | Purpose |
|---|---|---|
| `server_timezone` | `Asia/Manila` | IANA timezone for schedule block matching and PI daily rate limit keys |

### Bootstrap

| Setting | Default | Purpose |
|---|---|---|
| `bootstrap_enabled` | `False` | Enable first-run bootstrap; must be explicitly set to `true` in `.env` for fresh deploys |
| `bootstrap_token_ttl_seconds` | `300` | TTL of console-issued bootstrap OTP |

---

## Redis Key Patterns

All Redis keys are prefixed with a namespace. TTLs are set at write time.

| Key pattern | Value | TTL | Purpose |
|---|---|---|---|
| `registration_token:{token}` | `user_id` | `REGISTRATION_TIMEOUT` | Validates registration deep link |
| `challenge:{user_id}` | challenge string | `CHALLENGE_TIMEOUT` | WebAuthn challenge (GETDEL on use) |
| `issued_at:{user_id}` | millisecond timestamp | `CHALLENGE_TIMEOUT` | Device payload freshness check |
| `session_token:{token}` | `user_id` | `LOGIN_TIMEOUT` | Login session validity |
| `check_in_network_ok:{user_id}` | bool | `CHALLENGE_TIMEOUT` | Network proximity flag from options → verify |
| `ble_token:{session_id}` | nonce string | 30s | Current BLE broadcast nonce; auto-rotated on expiry |
| `pi_vouch:{credential_id}` | `true` | 24h | Valid Play Integrity daily vouch |
| `pi_vouch_daily_count:{credential_id}:{YYYY-MM-DD}` | int | end of day | PI vouch submission rate limit |
| `check_in_retry:{session_id}:{user_id}` | int count | session duration | Retry counter per student per session |
| `idempotency:{user_id}:{key}` | JSON response | `CHALLENGE_TIMEOUT` | Cached check-in verify response body |
| `device_sig_hash:{user_id}:{hash}` | `1` | `CHALLENGE_TIMEOUT` | Prevents device signature replay within same window |
| `auth_ratelimit:{user_id}` | int counter | `AUTH_USER_RATELIMIT_WINDOW` | Per-user auth rate limit |
| `bootstrap:completed` | `1` | no expiry | Hard lock after bootstrap; checked by status endpoint |

---

## Service Layer Reference

### `assurance_service.py`

| Function | Description |
|---|---|
| `is_within_geofence(lat, lng, school_lat, school_lng, radius_m)` | Haversine distance check; returns `bool` |
| `resolve_attendance_status(attempted_at, session)` | Returns `present`/`late`/`absent` based on cutoffs |
| `assurance_score_from_verification_methods(methods, *, integrity_vouched)` | Additive proximity scorer; passkey/device/PI are gates, not score terms |
| `compute_assurance_band(score, standard_threshold, high_threshold)` | Returns `"low"`, `"standard"`, or `"high"` |

See `assurance-scoring.instructions.md` for full scoring table and band semantics.

### `attestation_service.py`

Verifies Android Key Attestation certificate chains at registration. Validates:
- Chain roots to pinned Google Hardware Attestation Root
- Security level is `tee` or `strongbox` (emulator paths are rejected)
- Key purpose is signing only
- Algorithm is ECDSA P-256
- Challenge in attestation extension matches the registration challenge

### `device_binding_service.py`

Verifies device signatures (PAS JSON v1). Validates:
- Canonical JSON serialization (fixed key order: `v, flow, user_id, session_id, credential_id, challenge, issued_at_ms`)
- Signature over canonical bytes using stored `device_public_key`
- `issued_at_ms` freshness within `DEVICE_PAYLOAD_MAX_AGE_MS`
- Payload hash not already in Redis device sig hash cache

### `import_service.py`

Processes bulk user imports. Supports `generic` format (CSV with `full_name, email, role, school_id` columns) and `banner` format (institution-specific CSV). Returns counts: `created`, `updated`, `skipped`, `errors`. `dry_run=True` validates without writing.

### `audit_service.py`

`log_audit_event(db, event_type, actor_id, target_id, detail)` — creates an `AuditEvent` row. Detail shape is determined by event type and documented in `api/models.py`.

---

## Dev and Lint Commands

```powershell
# Run backend dev server
cd backend && uv run python main.py

# Lint (must be clean before committing)
cd backend && uv run ruff check api/ database/ tests/

# Run tests
cd backend && uv run pytest tests/ -x -q
```

All tests must pass and ruff must be clean before any backend change is considered done.

---

## Deployment Variants

### SQLite (default)
- `DATABASE_URL=sqlite+pysqlite:///sqlite/attendance.db`
- OK for development and single-server pilots
- No schema migration required beyond `create_all`

### PostgreSQL
- `DATABASE_URL=postgresql+psycopg2://<user>:<pass>@<host>/<db>`
- Requires `psycopg2-binary` installed
- Run Alembic migrations before switching
- See `docker-compose.postgres.yml`

### Air-gapped deployment
- Set `OUTBOUND_INTEGRITY_CHECKS_ENABLED=false`
- Set `play_integrity_package_name` and `play_integrity_api_key` to empty strings (disables PI)
- Without PI and CRL, `attestation_crl_verified` remains `None` for all credentials (document this)
- Without PI, max achievable assurance score = 7 (BLE strong + GPS + network = 4+1+2); all records land Standard band at best
- Operators should lower `high_assurance_threshold` to a reachable value if High band is desired

### School-network-only deployment
- Configure `SCHOOL_SUBNET_CIDR` for network proximity scoring
- Configure geofence (`SCHOOL_LAT`, `SCHOOL_LNG`, `SCHOOL_GEOFENCE_RADIUS_M`) for GPS evidence
- PI available if outbound internet to Google permits

---

## Migration Notes

- Do not run Alembic migrations until architecture is finalized.
- `db/migrations.py:ensure_database_schema()` calls `Base.metadata.create_all()` — safe for development, does not handle column additions or drops.
- Historical Alembic versions exist in `alembic/versions/`; current live schema is fully described by `database/models.py`.
- Consolidate all pending schema changes into a single migration at architecture freeze.
