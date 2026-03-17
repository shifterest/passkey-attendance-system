# passkey_attendance_system

A FIDO2 passkey attendance app using Android passkeys, device keys, and proximity signals.

## Configure Build Values

Edit `frontend/flutter/.dart_defines.json` directly:

```json
{
  "API_BASE_URL": "http://10.0.2.2:8000",
  "RP_ID": "localhost",
  "RP_NAME": "Passkey Attendance System",
  "REGISTRATION_PROTOCOL": "shifterest-pas"
}
```

`API_BASE_URL` uses `10.0.2.2` for the Android emulator (maps to host `localhost`). Use your machine's LAN IP for a physical device.

Backend and web configuration is managed via `backend/.env` and `frontend/web/.env` directly.

## Run The Flutter App

```bash
cd frontend/flutter
flutter run --dart-define-from-file=.dart_defines.json
```
