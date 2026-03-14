# Copilot Instructions

Educational FIDO2 passkey attendance system with two-factor proximity and credential-based authentication. Prioritize clear reasoning and teach patterns, not only code output.

## Architecture

- Backend: FastAPI + SQLAlchemy (SQLite) + Redis in backend.
- Web: Next.js App Router + React + shadcn/ui in frontend/web.
- Mobile: Flutter + Dart in frontend/flutter.
- Deployment shape: Redis -> Backend (8000) -> Web (3000), SQLite in persistent volume.
- WebAuthn relying party accepts dual origins (web origin + Android APK hash origin).

## Build And Run

- Backend dev: `cd backend && uv run python main.py`
- Backend lint/test: `cd backend && uv run ruff check` and `uv run pytest`
- Web dev: `cd frontend/web && pnpm dev`
- Web lint: `cd frontend/web && pnpm biome check`
- Flutter dev: `cd frontend/flutter && flutter run`

## Collaboration Workflow

- All coding work, including boilerplate work (schema wiring, DTO alignment, repetitive refactors, straightforward endpoint/key renames), requires explicit user approval before implementation.
- Propose one next task/batch of tasks at a time, wait for approval, implement fully, then stop.
- After implementation, do NOT provide change delta by default; provide detailed explanation only when explicitly requested.
- Before starting the next task, user is REQUIRED to confirm understanding of any changes you make.
- Core logic and debugging (security decisions, verification policy, assurance behavior, threat tradeoffs): use coaching-first guidance.
- In plans, label items as boilerplate or core logic/debugging.
- Translate recurring workflow notes from memory into instruction files and prune them once they become irrelevant.
- Do not add new code comments unless the user explicitly asks for comments.

## Settled Security Decisions

1. WebAuthn user verification is required for registration, check-in, and login option generation.
2. Device binding is app-layer based: store `device_public_key`, verify `device_signature`, and verify Android key attestation server-side.
  - Device key algorithm is ECDSA P-256 in Android Keystore (StrongBox preferred, TEE fallback), generated for signing purpose.
  - Do not require a second per-use biometric prompt on the device key; WebAuthn user verification already enforces biometric user presence.
  - Device signature payload for check-in/login is canonical JSON containing `v`, `flow`, `user_id`, `session_id`, `credential_id`, `challenge`, and server-issued `issued_at_ms`.
  - Canonical serialization contract is PAS JSON v1: UTF-8 JSON, fixed key order `v,flow,user_id,session_id,credential_id,challenge,issued_at_ms`, compact separators, and no extra fields.
  - Keep assurance roles explicit: passkey = identity (`who`), device key = enrolled device (`which device`), proximity = context (`where`).
3. Play Integrity is a configurable attestation factor, disabled by default. Governed by `ClassPolicy.play_integrity_enabled` (deployment default: false; class-level override allowed). When enabled and verdict fails: check-in is rejected before scoring. When disabled: check-in proceeds without PI.
  - **Daily vouch flow:** PI is not called per-check-in. The app calls PI once per day and submits the verdict token to `POST /auth/play-integrity/vouch`. The server verifies with Google, stores a 24h vouch record keyed on `credential_id`. At check-in, a valid vouch means PI contributes +7. Rate limit: 3 successful submissions per credential per calendar day; failed submissions do not consume a slot or invalidate an existing vouch.
  - **Integrity gates proximity weight:** valid PI vouch = full proximity weight (as scored). No PI vouch (integrity absent) = reduced proximity weight for BLE/GPS/network (exact values pending calibration). PI explicitly failing = check-in rejected before scoring.
4. BLE proximity uses bucketed RSSI scoring (not linear):
   - `> -65` => +7
   - `-65 to -80` => +4
   - `-80 to -90` => +2
   - `< -90` => 0
   - Teacher device advertises the BLE proximity signal; student app scans and reports RSSI.
  - Clients must submit raw RSSI integers; the server derives all BLE buckets and scores.
   - BLE proximity token is bound to the WebAuthn challenge (session-specific, single-use).
   - School network origin of the check-in options request is server-verified. When `SCHOOL_SUBNET_CIDR` is configured: matching origin scores `network` +2 as a proximity signal; non-matching origin is stored as an anomaly indicator on the teacher dashboard and does not reject the check-in.
5. Offline QR flow uses signed payloads and 60-second TTL to reduce relay risk.
   - Offline records score `device` (+9) + `qr_proximity` (+4) only; passkey is not scored offline.
   - A `sync_pending` flag (not a score flag) is set on the record.
   - Device signature verification on post-sync auto-clears the flag.
   - Records unsynced after 24 hours escalate to teacher review.
   - Failed device signature verification on sync sets a hard flag requiring teacher action.
   - Offline nonce hardening (planned): teacher device generates a short-lived nonce broadcast via BLE during offline sessions; student app embeds it in the signed payload. On sync, server cross-checks against teacher-submitted nonce set to reject pre-staged payloads.
6. Bootstrap is first-run provisioning only and disabled by default in production:
   - `BOOTSTRAP_ENABLED` defaults to false.
   - Authorization uses backend-console-issued one-time token (short TTL, single use).
   - Bootstrap APIs must never mint bootstrap tokens.
   - Successful bootstrap consumes token and disables bootstrap mode.
   - Log bootstrap attempts/outcomes as security events.
   - Do not auto-login an existing privileged account via bootstrap endpoints.

