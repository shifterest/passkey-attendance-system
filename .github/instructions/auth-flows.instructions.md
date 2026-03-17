---
description: "Use when implementing or reviewing authentication flows, device binding, BLE proximity, offline QR, session windows, presence checks, or authorization policy for the passkey attendance system."
name: "Authentication Flows and Proximity Model"
---
# Authentication Flows and Proximity Model

## Flow Overview

| Flow | Initiator | Mechanism |
|---|---|---|
| Registration | Admin via web app | Deep link QR → student Flutter app → WebAuthn |
| Attendance check-in | Student | BLE or QR proximity → Flutter app → WebAuthn |
| Teacher login | Teacher | Flutter app → WebAuthn |
| Bootstrap | Backend console | One-time token → `POST /bootstrap/operator` → hard lock |

Biometric user verification (`userVerification: "required"`) is enforced in all three WebAuthn flows. The system rejects any attestation or assertion that does not satisfy UV.

The relying party accepts two origins: the web app origin and the Android APK hash origin, enabling both web and Flutter clients to complete WebAuthn under the same RP ID.

## Device Binding

- App-layer device key: **ECDSA P-256** generated in Android Keystore with signing purpose only (`PURPOSE_SIGN`).
- Hardware backing: StrongBox preferred, TEE fallback. Both score equally (+9 device weight); the security level is stored on `Credential.key_security_level` as a transparency detail only.
- Key is generated **once on first launch**. No second per-use biometric prompt. Rationale: passkey UV already enforces biometric user presence; a second biometric gate on the device key adds friction without improving assurance.
- At registration, the client submits the device public key and Android Key Attestation certificate chain.
- Registration is rejected unless the attestation chain roots to a pinned Google Hardware Attestation Root and reports `tee` or `strongbox`. No emulator bypass is supported.
- The backend verifies: full chain to trusted root, hardware security level, key purpose, algorithm, and challenge binding.
- **CRL lazy verification:** the CRL distribution point from the leaf certificate is checked lazily at the first check-in after registration, not at registration time. `Credential.attestation_crl_verified` stores the result (`None` = unchecked, `True` = clean, `False` = revoked). Check-in is rejected if the stored value is `False`. CRL checking requires `INTERNET_FEATURES_ENABLED=true` and `CRL_CHECK_ENABLED=true`; air-gapped deployments must document that CRL checking is skipped and `attestation_crl_verified` will remain `None`.

## Device Signature Payload Contract (PAS JSON v1)

All check-in and login verify requests include a device signature over a canonical payload.

**Fixed field order** (must match exactly — any deviation breaks verification):
```
v, flow, user_id, session_id, credential_id, challenge, issued_at_ms
```

Serialization rule: UTF-8 JSON, compact separators (`","` and `":"`), no extra fields, no whitespace.

Values:
- `v`: integer schema version, currently `1`
- `flow`: `"check_in"` or `"login"`
- `user_id`: authenticated user ID
- `session_id`: check-in session ID for `check_in`; `null` for `login`
- `credential_id`: WebAuthn credential ID from the assertion response (base64url, no padding)
- `challenge`: server-issued WebAuthn challenge (base64url)
- `issued_at_ms`: server-issued timestamp (milliseconds UTC)

Clock authority is server-side. Backend enforces freshness and rejects stale payloads (default staleness window: 30 seconds, configurable). Challenges are single-use via GETDEL atomic Redis consumption.

## BLE Proximity Model

- **Teacher device broadcasts**; student app scans passively and reports raw RSSI to the backend.
- The **session nonce** (stored as `CheckInSession.dynamic_token`) is generated server-side when the session is opened. The teacher device broadcasts the current nonce via BLE.
- **Token rotation:** the live session nonce is stored in Redis (`ble_token:{session_id}`) with a 30-second TTL. Teachers poll `GET /sessions/{id}/ble-token` to obtain the current value; the server auto-generates a new nonce if the Redis key has expired. The DB `dynamic_token` serves as an initial seed and fallback only.
- At check-in verify, the backend first reads the Redis nonce; if Redis has expired, it falls back to `dynamic_token`. This means a student submitting a nonce from the current or most recent 30-second window passes validation.
- BLE proximity token is bound to the WebAuthn challenge (session-specific, single-use).
- Clients submit raw RSSI integers. The backend derives BLE buckets and scores. Never accept pre-bucketed scores from clients.
- Relay attack (documented residual risk): BLE nonce is readable by any device in range. A commodity relay could forward it to an off-campus device. Controls that bound but do not eliminate this:
  - Play Integrity (when enabled) blocks modified apps injecting fake RSSI.
  - Rotating nonce per 30-second window prevents pre-capture replay but not real-time relay.
  - Source IP anomaly flags off-campus check-in options requests on the teacher dashboard.

## Network Attestation

When `SCHOOL_SUBNET_CIDR` is configured, the backend checks the IP of the check-in options request against the subnet at options time and stores the result in Redis (`check_in_network_ok:{user_id}`). At verify time this is consumed and stored on the record.

- Matching: `network` verification method added, +2 score.
- Non-matching: `network_anomaly = True` stored on the record; surfaced as anomaly indicator on teacher dashboard. Check-in is **not** rejected.
- Raw source IP is **never persisted** on the attendance record (data minimization).

