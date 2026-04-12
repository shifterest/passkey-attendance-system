# Copilot Instructions

Educational FIDO2 passkey attendance system with two-factor proximity and credential-based authentication. Prioritize clear reasoning and teach patterns, not only code output.

## Architecture

- Backend: FastAPI + SQLAlchemy (PostgreSQL) + Redis in backend.
- Web: Next.js App Router + React + shadcn/ui in frontend/web.
- Mobile: Flutter + Dart in frontend/flutter.
- Deployment shape: Redis -> Backend (8000) -> Web (3000), PostgreSQL in persistent volume.
- WebAuthn relying party accepts dual origins (web origin + Android APK hash origin).

## Build And Run

- Backend dev: `cd backend && uv run python main.py`
- Backend lint/test: `cd backend && uv run ruff check` and `uv run pytest`
- Web dev: `cd frontend/web && pnpm dev`
- Web lint: `cd frontend/web && pnpm biome check`
- Flutter dev: `cd frontend/flutter && flutter run`

## Deployment Wrap-Up

- Treat deployment verification as a mandatory wrap-up step for each completed implementation batch or one-shot task unless the user explicitly says not to deploy yet.
- Wrap-up must happen after the code batch is finished, not after every small intermediate edit.
- Before final handoff, run the most relevant local validation for touched surfaces when possible: backend `uv run ruff check` and targeted `uv run pytest`; web `pnpm biome check` and targeted build/lint checks; Flutter relevant analyze/test/build checks when applicable.
- If local validation is blocked by environment/tooling issues, say so clearly and continue with the remote deployment verification instead of pretending validation passed.
- After a completed batch that changes deployed behavior, push the current branch to `origin` and sync the test deployment immediately.
- Current test deployment target:
  - SSH: `ssh -i "C:\Users\candy\Documents\Keys\key" ubuntu@152.69.213.52`
  - Remote checkout: `/home/ubuntu/passkey-attendance-system`
  - Active branch on test host: `vibed`
- Remote deployment procedure:
  - `cd /home/ubuntu/passkey-attendance-system`
  - `git pull --ff-only origin vibed`
  - Rebuild and redeploy affected services with Docker Compose
  - Prefer `docker compose up -d --build --force-recreate ...` for changed services so stale containers are not reused
  - For backend/web work, default to `docker compose up -d --build --force-recreate backend web`
- Mandatory post-deploy verification on the test host:
  - `docker compose ps`
  - `curl -fsS http://localhost:8000/health`
  - Check logs or running container contents when verifying a specific fix
  - Confirm the deployed container actually contains the expected code when container reuse is suspicious
- Final response for a completed batch should state what validation ran, whether deployment was synced, and whether remote health checks passed.

## Collaboration Workflow

- All coding work, including boilerplate work (schema wiring, DTO alignment, repetitive refactors, straightforward endpoint/key renames), requires explicit user approval before implementation.
- Propose one next task/batch of tasks at a time, wait for approval, implement fully, then stop.
- After implementation, do NOT provide change delta by default; provide detailed explanation only when explicitly requested.
- Before starting the next task, user is REQUIRED to confirm understanding of any changes you make.
- Core logic and debugging (security decisions, verification policy, assurance behavior, threat tradeoffs): use coaching-first guidance.
- In plans, label items as boilerplate or core logic/debugging.
- Translate recurring workflow notes from memory into instruction files and prune them once they become irrelevant.
- Do not add new code comments unless the user explicitly asks for comments.
- Towards the end of development, remind the user to add their own comments to complex functions (e.g. `extract_android_key_security_level`, device signature verification, assurance scoring) for future readability. User writes all comments themselves.

## Settled Security Decisions

1. WebAuthn user verification is required for registration, check-in, and login option generation.
2. Device binding is app-layer based: store `device_public_key`, verify `device_signature`, and verify Android key attestation server-side.
  - Device key algorithm is ECDSA P-256 in Android Keystore (StrongBox preferred, TEE fallback), generated for signing purpose.
  - Registration requests direct attestation and is rejected unless Android Key attestation chains to a pinned Google root and reports `tee` or `strongbox`; no emulator bypass is supported.
  - Server-side Android Key attestation enforcement is deployment-configurable via `ANDROID_KEY_ATTESTATION_REQUIRED` (default: true).
  - Do not require a second per-use biometric prompt on the device key; WebAuthn user verification already enforces biometric user presence.
  - Device signature payload for check-in/login is canonical JSON containing `v`, `flow`, `user_id`, `session_id`, `credential_id`, `challenge`, and server-issued `issued_at_ms`.
  - Canonical serialization contract is PAS JSON v1: UTF-8 JSON, fixed key order `v,flow,user_id,session_id,credential_id,challenge,issued_at_ms`, compact separators, and no extra fields.
  - Keep assurance roles explicit: passkey = identity (`who`), device key = enrolled device (`which device`), proximity = context (`where`).
