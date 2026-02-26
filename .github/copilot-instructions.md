# AI Agent Instructions: FIDO2 Passkey Attendance System

## Project Overview
A two-factor attendance system combining **FIDO2 Passkey authentication** (identity) with **proximity verification** (Wi-Fi/BLE/QR/GPS) for secure classroom attendance. Built as research PoC with FastAPI backend, Flutter mobile/kiosk apps (planned), and Next.js admin dashboard (planned).

**Key Architecture Decision**: Native apps (Flutter) handle FIDO2 via platform APIs (Credential Manager/AuthenticationServices) to bypass browser RP ID restrictions for offline mode. Backend acts as WebAuthn Relying Party with RP_ID="attendance.softeng.com".

## Current Implementation Status

### ✅ Completed (backend/)
- **SQLAlchemy ORM models** (`db/database.py`): 6 entities with modern `Mapped[]` syntax
  - User ↔ Credential (1:many), User ↔ Class (teacher, 1:many), User ↔ ClassEnrollment (student, many:many via join table)
  - AttendanceSession ↔ AttendanceRecord (1:many)
- **32 CRUD endpoints** (`api/api.py`): Full REST API for Users, Credentials, Classes, Enrollments, Sessions, Records
- **4 FIDO2 endpoints** using `py_webauthn` library:
  - `POST /auth/register/options` → generates WebAuthn registration challenge
  - `POST /auth/register/verify` → verifies registration, stores public key (hex-encoded) + credential_id
  - `POST /auth/authentication/options` → generates authentication challenge
  - `POST /auth/authentication/verify` → verifies assertion, updates sign_count (replay protection), creates attendance record
- **HTTP status codes**: Proper 404/400/401/409 via `HTTPException` (not dict returns)
- **Centralized messages/logs** (`api/messages.py`): `Messages.*` for API responses, `Logs.*` for structured logging
- **Pydantic schemas** (`api/schemas.py`): Partial - only User/Class models done

### 🚧 In Progress
- Migrating all endpoints from `dict` parameters to Pydantic models (UserCreate, UserUpdate, etc.)
- Need schemas for: Enrollment, Session, Record, Auth (registration/authentication payloads)

### 📋 Not Started
- Frontend apps (admin dashboard, kiosk, student mobile)
- Redis for challenge storage (currently in-memory `pending_challenges` dict)
- Offline sync logic for kiosk
- Proximity verification services (BLE beacon validation, GPS geofencing)

## Critical Conventions

### Database & ORM
- **SQLAlchemy 2.0+ syntax**: Use `Mapped[type]` instead of `Column()`. Example: `id: Mapped[str] = mapped_column(primary_key=True)`
- **Relationships**: Always bidirectional with `back_populates`. Example:
  ```python
  # User model
  classes: Mapped[list["Class"]] = relationship(back_populates="teacher")
  enrollments: Mapped[list["ClassEnrollment"]] = relationship(back_populates="student")
  
  # Class model
  teacher: Mapped["User"] = relationship(back_populates="classes")
  ```
- **UUID primary keys**: Store as strings with collision detection loop during creation
- **SQLite database**: `db/attendance.db` created via `Base.metadata.create_all(bind=engine)`

### FIDO2 Implementation
- **Credential storage**: Public keys and credential IDs stored as **hex strings** (`.hex()` to save, `bytes.fromhex()` to load). NOT base64url - library only provides `base64url_to_bytes()` for incoming data, not reverse.
- **Challenge management**: Currently dict `pending_challenges[user.id] = options.challenge`. Delete after successful verify to prevent reuse.
- **Sign count tracking**: MUST update `user_credential.sign_count = authentication_verification.new_sign_count` after successful auth to prevent replay attacks.
- **Configuration constants**: `RP_ID="attendance.softeng.com"`, `RP_NAME="Passkey Attendance System"`, `ORIGIN="http://localhost:8000"`

### Proximity & Network Architecture
- **Proximity Trigger** (proves student is in room): BLE beacon broadcast from teacher's kiosk, detected by student app
- **Communication Channel** (student ↔ backend): School Wi-Fi ONLY (cellular/external internet blocked to prevent remote submission)
- **Online flow**: Student detects BLE → communicates with backend over school Wi-Fi → backend validates Wi-Fi subnet → FIDO2 verification → attendance recorded
- **Offline flow** (no internet): Kiosk creates local ad-hoc Wi-Fi network → student connects directly to kiosk → FIDO2 verified locally → synced to backend later
- **RP ID binding**: Native Flutter apps use OS-level Facet IDs (Android Digital Asset Links) to allow FIDO2 passkeys for `attendance.softeng.com` even when connecting to local IP (192.168.x.x) in offline mode

### Security Model & Threat Mitigation

**Threat Models**:
- **A) Walk-in-walk-out**: Student enters classroom, captures BLE token, leaves, submits remotely
- **B) Token sharing**: Student shares BLE session token with absent friend who submits from elsewhere

**Layered Defense Strategy** (all factors required):
1. **BLE beacon proximity** - Student app must detect kiosk's BLE signal (range ~10-50m)
2. **School Wi-Fi subnet** - Backend validates source IP is within school network (prevents 4G/external submission)
3. **Time-bound tokens** - Session tokens expire 30-60s after BLE broadcast, prevents delayed submission
4. **FIDO2 passkey** - Requires physical device + biometrics, prevents token sharing without device handover