## Online QR Check-in

Online QR is a **challenge delivery mechanism only, not a proximity proof**. No proximity score is assigned to the QR delivery step.

Rationale: a forwarded screenshot is indistinguishable from a live in-room scan server-side. Proximity evidence at QR-initiated check-ins comes entirely from BLE RSSI, GPS, and network origin signals submitted alongside the payload.

## Offline QR Flow

When the server is unreachable, WebAuthn cannot complete. The offline flow:

1. Student presents a **device-signed QR payload** with a 60-second TTL.
2. Teacher physically scans it — this scan is the proximity evidence.
3. Score: device (+9) + QR proximity (+4) = 13 (Standard band).
4. `sync_pending = True` is set on the record (status flag, not a score penalty).
5. On connectivity restore: server verifies the device signature. Clean verification **auto-clears** `sync_pending`.
6. Records unsynced after **24 hours** escalate to teacher review.
7. Failed device signature verification on sync sets a hard flag requiring explicit teacher action.

**Offline nonce hardening (planned, not yet implemented):** teacher device generates short-lived nonces broadcast via BLE during the offline session; student app embeds the captured nonce into the signed payload. On sync, the server cross-checks against the teacher-submitted nonce set to reject pre-staged payloads. This closes the pre-staging gap without requiring server connectivity at check-in time.

## Session Windows and Attendance Status

| Time from window open | Status |
|---|---|
| 0 – `present_cutoff_minutes` (default 5) | Present |
| `present_cutoff_minutes` – `late_cutoff_minutes` (default 15) | Late |
| After window closes | Absent |

- Attendance status is **immutable** once the window closes.
- Students may retry up to `max_check_ins` (default 3) times per window. The highest assurance score is kept; all attempts are logged.
- **Canonical record** per session-student pair: (1) highest-priority status (present > late > absent); (2) highest assurance score within that tier. All underlying attempt records are preserved.
- After each attempt, the student app displays the assurance band achieved and whether a retry could improve it.
- Only **one `attendance`-type window** may be open per class session at a time.
- Check-in sessions are **teacher-initiated** when attendance actually begins. Class attribution is inferred from the teacher's active schedule block; cutoffs are computed relative to session open time.

## Presence Checks

A teacher may open a presence check window at any time after the attendance window closes. Students use the same check-in flow. Results are supplemental records linked to the session — they **do not modify** original attendance status. Multiple presence check windows may be open simultaneously.

Both window types share the same `CheckInSession` model and flow. They are distinguished by temporal convention (first session opened per schedule block = attendance; subsequent = presence check), not by a stored type field.

## Bootstrap

- `BOOTSTRAP_ENABLED` defaults to `false` in production.
- Authorization uses a backend-console-issued one-time token with short TTL (issued via `tools/issue_bootstrap_token.py`).
- Bootstrap APIs must never mint bootstrap tokens.
- Successful bootstrap consumes the token and hard-locks bootstrap mode.
- Auto-login of existing privileged accounts via bootstrap endpoints is prohibited.
- All bootstrap attempts and outcomes are logged as security events.

## Authorization Policy (OWASP A01:2021 Framework)

Default stance: **deny unless explicitly permitted**. Endpoints not in the public list require an authenticated session with a verified role claim.

Public-access endpoints (no session required):
- `GET /`, `GET /health`
- `GET /bootstrap/status`, `POST /bootstrap/operator`
- `POST /auth/register/options`, `POST /auth/register/verify` (guarded by registration token)
- `POST /auth/login/options`, `POST /auth/login/verify`
- `POST /auth/logout`

All other endpoints use `require_role(...)` via FastAPI `Depends`. Scoped variants (e.g. teacher restricted to own class) are enforced via Depends composition, not URL-level path ownership.

Replay defense: GETDEL atomic challenge consumption on all verify endpoints. Only one verify request per challenge can win. A payload hash cache (P2 hardening) would further close a narrow simultaneous-request race — not yet implemented.

## Admin Lifecycle

- **User provisioning:** `POST /users/` creates a user record (no credential yet).
- **Bulk import:** `POST /admin/import-users` accepts a multipart CSV file and `format` parameter (`generic` or `banner`). Supported adapters: `generic` (columns: `full_name`, `email`, `school_id`, `role`) and `banner` (Banner SIS export columns: `FIRST_NAME`, `LAST_NAME`, `EMAIL_ADDRESS`, `ID`). Skips rows where email already exists. `dry_run=true` validates without writing. Use `tools/import_users.py` as a CLI wrapper.
- **Registration initiation:** `POST /admin/register/{user_id}` creates a short-lived registration session; the response URL is delivered as a deep-link QR to the student in the admin office.
- **Credential revocation:** `DELETE /credentials/{id}` (admin/operator only). Admin may revoke a credential and issue a new registration link when a student needs re-registration (e.g. new phone). Teacher role cannot revoke credentials.
- **Unregistration:** `POST /admin/unregister/{user_id}` removes all credentials for the user.
- **Seed scripts (`seed_users.py`, `seed_data.py`) are deprecated** — use the import endpoint for bulk provisioning.