3. Play Integrity is a deployment-level attestation factor, disabled by default. Governed by `PLAY_INTEGRITY_ENABLED` together with `OUTBOUND_INTEGRITY_CHECKS_ENABLED`. When enabled and verdict fails: check-in is rejected before scoring. When disabled or unavailable: check-in proceeds without PI.
  - **Daily vouch flow:** PI is not called per-check-in. The app submits the verdict token to `POST /auth/play-integrity/vouch` once per day after the student has an authenticated session. The server verifies with Google and stores a 24h vouch record keyed on `credential_id`. At check-in, a valid vouch enables full proximity weights. Rate limit: 3 successful submissions per credential per calendar day; failed submissions do not consume a slot or invalidate an existing vouch.
  - **Integrity governs proximity weight:** valid PI vouch = full proximity weight (as scored). No PI vouch (integrity absent) = reduced proximity weights: BLE strong +4, BLE medium +2, BLE weak +1, GPS +1, network +2 (unchanged). PI explicitly failing = check-in rejected before scoring.
4. BLE proximity uses bucketed RSSI scoring (not linear):
   - `> -65` => +7
   - `-65 to -80` => +4
   - `-80 to -90` => +2
   - `< -90` => 0
   - Teacher device advertises the BLE proximity signal; student app scans and reports RSSI.
   - Clients must submit raw RSSI integers; the server derives all BLE buckets and scores.
   - BLE proximity token is stored in Redis at `ble_token:{session_id}` with TTL governed by `BLE_TOKEN_TTL_SECONDS` (default: 30). The teacher device polls `GET /sessions/{id}/ble-token` to obtain the current broadcast value.
   - BLE proximity token is bound to the WebAuthn challenge (session-specific, single-use).
   - School network origin of the check-in options request is server-verified. When `SCHOOL_SUBNET_CIDR` is configured: matching origin scores `network` +2 as a proximity signal; non-matching origin is stored as an anomaly indicator on the teacher dashboard and does not reject the check-in.
5. Offline QR flow uses signed payloads and 60-second TTL to reduce relay risk.
   - Offline records score `qr_proximity` (+4) only (`assurance_score` is proximity-only; device signature is a gate, not a score term).
   - A `sync_pending` flag (not a score flag) is set on the record.
   - Device signature verification on post-sync auto-clears the flag.
   - Records unsynced after 24 hours escalate to teacher review.
   - Failed device signature verification on sync sets a hard flag requiring teacher action.
   - Offline nonce hardening (planned): teacher device generates a short-lived nonce broadcast via BLE during offline sessions; student app embeds it in the signed payload. On sync, server cross-checks against teacher-submitted nonce set to reject pre-staged payloads.
6. Bootstrap is first-run provisioning only and disabled by default in production:
   - `BOOTSTRAP_ENABLED` defaults to false.
   - When enabled with no existing admin/operator users, the backend lifespan hook auto-generates a one-time token (24h TTL) and prints it to container logs.
   - Bootstrap APIs must never mint bootstrap tokens.
   - Web login page shows a token input form when bootstrap status is `ready`.
   - Submitting a valid token creates an operator user and returns a registration deep-link URL (no login session).
   - Web transitions to `pending_registration` phase showing a QR code for the operator to scan with the Flutter app and register their passkey + device key.
   - After registration, the operator signs in via the normal QR web login flow.
   - Successful bootstrap consumes token and disables bootstrap mode.
   - Log bootstrap attempts/outcomes as security events.
   - Do not auto-login an existing privileged account via bootstrap endpoints.
7. QR web login (all roles):
   - Web login page displays a QR code containing a deep link (`shifterest-pas://web-login?token=...`).
   - Flutter app scans QR, performs full passkey assertion + device signature verification against the backend.
   - Backend stores authenticated session in Redis; web polls `GET /auth/web-login/poll` until session appears.
   - On completion, web persists the session and redirects to dashboard.
   - QR auto-refreshes on TTL expiry (default 120s). Privileged roles (admin/operator) get 30-day sessions; others get standard timeout.
   - This replaces browser-native passkey login — device signature requires Android Keystore, so all web logins go through the Flutter app.

## Assurance Model

