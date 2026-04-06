---
description: "Use when implementing or reviewing the Flutter mobile client — screens, services, navigation, session persistence, BLE/GPS proximity collection, passkey flows, known bugs, or Flutter-specific conventions for the passkey attendance system."
name: "Flutter Client Reference"
---
# Flutter Client Reference

The Flutter app (`frontend/flutter/`) is the **student-facing** interface. It handles passkey registration, passkey login, and check-in (BLE + GPS proximity collection + passkey assertion). It is not an admin interface — teachers and admins use the web frontend.

---

## Tech Stack

- **Framework:** Flutter (Dart)
- **Navigation:** GoRouter (`go_router`)
- **Storage:** `SharedPreferences` (via `shared_preferences_with_cache`) for session persistence
- **Deep links:** `app_links` package for registration QR deep link handling
- **BLE scanning:** `flutter_blue_plus`
- **BLE advertising:** Native Android `NativeBleAdvertiser.kt` via MethodChannel
- **GPS:** `geolocator`
- **QR scanning:** `mobile_scanner`
- **QR generation:** `qr_flutter`
- **Notifications:** `flutter_local_notifications`
- **Passkey:** Platform WebAuthn via `passkey.dart` service (method channel to native)
- **Config:** Compile-time `String.fromEnvironment`

---

## Project Layout

```
frontend/flutter/lib/
  main.dart                    — Entry point, router, app shell, deep link handler
  strings.dart                 — All string constants and API path constants
  config/
    config.dart                — Compile-time configuration
  contracts/
    device.dart                — DeviceBindingFlow + DevicePayloadVersion (mirrors backend enums)
  models/
    login_session.dart         — LoginSession data class
    user.dart                  — User data class (currently unused by screens)
  screens/
    login_screen.dart          — Registered-or-not gate: login vs. QR scan
    registration_screen.dart   — Passkey registration flow (auto-starts)
    qr_scanner_screen.dart     — Camera QR scanner for registration deep link
    authentication_screen.dart — Login + check-in combined flow (auto-starts)
    home_screen.dart           — Post-login home with PI vouch banner + check-in cards
    check_in_result_screen.dart — Assurance band badge + signal breakdown chips
    offline_check_in_screen.dart — Student offline QR code generation
    teacher_home_screen.dart   — Teacher landing page
    teacher_session_screen.dart — Teacher session management
    teacher_offline_session_screen.dart — Teacher offline session management
    teacher_offline_scanner_screen.dart — Teacher QR scanner for offline check-ins
    teacher_dashboard_screen.dart — Roster, status/band badges, approve/reject
  services/
    api_client.dart            — HTTP client (fetch helper)
    auth_api.dart              — Auth endpoint wrappers (static methods)
    session_api.dart           — Session endpoint wrappers (BLE token, session data)
    passkey.dart               — Native passkey method channel wrapper
    play_integrity_service.dart — Play Integrity daily vouch
    secure_store.dart          — Keystore/Keychain secure storage (method channel)
    session_store.dart         — SharedPreferences session persistence
    user_api.dart              — User endpoint wrappers (instance methods; currently unused)
    offline_payload_service.dart — Offline check-in PAS JSON v1 payload generation
    class_cache_service.dart   — SharedPreferences-backed class data cache for offline use
    ble_advertiser_service.dart — BLE advertising via NativeBleAdvertiser Android native
    notification_service.dart  — MethodChannel for PI vouch expiry local notifications
  widgets/
    error_dialog.dart          — Reusable error dialog
```

---

## Router and Navigation

Defined in `main.dart` via GoRouter:

