# Copilot Instructions

This is an educational FIDO2 passkey attendance system with two-factor proximity and credential-based authentication. The goal is to learn — explain before implementing and teach patterns rather than just writing code.

## Architecture Overview

Three-component system:
- **Backend** (`backend/`): FastAPI + SQLAlchemy (SQLite) + Redis, Python 3.14, `uv` package manager
- **Web frontend** (`frontend/web/`): Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, pnpm
- **Mobile frontend** (`frontend/flutter/`): Flutter + Dart, `passkeys` package for FIDO2, `go_router` for navigation

Deployed via `docker-compose.yml`: Redis → Backend (port 8000) → Web (port 3000). SQLite is persisted via a named volume.

## Key Design: Dual-Origin WebAuthn

The WebAuthn relying party (`rp_id: attendance.whatta.top`) accepts credentials from two simultaneous origins:
- Web: configured via `WEB_ORIGIN` env var
- Android: APK key hash (`android:apk-key-hash:...`) set via `APP_ORIGIN`

This is why `verify_registration_response()` and `verify_authentication_response()` in `backend/api/routes/auth.py` pass a list of expected origins, not a single string.

## Security & Product Philosophy

- Primary threat model: students sharing synced passkeys/password-manager credentials so someone else can mark attendance for them.
- Secondary threat model: physical device lending is acknowledged; platform biometrics help but cannot eliminate all coercion/handoff risks.
- Accessibility and adoption matter: do **not** enforce only strict device-bound biometrics everywhere if it harms usability/device support.
- Use `AttendanceRecord.verification_methods` as progressive assurance evidence (`fido2`, `device`, `bluetooth`, etc.), and prefer **flagging** lower-assurance combinations over hard-failing by default.
- Agents should present security changes with explicit friction tradeoffs and propose graduated policy options (warn/flag/block), not only “maximum lock-down”.
## Security Architecture (Settled Decisions)

These controls are confirmed and should be implemented in priority order:

### 1. `userVerification: required`
All three WebAuthn option generators (`register`, `authenticate`, `login`) must pass `user_verification=UserVerificationRequirement.REQUIRED`. This ensures the platform authenticator always demands a biometric before signing. Without this, the default (`preferred`) silently skips biometrics on devices that don't support it, and an automated device in the classroom could authenticate without user presence.

### 2. Custom Device-Bound Key (Android Keystore ECDSA P-256)
The `passkeys` package (v2.17.4) does not support the FIDO Device Public Key extension — its `clientExtensionResults` is hardcoded to an empty map. We therefore implement device binding at the application layer:
- On first app launch, Flutter generates a P-256 key pair inside Android Keystore, requesting `StrongBox`/`TEE`-backed storage. The public key is sent to the server during registration and stored as `device_public_key` on the `Credential` row.
- During authentication, Flutter signs `{credential_id ‖ challenge ‖ timestamp}` with the device private key. The server verifies this signature against the stored `device_public_key`.
- **Android Key Attestation must be verified server-side** during registration — the Flutter app sends the attestation certificate chain, and the backend verifies it chains to a Google root and that the `KeyDescription` extension confirms `SecurityLevel = STRONGBOX` or `TEE`. Without this step a rooted device could substitute a software key and bypass the control entirely.
- This directly defeats synced-passkey sharing: a credential copied to another device cannot produce a valid device signature.

### 3. Google Play Integrity
Complements UV:required by blocking the emulator attack path: an Android emulator running the real app can simulate a UV biometric via `adb emu finger touch`, but will fail Play Integrity's `MEETS_DEVICE_INTEGRITY` verdict because it has no hardware root of trust. Also blocks custom API clients with forged requests.
- Flutter sends a Play Integrity token with each authentication request.
- Backend verifies the token with Google's Play Integrity API before processing.
- Login flow should also verify integrity to prevent emulator-based session theft.