**Spoofability Analysis**:
- ❌ **GPS geofencing**: Very easy to spoof (mock location apps) - excluded from design
- 🟡 **BLE beacon**: Moderately hard (requires planting physical device) - convenience factor, not security-critical
- ✅ **Wi-Fi subnet**: Hard to spoof (requires compromising school network infrastructure) - primary physical proof
- ✅ **FIDO2**: Very hard (cryptographically secure, device-bound) - primary identity proof

**BLE Beacon Token Mechanism**:
- **Service UUID**: Fixed identifier (e.g., `4fafc201-1fb5-459e-8fcc-c5c9c331914b`) allows student app to filter for attendance beacons
- **Payload**: Dynamic per-session data `{ session_id, session_token }` where `session_token` is unique UUID generated by backend
- **Token lifecycle**:
  1. Teacher starts session → Backend generates unique `session_token` + stores hash
  2. Kiosk broadcasts BLE with `session_token` in payload
  3. Student app scans, extracts token, submits to backend with FIDO2 signature
  4. Backend validates: token exists, not expired, not used, Wi-Fi subnet matches, FIDO2 valid
  5. Token marked as single-use after successful submission
- **Per-session isolation**: Each classroom session has unique token; multiple concurrent sessions supported
- **Optional enhancement**: Rotate Service UUID daily (app fetches from `GET /beacon/config`) to prevent long-term reverse engineering

### API Design
- **Error responses**: Use `raise HTTPException(status_code=status.HTTP_XXX, detail=Messages.CONSTANT)`, never return `{"message": "..."}` dicts
- **HTTP status codes**:
  - 404: Resource not found (user, class, session, etc.)
  - 400: Invalid input (bad role, invalid verification methods)
  - 401: Auth failure (no credential, verification failed)
  - 409: State conflict (no pending challenge)
- **Logging policy**: 
  - `logger.info()` for successful operations (use `Logs.*.format(...)`)
  - `logger.error()` only for unexpected exceptions
  - NO logs for routine 404s (normal control flow)
- **Endpoint patterns**:
  ```python
  @app.post("/resource", response_model=ResourceResponse)
  def create(data: ResourceCreate, db: Session = Depends(get_db)):
      # UUID generation with collision check
      new_uuid = str(uuid.uuid4())
      while db.query(Model).filter(Model.id == new_uuid).first():
          new_uuid = str(uuid.uuid4())
      # Create, add, commit, refresh, log
      obj = Model(id=new_uuid, **data.model_dump())
      db.add(obj)
      db.commit()
      db.refresh(obj)
      logger.info(Logs.RESOURCE_ADDED.format(...))
      return obj
  ```

### Code Organization
- **Modular structure**: `main.py` (entry) → imports `api.api` (routes) and `db.database` (models)
- **Centralized strings**: Import `from api.messages import Logs, Messages` - never hardcode response/log strings
- **Pydantic schemas**: Separate `*Create`, `*Update`, `*Response` models. Update models use `| None` for optional fields
- **Config class**: Pydantic responses need `class Config: from_attributes = True` for SQLAlchemy compatibility

## Developer Preferences
⚠️ **USER WANTS TO LEARN** - This is an educational project. Default behavior:
- **Explain, don't fix**: Describe issues and suggest solutions, wait for permission before editing
- **Ask clarifying questions** when requirements are ambiguous
- **Show examples** from the codebase when teaching concepts
- **Exception**: Can apply fixes when explicitly requested ("apply all of that", "do it for me", etc.)

## Running the Application
```bash
# Setup (first time)
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
pip install fastapi sqlalchemy uvicorn webauthn pydantic[email]

# Start server
python main.py
# or: uvicorn api.api:app --reload

# Access
# API: http://localhost:8000
# Docs: http://localhost:8000/docs (auto-generated Swagger UI)
```

## Common Pitfalls
- **SQLAlchemy relationships**: `back_populates` must match on both sides. `User.classes` (teacher relationship) ≠ `User.enrollments` (student relationship). Check foreign keys align with relationship names.
- **Pydantic vs SQLAlchemy**: Two separate layers - Pydantic validates API data, SQLAlchemy handles DB. Use `model.model_dump()` to convert Pydantic → dict for SQLAlchemy.
- **FIDO2 challenge cleanup**: Always `del pending_challenges[user.id]` after verify (success or failure) to prevent memory leak.
- **HTTPException vs dict returns**: Use `raise HTTPException(status_code=..., detail=...)` not `return {"message": "..."}` for errors.

## Configuration Management
Currently hardcoded in `api/api.py`. Future: use environment variables:
- `RP_ID`, `RP_NAME`, `ORIGIN` → .env file
- School Wi-Fi subnet whitelist → config file or database table
- BLE Service UUID → configurable per deployment

## Testing (Not Yet Implemented)
- **FIDO2 testing**: Use browser DevTools with virtual authenticator or hardware key
- **Endpoint testing**: FastAPI's TestClient with pytest
- **Database testing**: Use in-memory SQLite (`:memory:`) for test isolation
- **Manual API testing**: Use `/docs` Swagger UI or curl/Postman

## Next Steps (Priority Order)
1. Complete Pydantic schemas for all resources
2. Test FIDO2 registration/authentication flow with real authenticator
3. Replace in-memory `pending_challenges` with Redis/database
4. Build Flutter student app with native FIDO2 integration
5. Implement proximity verification services (BLE, QR, GPS)
6. Build admin dashboard (Next.js) for reporting

## Reference Documentation
- **Architecture**: See `scratchboard/Architecture_Outline.md` (aspirational, not all implemented)
- **Database schema**: See `scratchboard/Database_and_Data_Flow.md` (ERD diagrams)
- **WebAuthn library**: [duo-labs/py_webauthn](https://github.com/duo-labs/py_webauthn)