| Route | Component | Notes |
|---|---|---|
| `/` | `AuthWrapper` | Session gate; redirects to `HomeScreen` or `LoginScreen` |
| `/scan` | `QrScannerScreen` | Registration QR scanner |
| `/authenticate` | `AuthenticationScreen` | Receives `?user_id=&login=true` for login or check-in |
| `/register` | `RegistrationScreen` | Receives `?token=&user_id=` from deep link |
| `/check-in-result` | `CheckInResultScreen` | Assurance band badge + signal breakdown |
| `/offline-check-in` | `OfflineCheckInScreen` | Student offline QR code generation |
| `/teacher` | `TeacherHomeScreen` | Teacher landing page |
| `/teacher/session` | `TeacherSessionScreen` | Teacher session management |
| `/teacher/offline-session` | `TeacherOfflineSessionScreen` | Teacher offline session management |
| `/teacher/offline-scanner` | `TeacherOfflineScannerScreen` | Teacher QR scanner for offline check-ins |
| `/teacher/dashboard` | `TeacherDashboardScreen` | Roster view with approval actions |

`AuthWrapper` calls `SessionStore.isSessionValid()`. If the session is valid it renders `HomeScreen`; otherwise `LoginScreen`.

**Deep link handling:** `Main._routeUri()` validates the incoming URI scheme (`Config.registrationProtocol` = `shifterest-pas`) and host (`register`), then navigates to `/register?token=...&user_id=...`. Both cold-start links (via `getInitialLink()`) and live stream links are handled.

---

## Screens

### `LoginScreen`

Stateless gate screen. Calls `SessionStore.getUserId()` in a `FutureBuilder` to detect registration state.

- **Registered user (userId present):** Shows "Login with passkey" → pushes `AuthenticationScreen(userId, login: true)`. Shows permanently disabled "Login with password and 2FA" button.
- **Unregistered (userId null):** Shows "Register a new passkey" → pushes `QrScannerScreen`.

**Known gaps:**
- `FutureBuilder` re-runs on every rebuild (no caching)
- Password login button is permanently disabled (`onPressed: null`) — no fallback credential recovery

---

### `QrScannerScreen`

Full-screen camera scanner using `mobile_scanner`. Parses the first detected barcode as a URI, validates scheme and host, extracts `token` and `user_id` query params, navigates to `/register?token=...&user_id=...`, and reports unexpected failures through `QrStrings.errorUnexpectedFailure`.

---

### `RegistrationScreen`

Auto-starts `_startRegistration()` on mount. Props: `userId`, `registrationToken` (from deep link).

**`_register()` flow:**
1. `POST /auth/register/options` — gets WebAuthn creation options
2. `passkey.register(optionsJson, userId, registrationToken)` — creates passkey on device
3. `POST /auth/register/verify` — sends credential + device signature + device public key + attestation
4. `SessionStore.saveUserId(userId)` — persists user ID for future launches

On success → returns to `/` so the user can complete a normal login flow.

Registration does not create a login session. A session token is not returned by `register/verify`, so the student must separately log in after registration.

---

### `AuthenticationScreen`

The most complete screen. Auto-starts `_authenticate()` on mount. Handles both login and check-in depending on the `login: bool` prop.

**Check-in flow:**
1. `POST /auth/check-in/options` — gets WebAuthn assertion options + `session_id` + thresholds
2. `_collectBleProximity()` — scans BLE for 30 seconds, collects RSSI array + strongest advertiser token
3. `_collectGpsPosition()` — gets GPS position (soft fail if permission denied)
4. `passkey.checkIn(...)` — signs assertion + device signature
5. `POST /auth/check-in/verify` (with `X-Idempotency-Key` header) — submits everything

**Login flow:**
1. `POST /auth/login/options`
2. `passkey.login(optionsJson, userId)`
3. `POST /auth/login/verify`
4. Persist `session_token` + `expires_in` via `SessionStore.saveSession(...)`
5. Trigger the daily Play Integrity vouch in the background

**BLE collection (`_collectBleProximity()`):**
- Requests `bluetoothScan` + `bluetoothConnect` permissions (Android)
- Checks BLE supported + on; prompts to enable if off
- Full 30-second scan; groups RSSI readings by advertised BLE token and keeps the strongest advertiser's token plus its readings
- Returns `({List<int> rssiReadings, String? bleToken})`
- Throws on missing permissions, unsupported BLE, BT off, or no signal detected