### 4. BLE Proximity (Bucketed RSSI)
The `flutter_blue_plus` dependency is already declared. Dynamic rotating tokens are already designed (`AttendanceSession.dynamic_token`). The RSSI score contribution uses thresholds rather than a linear scale, because human bodies absorb 15–20 dBm in crowded rooms and a linear mapping produces false negatives at the back of the room:
- `> -65 dBm` → +7 (definitely in room)
- `-65 to -80 dBm` → +4 (likely in room, obstructed)
- `-80 to -90 dBm` → +2 (edge of range)
- `< -90 dBm` → 0 (out of range / fail)
Flutter should average 10 readings over ~3 seconds before reporting. The RSSI value is submitted with the authentication payload; the backend computes the bucket score.

### 5. Offline QR Flow
For connectivity-impaired environments. Protocol:
1. Teacher's app fetches `{session_id, challenge_bytes, session_expiry}` signed by the server when the session starts (the server signature proves the session is real).
2. Student's app scans the teacher's QR → gets the server challenge. Student then invokes the passkey authenticator with this pre-fetched challenge, producing a standard WebAuthn assertion.
3. Student's app also signs `{student_id ‖ session_id ‖ timestamp_ms}` with the device private key (from #2 above). The signed bundle is encoded as a QR code **with a 60-second TTL embedded in the payload**; the QR regenerates automatically. This kills the screenshot-relay attack: by the time a screenshot can be shared and scanned, it has expired.
4. Teacher's app scans each student QR → accumulates records locally.
5. On reconnection, teacher's app batch-uploads to `POST /sessions/{id}/offline-batch`; server verifies all device signatures.
- If passkey assertion is unavailable offline, records are marked `device`-only and scored lower accordingly.
- Note: `AssuranceScore` should be reduced for offline records since passkey assertion may be skipped.

### Assurance Score Design
`verification_methods` is a `JSON` column storing a list of method strings enriched with values where relevant (e.g. `"bluetooth:-72"`). The score is additive:
- `passkey`: +8
- `device` (verified device key): +9
- `bluetooth` (RSSI bucketed): +2/+4/+7 depending on bucket
- `play_integrity`: +6
- `gps`: +5
- `manual`: +3

The score and `is_flagged`/`flag_reason` are the primary tools for graduated policy — records with low scores are flagged but not hard-rejected by default.

### Explicitly Rejected Controls
- **BSSID fingerprinting**: iOS blocks BSSID access without a special enterprise entitlement; Android requires `ACCESS_FINE_LOCATION` which confuses users; BLE already covers the same proximity signal. Dropped.
- **Certificate pinning**: Let's Encrypt 90-day rotation makes pinning operationally fragile; the MITM threat is out of scope for this system. Dropped.
## Three Distinct Auth Flows

1. **Passkey Registration** (admin-initiated): Admin calls `POST /admin/register/{user_id}` → gets a deep-link token → client exchanges token for WebAuthn options → sends attestation to `POST /auth/register/verify`. Registration token is stored in Redis with TTL.
2. **Attendance Authentication**: `POST /auth/authenticate/options` → `/authenticate/verify` → creates an `AttendanceRecord` as a side effect.
3. **Login** (session management): `POST /auth/login/options` → `/login/verify` → stores session token in Redis and returns it for localStorage storage.

## Backend Conventions

- **File layout**: `routes/` for HTTP handlers, `services/` for reusable business logic, `db/database.py` for SQLAlchemy models
- **Schema pattern**: `Base → Create → Update → Response` Pydantic models per entity (see `api/schemas.py`)
- **Error messages**: always use `Messages.CONSTANT` from `api/messages.py`; log with `Logs.TEMPLATE.format(...)` — never use inline strings
- **Guarded endpoints**: `POST /credentials/` and `POST /records/` deliberately return 405 — these resources are created as side effects of WebAuthn flows only
- **IDs**: all entities use `uuid.uuid4()` string PKs
- **Schedule stored as JSON**: `Class.schedule` is a `JSON` column with list of `{"day", "start_time", "end_time"}` dicts — not a separate table
- Run locally: `cd backend && uv run python main.py`

## Web Frontend Conventions

