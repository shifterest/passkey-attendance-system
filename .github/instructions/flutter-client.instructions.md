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
- **GPS:** `geolocator`
- **QR scanning:** `mobile_scanner`
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
    home_screen.dart           — Post-login home (stub; needs full implementation)
  services/
    api_client.dart            — HTTP client (fetch helper)
    auth_api.dart              — Auth endpoint wrappers (static methods)
    passkey.dart               — Native passkey method channel wrapper
    play_integrity_service.dart — Play Integrity daily vouch
    secure_store.dart          — Keystore/Keychain secure storage (method channel)
    session_store.dart         — SharedPreferences session persistence
    user_api.dart              — User endpoint wrappers (instance methods; currently unused)
  widgets/
    error_dialog.dart          — Reusable error dialog
```

---

## Router and Navigation

Defined in `main.dart` via GoRouter:

| Route | Component | Notes |
|---|---|---|
| `/` | `AuthWrapper` | Session gate; redirects to `HomeScreen` or `LoginScreen` |
| `/register` | `RegistrationScreen` | Receives `?token=&user_id=` from deep link |

`AuthWrapper` calls `SessionStore.isSessionValid()`. If the session is valid it renders `HomeScreen`; otherwise `LoginScreen`.

**Deep link handling:** `Main._routeUri()` validates the incoming URI scheme (`Config.registrationProtocol` = `shifterest-pas`) and host (`register`), then navigates to `/register?token=...&user_id=...`. Both cold-start links (via `getInitialLink()`) and live stream links are handled.

**Navigation inconsistency:** `HomeScreen` pushes `AuthenticationScreen` via `MaterialPageRoute` instead of GoRouter. `RegistrationScreen` also navigates to `HomeScreen` via `MaterialPageRoute`. These should be migrated to GoRouter for consistency.

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

Full-screen camera scanner using `mobile_scanner`. Parses the first detected barcode as a URI, validates scheme and host, extracts `token` and `user_id` query params, navigates to `/register?token=...&user_id=...`.

**Known gap:** error catch block uses a hardcoded `'An error occurred'` string instead of a `QrStrings` constant.

---

### `RegistrationScreen`

Auto-starts `_startRegistration()` on mount. Props: `userId`, `registrationToken` (from deep link).

**`_register()` flow:**
1. `POST /auth/register/options` — gets WebAuthn creation options
2. `passkey.register(optionsJson, userId, registrationToken)` — creates passkey on device
3. `POST /auth/register/verify` — sends credential + device signature + device public key + attestation
4. `SessionStore.saveUserId(userId)` — persists user ID for future launches

On success → navigates to `HomeScreen`.

**Known bugs:**
- `SessionStore.saveSession()` is **never called after registration**. A session token is not returned by `register/verify` and is not requested — the student must separately log in after registration.
- Navigation uses `MaterialPageRoute` instead of GoRouter.

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

**BLE collection (`_collectBleProximity()`):**
- Requests `bluetoothScan` + `bluetoothConnect` permissions (Android)
- Checks BLE supported + on; prompts to enable if off
- Full 30-second scan; collects all RSSI readings as `List<int>` and the strongest advertised device name as `bleToken`
- Returns `({List<int> rssiReadings, String? bleToken})`
- Throws on missing permissions, unsupported BLE, BT off, or no signal detected

**GPS collection (`_collectGpsPosition()`):**
- Requests location permission; returns `null` if denied
- `Geolocator.getCurrentPosition` with 10s timeout; returns `null` on error
- `gps_is_mock = position?.isMocked ?? false`

**Critical bugs:**
- **`SessionStore.saveSession()` is never called after a successful login.** The session token returned by `POST /auth/login/verify` is received but discarded. The `LoginSessionBase.session_token` field is present in the response but is never extracted or stored. As a result:
  - `SessionStore.isSessionValid()` returns `false` on every app relaunch
  - Every launch sends the user back to `LoginScreen` regardless of prior login
  - `AuthApi.logout()` calls `SessionStore.getSessionToken()` which returns `null` — logout body sends `null` as session token
- **Navigation pattern:** on successful login, pushes `HomeScreen` via `MaterialPageRoute` — not GoRouter.

---

### `HomeScreen`

Minimal stub. Loads `SessionStore.getUserId()` in `initState`. Renders a `FutureBuilder` showing the userId string and two buttons: logout + "Check In Now".

"Check In Now" → pushes `AuthenticationScreen(userId, login: false)`.

**Logout flow:** calls `AuthApi.logout(userId, sessionToken)` (silently ignores errors), then `SessionStore.clearSession()`, then pops to `/` via GoRouter.

**What's missing from Home (all unbuilt):**
- Upcoming or active class card showing current session status
- Check-in outcome display (assurance band + whether retry would help — required by architecture)
- Attendance history screen / per-session result list
- BLE background scan initiation toggle
- Offline QR check-in mode entry point
- Profile / settings screen entry
- PI vouch status indicator

---

## Services

### `auth_api.dart`

All methods are `static`. Constructs a fresh `ApiClient` per call. All responses must be `Map<String, dynamic>`.

| Method | Endpoint |
|---|---|
| `registerOptions(userId, token)` | `POST /auth/register/options` |
| `registerVerify(response)` | `POST /auth/register/verify` |
| `checkInOptions(userId)` | `POST /auth/check-in/options` |
| `checkInVerify(response)` | `POST /auth/check-in/verify` (+ `X-Idempotency-Key` header) |
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

**`saveSession()` is complete but is never called anywhere.** The session is always ephemeral.

### `play_integrity_service.dart`

`submitPlayIntegrityVouch()` — called once on app launch from `main()` (unawaited). Requests PI token from Google, submits to `POST /auth/play-integrity/vouch`. Stores last-vouched date in `SharedPreferences`; skips if already vouched today. Silently handles 503 (PI disabled server-side).

### `passkey.dart`

Method channel wrapper for native WebAuthn operations. Exposes:
- `register(optionsJson, userId, registrationToken)` — create credential, build device signature
- `login(optionsJson, userId)` — assert credential for login
- `checkIn(optionsJson, userId, sessionId, rssiReadings, bleToken, gpsLat, gpsLng, gpsIsMock)` — assert credential for check-in

The native side handles: ECDSA P-256 Android Keystore key generation (`StrongBox` preferred, `TEE` fallback), device signature construction (PAS JSON v1 canonical serialization), and WebAuthn credential assertion.

### `user_api.dart`

Instance methods `getUser(userId)` and `updateUser(userId, data)`. Not used anywhere — `User.fromJson` is also unused.

---

## `strings.dart` — String Constants

| Class | Contents |
|---|---|
| `ApiPaths` | 7 path constants + `playIntegrityVouch` (no corresponding wrapper) |
| `AuthStrings` | Progress labels, BLE dialog strings, BLE/GPS error messages |
| `RegistrationStrings` | Progress labels and error body |
| `QrStrings` | 2 error messages |
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

| Bug | Severity | Effect |
|---|---|---|
| `SessionStore.saveSession()` never called after login | Critical | Every login is ephemeral; app re-launches send user to LoginScreen every time; logout sends null session token |
| Login session token response discarded in `AuthenticationScreen` | Critical | Cascades from above |
| `AuthApi` has no Play Integrity vouch method | Low | `ApiPaths.playIntegrityVouch` is dead constant; vouch works via `play_integrity_service.dart` internal call |
| QR error hardcoded string | Low | One non-constant string leak |

---

## Missing Features Summary

| Feature | Notes |
|---|---|
| Post-check-in outcome screen | Required by architecture: show assurance band + "retry would help" |
| Attendance history screen | Students can't see their own records |
| Offline QR check-in flow | `qr_scanner_screen` is registration-only; offline attendance QR unbuilt |
| Home screen content | Class context, session status, PI vouch indicator |
| Profile / settings screen | Doesn't exist |
| GoRouter migration for imperative pushes | `HomeScreen` and `RegistrationScreen` use `MaterialPageRoute` |
| `User` model + `UserApi` wired up | Data class exists, unused |

---

## Flutter Dev Commands

```powershell
cd frontend/flutter
flutter run                      # Run on connected device
flutter analyze                  # Static analysis
flutter test                     # Run tests
```
