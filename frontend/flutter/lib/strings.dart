final class ApiPaths {
  static const String registerOptions = '/auth/register/options';
  static const String registerVerify = '/auth/register/verify';
  static const String checkInOptions = '/auth/check-in/options';
  static const String checkInVerify = '/auth/check-in/verify';
  static const String loginOptions = '/auth/login/options';
  static const String loginVerify = '/auth/login/verify';
  static const String logout = '/auth/logout';
  static const String playIntegrityVouch = '/auth/play-integrity/vouch';
  static const String playIntegrityNonce = '/auth/play-integrity/nonce';
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

final class CheckInResultStrings {
  static const String appBarTitle = 'Check-In Result';
  static const String present = 'Present';
  static const String late = 'Late';
  static const String absent = 'Absent';
  static const String bandHigh = 'High assurance';
  static const String bandStandard = 'Standard assurance';
  static const String bandLow =
      'Low assurance — re-attempt may improve proximity score';
  static const String proximityScore = 'Proximity score';
  static const String done = 'Done';
  static const String unknownStatus = 'Unknown';
}

final class LoginStrings {
  static const String appTitle = 'Passkey attendance system';
  static const String selectOptions = 'Select any of the options below';
  static const String buttonLoginPasskey = 'Login with passkey';
  static const String buttonLoginPassword = 'Login with password and 2FA';
  static const String buttonRegisterPasskey = 'Register a new passkey';
}
