final class ApiPaths {
  static const String registerOptions = '/auth/register/options';
  static const String registerVerify = '/auth/register/verify';
  static const String checkInOptions = '/auth/check-in/options';
  static const String checkInVerify = '/auth/check-in/verify';
  static const String loginOptions = '/auth/login/options';
  static const String loginVerify = '/auth/login/verify';
  static const String logout = '/auth/logout';
  static const String playIntegrityVouch = '/auth/play-integrity/vouch';
  static String sessionsOpenTeacher() => '/sessions/open/teacher';
  static String sessionClose(String id) => '/sessions/$id/close';
  static String sessionBleToken(String id) => '/sessions/$id/ble-token';
  static String sessionNfcToken(String id) => '/sessions/$id/nfc-token';
  static String sessionRecords(String id) => '/records/by-session/$id';
  static String getUser(String id) => '/users/$id';
}

final class AuthStrings {
  static const String loggingIn = 'Logging in...';
  static const String checkingIn = 'Checking in...';
  static const String initiatingLogin = 'Initiating login with server...';
  static const String initiatingCheckIn = 'Initiating check-in with server...';
  static const String collectingBle = 'Collecting BLE proximity signal...';
  static const String collectingGps = 'Collecting GPS position...';
  static const String verifyingPasskey = 'Verifying passkey with server...';
  static const String checkInSuccess = 'Check-in successful';
  static const String authErrorBody =
      'Something went wrong during authentication. Please try again.';

  static const String bleDialogTitle = 'Bluetooth required';
  static const String bleDialogBody =
      "Bluetooth is currently turned off. You can't check in without it.";
  static const String bleDialogCancel = 'Cancel';
  static const String bleDialogEnable = 'Enable Bluetooth';

  static const String errorBlePermissions =
      'Bluetooth permissions are required for attendance check-in';
  static const String errorBleNotSupported =
      'Bluetooth is not supported on this device';
  static const String errorBleMustBeOn =
      'Bluetooth must be turned on for attendance check-in';
  static const String errorNoBleSignal = 'No BLE proximity signal detected';
  static const String errorMissingSessionId =
      'Missing session ID in check-in options';
  static const String errorMissingSessionToken =
      'Missing session token in login response';
  static const String errorMissingSessionExpiry =
      'Missing session expiry in login response';
}

final class RegistrationStrings {
  static const String registering = 'Registering...';
  static const String initiating = 'Initiating registration with server...';
  static const String creatingPasskey = 'Creating passkey...';
  static const String verifyingPasskey = 'Verifying passkey with server...';
  static const String errorBody =
      'Something went wrong during registration. Please try again.';
}

final class QrStrings {
  static const String errorInvalidQr = 'Invalid registration QR code';
  static const String errorMissingData = 'Missing registration data';
  static const String errorUnexpectedFailure =
      'Unable to process the scanned QR code';
}

final class HomeStrings {
  static const String appBarTitle = 'Attendance';
  static const String backToLogin = 'Back to Login';
  static const String signedIn = 'Signed in';
  static const String checkInNow = 'Check In Now';
  static String userId(String id) => 'User ID: $id';
}

final class LoginStrings {
  static const String appTitle = 'Passkey attendance system';
  static const String selectOptions = 'Select any of the options below';
  static const String buttonLoginPasskey = 'Login with passkey';
  static const String buttonLoginPassword = 'Login with password and 2FA';
  static const String buttonRegisterPasskey = 'Register a new passkey';
}

final class TeacherStrings {
  static const String appBarTitle = 'Teacher';
  static const String openSession = 'Open Session';
  static const String noActiveClass = 'No active class right now';
  static const String sessionAlreadyOpen = 'A session is already open';
  static const String sessionOpened = 'Session opened';
  static const String sessionClosed = 'Session closed';
  static const String closeSession = 'Close Session';
  static const String sessionActive = 'Session active';
  static const String bleToken = 'BLE Token';
  static const String bleTokenUnavailable = 'Unavailable';
  static const String nfcToken = 'NFC Token';
  static const String nfcTokenUnavailable = 'Unavailable';
  static const String nfcEnabled = 'NFC proximity';
  static const String nfcNotSupported = 'NFC not supported on this device';
  static const String checkedIn = 'Checked in';
  static const String present = 'present';
  static const String late = 'late';
  static const String absent = 'absent';
  static const String sessionScreen = 'Live Session';
  static const String loadingToken = 'Loading...';
  static const String errorClosingSession = 'Failed to close session';
  static const String errorOpeningSession = 'Failed to open session';
}