## Assurance Model

- Store evidence in `AttendanceRecord.verification_methods`.
- Compute additive `assurance_score`.
- Three evidence dimensions: **Identity** (passkey + device key, cryptographic), **Proximity** (BLE/GPS/network/QR, client-reported or server-witnessed), **Integrity** (PI daily vouch + Android Key Attestation + mock location flag, server-verifiable). Integrity governs proximity weight: vouched = full weight; absent = reduced weight (pending calibration); failed = check-in rejected.
- Weights (full-integrity / vouched case):
  - `passkey` +8
  - `device` +9
  - `bluetooth` +2/+4/+7
  - `play_integrity` +7 (via daily vouch; see Settled Security Decision 3)
  - `gps` +3 (0 if app reports `isMock()` flag; mock flag stored as integrity indicator)
  - `network` +2 (school subnet origin, server-verified; absent when `SCHOOL_SUBNET_CIDR` not configured)
- Low-assurance threshold defaults to 10 and is configurable per class via `Class.standard_assurance_threshold`.
- High-assurance threshold defaults to 25 and is configurable per class via `Class.high_assurance_threshold`.
- `AttendanceRecord.is_flagged` and `flag_reason` are manual teacher flags and must not be auto-derived from `assurance_score`.
- Manual teacher approval is a status override, not a score component. Sets `manually_approved` flag with actor log; does not modify `assurance_score`.
- Assurance bands (default thresholds: standard = 10, high = 25):
  - **≥`high_assurance_threshold` (High):** auto-confirmed, green indicator, no teacher action needed
  - **≥`standard_assurance_threshold` (Standard):** auto-accepted, neutral indicator
  - **<`standard_assurance_threshold` (Low):** held; teacher must explicitly confirm or reject
- Session window policy (configurable; defaults apply):
  - 0–5 min from window open: status = present
  - 5–15 min: status = late
  - After close (15 min): status = absent; status is immutable once window closes
  - Students may retry check-in up to 3 times per window; highest assurance score is kept
- Teachers may open a presence check window at any time after the attendance window closes; results are supplemental and do not modify original attendance status.
- Only one `attendance`-type window may be open per class session at a time; `presence_check` windows have no such constraint.
- `CheckInSession` attendance windows are teacher-initiated at actual attendance start; class attribution is inferred from the teacher's active `Class.schedule` block, and cutoffs are computed relative to window open time.
- After each check-in attempt the student app displays the outcome (assurance band and whether a retry would help).
- Multi-credential support is allowed via a configurable limit, with default behavior set to one active credential per student. Admin may revoke credentials and issue a new registration link when a student needs re-registration (e.g. new phone).

## Auth Flows

1. Registration (admin initiated): `/admin/register/{user_id}` -> `/auth/register/options` -> `/auth/register/verify`
2. Attendance check-in: `/auth/check-in/options` -> `/auth/check-in/verify`
3. Login session management: `/auth/login/options` -> `/auth/login/verify` -> `/auth/logout`

## Project Conventions

### Backend

- Keep HTTP handlers in routes, reusable logic in services, models in backend/db/database.py.
- Use schema pattern Base -> Create -> Update -> Response in backend/api/schemas.py.
- Use constants from backend/api/messages.py for API errors/log templates (avoid inline message strings).
- `POST /credentials/` and `POST /records/` stay guarded as side-effect-created resources only.
- Entity IDs use `uuid.uuid4()` string keys.
- `Class.schedule` is JSON list data, not a separate schedule table; each entry uses `{ days: [...], start_time, end_time }`.
- When SQLAlchemy models change, create a generated Alembic revision (`uv run alembic revision --autogenerate`) and apply it (`uv run alembic upgrade head`).

### Web

- Edit real app components in components/custom; avoid editing scaffold templates in components unless needed.
- Put API wrappers in frontend/web/app/lib/api.ts.
- Use Tabler icons (`@tabler/icons-react`), not Lucide.
- Use Biome formatting/linting workflow.

### Flutter

- Registration deep link scheme: `shifterest-pas://register?token=...&user_id=...`
- Use passkey wrapper service patterns in frontend/flutter/lib/services/passkey.dart.
- Session persistence uses SharedPreferences in frontend/flutter/lib/services/session_store.dart.
- Keep login and attendance check-in as separate business intents.

## Detailed Architecture Docs

- Deferred security and architecture backlog: scratchboard/TO_BE_IMPLEMENTED_ARCHITECTURE_BACKLOG.md
- IMRAD architecture writing baseline: scratchboard/IMRAD_ARCHITECTURE_REFERENCE_BULLETS.md
- Locked architecture decisions and writer handoff: scratchboard/ARCHITECTURE_DECISIONS.md

## Cross-Check Rule

When any new decision is made — about sessions, scoring, flows, data models, or deployment — check whether it conflicts with or modifies anything already settled in this file or in `scratchboard/ARCHITECTURE_DECISIONS.md`. If it does, update both files before proceeding.
