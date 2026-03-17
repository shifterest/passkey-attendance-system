---
description: "Use when implementing or reviewing assurance scoring, attendance record fields, integrity gate logic, class policy configuration, Play Integrity vouch flow, or assurance band behavior."
name: "Assurance Scoring and Integrity Model"
---
# Assurance Scoring and Integrity Model

## Locked Weight Table

These weights are settled policy. Do not change them without explicit architecture review.

`assurance_score` is a **proximity-only effective score**. Passkey, device key, and Play Integrity are required authentication gates and integrity evidence — they must pass for a record to be created, but they do not contribute numeric score terms.

| Method | Integrity-vouched score | Integrity-absent score | What it proves |
|---|---|---|---|
| BLE strong (> −65 dBm) | +7 | +4 | Physical proximity, close range |
| BLE medium (−65 to −80 dBm) | +4 | +2 | Physical proximity, moderate range |
| BLE weak (−80 to −90 dBm) | +2 | +1 | Physical proximity, edge of range |
| BLE (< −90 dBm) | 0 | 0 | — |
| GPS | +3 | +1 | Corroborating location; spoofable |
| Network origin | +2 | +2 | Server-witnessed school subnet origin; absent when `SCHOOL_SUBNET_CIDR` not configured |
| QR proximity (offline only) | +4 | +4 | Physical scan during offline session |

Network origin is always full weight — it is server-derived, not client-reported.

## Three-Dimension Model

| Dimension | Signals | Trust basis |
|---|---|---|
| **Identity** | Passkey, Device key | Cryptographic — server-verifiable against enrolled credential |
| **Proximity** | BLE RSSI, Offline QR, GPS, Network origin | Client-reported or server-witnessed; cannot prove physical co-location |
| **Integrity** | Play Integrity daily vouch, Android Key Attestation, mock location flag | Server-verifiable against Google attestation roots or Android cert chain |

Integrity governs proximity weight as a policy gate, not a score multiplier:
- **Vouched**: valid PI daily vouch → full proximity weights
- **Absent**: no PI vouch → reduced proximity weights (see table)
- **Failed**: PI verdict explicitly fails → check-in rejected before scoring begins

Identity signals (passkey + device) are unaffected by integrity state in all cases.

## Assurance Bands

Thresholds are configurable per class via `Class.standard_assurance_threshold` and `Class.high_assurance_threshold` (also mirrored on `ClassPolicy`).

| Band | Score | System behavior |
|---|---|---|
| High | ≥ `high_assurance_threshold` (default 9) | Auto-confirmed; green indicator; no teacher action needed |
| Standard | ≥ `standard_assurance_threshold` (default 5) | Auto-accepted; neutral indicator; visible to teacher |
| Low | < `standard_assurance_threshold` (default 5) | Held for teacher review; teacher must explicitly confirm or reject |

Low-assurance detection is a derived view: `assurance_score < class.standard_assurance_threshold`. It is **never auto-written to `is_flagged`**.

Without PI vouch the maximum achievable proximity score is 7 (BLE strong + GPS + network = 4+1+2), which is below the default High threshold of 9. A student who never vouches lands in Standard band at best.

In PI-disabled or air-gapped deployments, all records land in Standard band at best. Operators should document this tradeoff and may lower `high_assurance_threshold` to make High band reachable without PI.

Offline QR records score proximity only — `qr_proximity` (+4) — and land in Low band under default thresholds. This is intentional: offline check-ins are provisionally accepted pending server-side device signature verification on sync, and teacher review is appropriate.

## Band Persistence and Policy Drift

The assurance band is stored at the time of record creation using the effective class policy thresholds active at that moment. This preserves the historical interpretation of each record even when policy changes later.

Fields stored on each `AttendanceRecord` at write time:
- `assurance_band_recorded` — low/standard/high, computed at check-in
- `standard_threshold_recorded` — effective standard threshold used at decision time
- `high_threshold_recorded` — effective high threshold used at decision time