- **Real components live in `components/custom/`** — the root `components/` directory contains shadcn scaffold templates; don't edit those
- **API calls go in `app/lib/api.ts`** — dual-origin fetch wrapper (`NEXT_PUBLIC_API_ORIGIN` for client, `API_ORIGIN_SERVER` for SSR)
- **Auth is localStorage-based**: `session_token`, `user_id`, `expires_in` — no middleware guards yet
- **Linter**: Biome (not ESLint/Prettier) — run `pnpm biome check`
- **Icons**: Tabler icons (`@tabler/icons-react`), not Lucide
- **Polymorphic rendering**: use shadcn's `render` prop (e.g., `render={<Link href="..." />}`) not `asChild`
- Run locally: `cd frontend/web && pnpm dev`

## Flutter Conventions

- **Deep link scheme**: `shifterest-pas://register?token=...&user_id=...` — handled in `main.dart` via `app_links`
- **Passkey package**: `PasskeyAuthenticator().register(request)` / `.authenticate(request)` wrapping server-provided options; see `lib/services/passkey.dart`
- **Session persistence**: `SessionStore` in `lib/services/session_store.dart` uses `SharedPreferences`; `deviceId` is generated once with UUID and cached permanently
- **Login ≠ Authentication**: "login" creates a web session; "authenticate" marks attendance — separate API flows
- `HomeScreen` and login button handlers are placeholders — not yet implemented
- `flutter_blue_plus` is declared as a dependency for planned BLE proximity verification but not yet used

## Current Implementation State

### Backend — complete
User/credential/class/enrollment/session/record CRUD, registration flow, authentication flow, login/logout flow, assurance score calculation skeleton.

### Backend — gaps (fix before new features)
- `user_verification` not passed to any `generate_registration_options()`, `generate_authentication_options()`, or login options call — currently defaults to `preferred`.
- `device_signature` field exists in `RegistrationResponseBase` and `AuthenticationResponseBase` schemas but is **never verified** in `register_verify` or `authenticate_verify` handlers.
- `AttendanceRecord.verification_methods` is always written as `[]`; `assurance_score` is never computed in `authenticate_verify`. The `assurance_score_from_verification_methods()` helper in `auth_service.py` exists but is never called.
- `Credential` table has no `device_public_key` column — needed before device key verification can be wired up.
- Sign count is updated correctly but a low/zero sign count (common with synced passkeys) is never flagged.

### Flutter — complete
Registration flow, QR scanner, passkey service wrapper, session store, API client, auth API calls, deep-link handling.

### Flutter — gaps
- `HomeScreen` is the Flutter counter demo placeholder — needs full implementation (attendance trigger, session status, history).
- Login button handlers in `LoginScreen` are empty `onPressed: () {}` — passkey login and the 2FA path are unwired.
- BLE (`flutter_blue_plus` declared but unused): proximity scanning, RSSI averaging, token collection not implemented.
- Device key generation (Android Keystore), signing, and attestation chain submission not implemented.
- Play Integrity token generation not implemented.

### Web frontend — complete
Students page (with loading skeleton), login page (passkey flow works), registration QR dialog, sidebar navigation, shared layout.

### Web frontend — gaps
- `classes/page.tsx`, `records/page.tsx`, `logs/page.tsx` are empty stubs.
- No route protection / auth middleware — unauthenticated users can navigate to `(home)` routes directly.
- Token expiration not handled in the login page (`// TODO` comment at line 72 of `login/page.tsx`).
- `admins/`, `teachers/` pages exist as directories but content state unknown.

### Not yet started (new features)
- Device-bound key: `device_public_key` column on `Credential`, Flutter Keystore key gen, Android Key Attestation cert chain verification in Python.
- Play Integrity verification: Flutter token fetch, backend Google API verification.
- BLE attendance flow: Flutter `flutter_blue_plus` scanning + RSSI, token submission, backend bucket scoring.
- Offline QR flow: teacher endpoint, student QR generation with signed TTL, batch upload endpoint.
- `HomeScreen` full implementation (Flutter).
- Classes, records, logs pages (web).
- Route guards (web).
