---
description: "Use when implementing or reviewing backend code structure, service layer conventions, config settings, Redis key patterns, deployment configuration, or code style rules for the passkey attendance system."
name: "Backend Conventions and Configuration"
---
# Backend Conventions and Configuration

---

## Project Layout

The backend is a single Python package rooted at `backend/`. Key directories:

- `api/routes/` — HTTP handlers only; one file per resource/feature area
- `api/services/` — side-effectful business logic (DB, Redis, external calls)
- `api/helpers/` — pure stateless functions; no DB, Redis, or I/O
- `api/contracts/` — shared enums and constants (e.g. `DeviceBindingFlow`)
- `api/schemas.py` — all Pydantic DTOs
- `api/strings.py` — all message/log string constants
- `api/config.py` — pydantic-settings `Settings` object
- `database/models.py` — SQLAlchemy ORM models
- `database/connection.py` — `Base`, `engine`, `get_db`, `SessionLocal`
- `tests/` — pytest tests; parallel to source, one file per tested module

---

## Code Organisation Rules

- **HTTP handlers live in `routes/`.** Route files import services; they do not contain business logic directly.
- **Pure helper functions live in `api/helpers/`.** Helpers are stateless, side-effect-free functions. They do not call the database, Redis, or external services. They take plain values and return plain values.
- **Side-effectful logic lives in `api/services/`.** Services may call the database, Redis, or external services and are imported directly by routes. Services do not import from `routes/`.
- **Models live in `database/models.py`.** Do not split models across files.
- **All messages are constants in `api/strings.py:Messages`.** Never write inline error strings in route or service files. New messages go in `Messages` before use.
- **All Pydantic schemas live in `api/schemas.py`.** Follow the `Base → Create → Update → Response` pattern and set `extra="forbid"` on Create and Update schemas.
- **Config is accessed via `from api.config import settings`.** Never read `os.environ` directly in application code.
- **Route handler functions are named as descriptive verb-noun phrases** (`get_record`, `approve_record`, `create_manual_record`). Never prefix with the HTTP method.
- **HTTP status codes always use `status.HTTP_*` constants** from fastapi, never raw integers.
- **The DB session dependency parameter is always named `db`:** `db: Session = Depends(get_db)`. Never `session`, `conn`, or anything else.
- **Schema `model_config` follows a fixed pattern by schema tier:**
  - `Base`: `ConfigDict(use_enum_values=True)` when the schema contains enums, else omit
  - `Create` / `Update`: `ConfigDict(extra="forbid")` always; add `use_enum_values=True` if enums present
  - `Response`: `ConfigDict(from_attributes=True)` always

### Import Convention (Locked)

- **Use absolute imports only.**
- **Use explicit module imports always:** `from database.models import User` and `from database.connection import get_db`, not `from database import User`.
- **Do not use wildcard imports (`from x import *`).**
- **Do not use relative imports.**

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

- **`assurance_service.py`** — scoring, band computation, attendance status. See `assurance-scoring.instructions.md` for the full scoring table.
- **`attestation_service.py`** — Android Key Attestation chain verification at registration.
- **`auth_service.py`** — WebAuthn credential lookup, device signature verification (PAS JSON v1), rate limiting, session management.
- **`audit_service.py`** — `log_audit_event(db, event_type, actor_id, target_id, detail)`. Detail shapes are Pydantic models in `api/schemas.py`.
- **`import_service.py`** — bulk user import; supports `generic` CSV and `banner` CSV formats.
- **`integrity_service.py`** — Play Integrity vouch verification and daily rate limiting.
- **`session_service.py`** — `require_role(...)` FastAPI dependency for session-token auth.
- **`user_service.py`** — computed user detail aggregations for student/teacher responses.

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