`POST /records/assurance/evaluate` is the server-authoritative endpoint for re-evaluation. Per row it returns:
- Stored `assurance_score`, `assurance_band_recorded`, and threshold snapshot
- Current-policy `assurance_band_current` and current thresholds
- `policy_drift: bool` — true when recorded band ≠ current band

The UI uses server-returned values to render both interpretations. A policy drift message example: "Current policy marks this record as low-assurance, but was marked standard-assurance upon recording."

## `is_flagged` and `manually_approved` Semantics

- `AttendanceRecord.is_flagged` and `flag_reason` are **manual teacher flags only**. Never auto-set from assurance score or any system condition.
- `manually_approved` is a **status override**, not a score component. Setting it does not modify `assurance_score`.
- When a teacher approves: set `manually_approved = True`, set `manually_approved_by`, log with `ManualApprovalDetail` audit event. Preserve `assurance_score` unchanged.

## Scoring Implementation

- `assurance_score_from_verification_methods(methods, integrity_vouched=...)` in `api/services/assurance_service.py` is the single scoring authority.
- Clients submit raw RSSI integers; the backend derives all BLE buckets and scores. Never accept pre-bucketed scores from clients.
- `verification_methods` entries use `AttendanceRecordVerificationMethods` enum values. BLE includes RSSI suffix: e.g. `bluetooth:-72`.
- `gps_is_mock` is stored on the record as an integrity indicator. It does not automatically zero the GPS score; score reduction flows through `integrity_vouched` state.

## Class Policy Configuration

Two-tier inheritance: admin sets deployment defaults; teachers set class-level overrides with "Use defaults" toggle.

| Parameter | Default | Current storage |
|---|---|---|
| `play_integrity_enabled` | false | `ClassPolicy` |
| `standard_assurance_threshold` | 5 | `Class` (also `ClassPolicy`) |
| `high_assurance_threshold` | 9 | `Class` (also `ClassPolicy`) |
| `present_cutoff_minutes` | 5 | `CheckInSession` (from policy/config at session open) |
| `late_cutoff_minutes` | 15 | `CheckInSession` (from policy/config at session open) |
| `max_check_ins` | 3 | `ClassPolicy` |
| `max_credentials_per_student` | 1 | app config |

Play Integrity is off by default. Only enable in internet-connected deployments with Google API access. When disabled: PI is absent from scoring; reduced proximity weights apply; all records land in Standard band at best.

## Play Integrity Vouch Flow

- PI is verified once per day per device, not per check-in, to avoid per-check-in Google API quota costs.
- Student app calls `POST /auth/play-integrity/vouch` with a verdict token. Backend verifies with Google, evaluates verdict (requires `MEETS_DEVICE_INTEGRITY` at minimum), stores vouch in Redis keyed on `credential_id` with 24h TTL.
- At check-in: `integrity_vouched = play_integrity_enabled AND has_valid_vouch(credential_id)`.
- Rate limit: 3 successful submissions per `credential_id` per calendar day. Redis key: `pi_vouch_daily_count:{credential_id}:{date}`. Failed submissions do not consume a slot.
- A failed vouch attempt does not invalidate an existing valid vouch — only successful submissions replace stored state.
- Vouch keyed on credential ID, not user ID. Multi-credential deployments have independent vouch state per enrolled device.

## Standards Basis

- **NIST SP 800-63B/63-4**: passkeys remain identity evidence; proximity and integrity signals do not replace authenticators or upgrade assurance levels by themselves.
- **NIST SP 800-207 / BeyondCorp**: identity, device, and context are independent inputs, not collapsed into perimeter trust.
- **Android Key Attestation + Play Integrity**: defines which device-integrity claims are server-verifiable.
- **MCDA/MAVT**: weights and thresholds are calibration parameters. AHP may be used for initial expert elicitation only, not as sole production justification.
- Weights are policy parameters constrained by standards and threat model — not copied from any standard. Final values must be pilot-calibrated against real false-accept/false-reject data before treating any threshold as a hard policy guarantee.