**GPS collection (`_collectGpsPosition()`):**
- Requests location permission; returns `null` if denied
- `Geolocator.getCurrentPosition` with 10s timeout; returns `null` on error
- `gps_is_mock = position?.isMocked ?? false`

`AuthenticationScreen` is now the point where the authenticated session becomes durable: successful login persists the backend session token locally, returns through GoRouter, and triggers the daily Play Integrity vouch asynchronously.

---

### `HomeScreen`

Post-login home screen. Loads session data in `initState` and implements `WidgetsBindingObserver` to re-check PI vouch status on app resume.

**Content:**
- PI vouch expiry banner (warning when vouch is about to expire or expired)
- Last check-in card showing the most recent result
- "Check In Now" button → routes to `/authenticate?user_id=...`
- "Check In Offline" button → routes to `/offline-check-in`

**Logout flow:** calls `AuthApi.logout(userId, sessionToken)` (silently ignores errors), then `SessionStore.clearSession()`, then pops to `/` via GoRouter.

**What's still unbuilt:**
- Attendance history screen / per-session result list
- Profile / settings screen entry

---

## Services

### `auth_api.dart`

All methods are `static`. Constructs a fresh `ApiClient` per call. All responses must be `Map<String, dynamic>`.

| Method | Endpoint |
|---|---|
| `registerOptions(userId, token)` | `POST /auth/register/options` |
| `registerVerify(response)` | `POST /auth/register/verify` |
| `checkInOptions(userId)` | `POST /auth/check-in/options` (`X-Session-Token` attached) |
| `checkInVerify(response)` | `POST /auth/check-in/verify` (+ `X-Idempotency-Key`, `X-Session-Token`) |
| `loginOptions(userId)` | `POST /auth/login/options` |
| `loginVerify(response)` | `POST /auth/login/verify` |
| `logout(userId, sessionToken)` | `POST /auth/logout` |

**Known gap:** `ApiPaths.playIntegrityVouch` is defined in `strings.dart` but there is no corresponding `AuthApi` method. The PI vouch submission occurs in `play_integrity_service.dart` using its own HTTP call.

### `session_store.dart`

SharedPreferences wrapper with allowList: `deviceId`, `userId`, `sessionToken`, `sessionExpiry`.

| Method | Description |
|---|---|
| `init()` | Creates `SharedPreferencesWithCache` instance |
| `saveSession(userId, sessionToken, expiresIn)` | Writes all fields + computes absolute expiry |
| `saveUserId(userId)` | Writes only `userId` (used after registration) |
| `getDeviceId()` | Returns or auto-generates+persists a UUID v4 device ID |
| `isSessionValid()` | Checks `sessionExpiry`; auto-clears expired session; returns `bool` |
| `getUserId()` | Returns `String?` |
| `getSessionToken()` | Returns `String?` |
| `clearSession()` | Removes `sessionToken` + `sessionExpiry` only; preserves `userId` and `deviceId` |

`saveSession()` is called after successful login and is the source of truth for authenticated app restarts.

### `play_integrity_service.dart`

`submitPlayIntegrityVouch()` — called after successful login once a valid session token exists. Requests a PI token from Google, submits it to `POST /auth/play-integrity/vouch` with `X-Session-Token`, stores the last-vouched date in `SharedPreferences`, and skips repeated submissions on the same day.

### `passkey.dart`

Method channel wrapper for native WebAuthn operations. Exposes:
- `register(optionsJson, userId, registrationToken)` — create credential, build device signature
- `login(optionsJson, userId)` — assert credential for login
- `checkIn(optionsJson, userId, sessionId, rssiReadings, bleToken, gpsLat, gpsLng, gpsIsMock)` — assert credential for check-in