- Store evidence in `AttendanceRecord.verification_methods`.
- Compute additive `assurance_score`.
- Three evidence dimensions: **Identity** (passkey + device key, cryptographic), **Proximity** (BLE/GPS/network/QR, client-reported or server-witnessed), **Integrity** (PI daily vouch + Android Key Attestation + mock location flag, server-verifiable). Integrity governs proximity weight: vouched = full weight; absent = reduced weight (pending calibration); failed = check-in rejected.
- Standards basis for scoring: NIST SP 800-63B/63-4 defines authentication semantics; NIST SP 800-207 and BeyondCorp define the identity/device/context split; Android Key Attestation and Play Integrity define verifiable integrity evidence; MCDA/MAVT calibrates weights and thresholds. Numeric scores are local policy values constrained by threat model and pilot data, not copied from a standard.
- `assurance_score` is a proximity-only effective score. Passkey, device key, and Play Integrity are required authentication gates but do not contribute additive score terms.
- Proximity weights (integrity-absent / integrity-vouched):
  - `bluetooth` weak/medium/strong: absent +1/+2/+4, vouched +2/+4/+7
  - `gps` absent +1, vouched +3 (mock flag stored as integrity indicator)
  - `network` +2 always (school subnet, server-verified; absent when `SCHOOL_SUBNET_CIDR` not configured)
  - `qr_proximity` +4 always (offline only)
- Low-assurance threshold defaults to 5 and is configurable per class via `Class.standard_assurance_threshold`.
- High-assurance threshold defaults to 9 and is configurable per class via `Class.high_assurance_threshold`.
- `AttendanceRecord.is_flagged` and `flag_reason` are manual teacher flags and must not be auto-derived from `assurance_score`.
- Manual teacher approval is a status override, not a score component. Sets `manually_approved` flag with actor log; does not modify `assurance_score`.
- Assurance bands (default thresholds: standard = 5, high = 9):
  - **≥`high_assurance_threshold` (High):** auto-confirmed, green indicator, no teacher action needed
  - **≥`standard_assurance_threshold` (Standard):** auto-accepted, neutral indicator
  - **<`standard_assurance_threshold` (Low):** held; teacher must explicitly confirm or reject
- Band stored at write time: `assurance_band_recorded`, `standard_threshold_recorded`, `high_threshold_recorded` on each `AttendanceRecord`. `POST /records/assurance/evaluate` returns both recorded and current-policy bands with `policy_drift` flag.
- Session window policy (configurable; defaults apply):
  - 0–5 min from window open: status = present
  - 5–15 min: status = late
  - After close (15 min): status = absent; status is immutable once window closes
  - Students may retry check-in up to 3 times per window; highest assurance score is kept
- `CheckInSession` windows are teacher-initiated through `POST /sessions/open/teacher`; class attribution is inferred from the teacher's active `Class.schedule` block, and cutoffs are computed relative to window open time.
- For a given active schedule block, the first opened session is the attendance window.
- Any later sessions opened in that same schedule block are implicit presence checks; they are supplemental and do not modify the original attendance status.
- No `session_type` or `window_type` field is stored on `CheckInSession`.
- After each check-in attempt the student app displays the outcome (assurance band and whether a retry would help).
- Multi-credential support is allowed via a configurable limit, with default behavior set to one active credential per student. Admin may revoke credentials and issue a new registration link when a student needs re-registration (e.g. new phone).

## Auth Flows

1. Registration (admin initiated): `/admin/register/{user_id}` -> `/auth/register/options` -> `/auth/register/verify`
2. Attendance check-in: `/auth/check-in/options` -> `/auth/check-in/verify`
3. Login session management: `/auth/login/options` -> `/auth/login/verify` -> `/auth/logout`
4. QR web login: `/auth/web-login/initiate` -> Flutter scans QR -> `/auth/web-login/verify` -> web polls `/auth/web-login/poll`

## Project Conventions

### Backend

- Keep HTTP handlers in routes, reusable logic in services, models in backend/database/models.py.
- Use schema pattern Base -> Create -> Update -> Response in backend/api/schemas.py.
- Use constants from backend/api/strings.py for API errors/log templates (avoid inline message strings).
- `POST /credentials/` and `POST /records/` stay guarded as side-effect-created resources only.
- Entity IDs use `uuid.uuid4()` string keys.
- `Class.schedule` is JSON list data, not a separate schedule table; each entry uses `{ days: [...], start_time, end_time }`.
- Do not create or apply Alembic migrations until architecture is finalized; keep schema changes in code and consolidate migrations at the end.

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