The native side handles: ECDSA P-256 Android Keystore key generation (`StrongBox` preferred, `TEE` fallback), device signature construction (PAS JSON v1 canonical serialization), and WebAuthn credential assertion.

### `session_api.dart`

Session-related endpoint wrappers: BLE token retrieval, session data lookup.

### `offline_payload_service.dart`

Generates signed offline check-in payloads using PAS JSON v1 canonical serialization with `OFFLINE_CHECK_IN` flow. Used by `OfflineCheckInScreen` to produce QR codes the teacher scans.

### `class_cache_service.dart`

SharedPreferences-backed cache for class roster and schedule data. Used by teacher screens during offline sessions to avoid network dependency.

### `ble_advertiser_service.dart`

BLE advertising service backed by `NativeBleAdvertiser.kt` (Android native MethodChannel). Used by teacher device to broadcast the BLE proximity token so student devices can scan and report RSSI.

### `notification_service.dart`

MethodChannel-based local notification service. Used to alert students when their PI daily vouch is about to expire.

### `user_api.dart`

Instance methods `getUser(userId)` and `updateUser(userId, data)`. Not used anywhere — `User.fromJson` is also unused.

---

## `strings.dart` — String Constants

| Class | Contents |
|---|---|
| `ApiPaths` | Path constants for auth, check-in, PI vouch, session, and offline sync endpoints |
| `AuthStrings` | Progress labels, BLE dialog strings, BLE/GPS error messages |
| `RegistrationStrings` | Progress labels and error body |
| `QrStrings` | Registration QR parsing and unexpected-failure error messages |
| `HomeStrings` | App bar title, labels, `userId(id)` helper |
| `LoginStrings` | App title, subtitle, 3 button labels |

---

## `config/config.dart` — Compile-Time Configuration

Set via `--dart-define` at build time or in `launch.json`.

| Field | Default | Purpose |
|---|---|---|
| `apiBaseUrl` | `https://api-attendance.whatta.top` | Backend base URL |
| `rpId` | `attendance.whatta.top` | WebAuthn Relying Party ID |
| `rpName` | `Passkey Attendance System` | RP display name |
| `registrationProtocol` | `shifterest-pas` | Deep link scheme |
| `secureStoreChannel` | `pas/secure_store` | Method channel name (hardcoded; no env override) |

---

## Critical Bugs Summary

No known blocking auth/session persistence bugs remain in the Flutter client after the current pass. Remaining work is feature-completeness, not transport correctness.

---

## Missing Features Summary

| Feature | Notes |
|---|---|
| Attendance history screen | Students can't view their own past records |
| Profile / settings screen | Doesn't exist |
| `User` model + `UserApi` wired up | Data class exists, unused |

## Implemented Features (vibed branch)

| Feature | Implementation |
|---|---|
| Post-check-in outcome screen | `check_in_result_screen.dart` — assurance band badge + signal breakdown chips |
| Offline QR check-in flow | `offline_check_in_screen.dart` (student QR gen), `teacher_offline_session_screen.dart`, `teacher_offline_scanner_screen.dart` |
| Home screen content | PI vouch expiry banner, last check-in card, "Check In Offline" button, WidgetsBindingObserver for resume vouch check |
| Teacher dashboard | `teacher_dashboard_screen.dart` — roster, status/band badges, anomaly icons, approve/reject bottom sheet |
| BLE advertising (teacher) | `ble_advertiser_service.dart` + `NativeBleAdvertiser.kt` (Android native) |
| Class data caching | `class_cache_service.dart` — SharedPreferences-backed cache for offline teacher use |
| Notification service | `notification_service.dart` — MethodChannel for PI vouch expiry local notifications |
| Offline payload signing | `offline_payload_service.dart` — generates PAS JSON v1 payload with `offline_check_in` flow |

---

## Flutter Dev Commands

```powershell
cd frontend/flutter
flutter run                      # Run on connected device
flutter analyze                  # Static analysis
flutter test                     # Run tests
```
