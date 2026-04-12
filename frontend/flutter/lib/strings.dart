final class ApiPaths {
  static const String registerOptions = '/auth/register/options';
  static const String registerVerify = '/auth/register/verify';
  static const String checkInInitiate = '/auth/check-in/initiate';
  static const String checkInVerify = '/auth/check-in/verify';
  static const String loginOptions = '/auth/login/options';
  static const String loginVerify = '/auth/login/verify';
  static const String webLoginVerify = '/auth/web-login/verify';
  static const String logout = '/auth/logout';
  static const String playIntegrityVouch = '/auth/play-integrity/vouch';
  static const String playIntegrityNonce = '/auth/play-integrity/nonce';
  static const String playIntegrityVouchStatus =
      '/auth/play-integrity/vouch-status';
  static const String offlineSync = '/sessions/offline-sync';
  static String sessionsOpenTeacher() => '/sessions/open/teacher';
  static String teacherActiveSession() => '/sessions/active/teacher';
  static String teacherClasses(String teacherId) => '/users/$teacherId/classes';
  static String sessionClose(String id) => '/sessions/$id/close';
  static String sessionBleToken(String id) => '/sessions/$id/ble-token';
  static String sessionNfcToken(String id) => '/sessions/$id/nfc-token';
  static String sessionRecords(String id) => '/records/by-session/$id';
  static String getUser(String id) => '/users/$id';
  static String recordsByUser(String userId) => '/records/by-user/$userId';
}

final class AuthStrings {
  static const String loggingIn = 'Logging in...';
  static const String checkingIn = 'Checking in...';
  static const String initiatingLogin = 'Initiating login with server...';
  static const String initiatingCheckIn = 'Initiating check-in with server...';
  static const String collectingBle = 'Collecting BLE proximity signal...';
  static const String collectingGps = 'Collecting GPS position...';
  static const String collectingNfc =
      'Tap NFC reader to submit proximity token...';
  static const String verifyingPasskey = 'Verifying passkey with server...';
  static const String verifyingCheckIn = 'Verifying check-in with server...';
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
  static const String retry = 'Retry';
  static const String returnToLogin = 'Return to login';
  static const String returnToDashboard = 'Return to dashboard';
}

final class RegistrationStrings {
  static const String title = 'Register device';
  static const String subtitle =
      'Link this phone and your passkey to the attendance system.';
  static const String registering = 'Registering...';
  static const String initiating = 'Initiating registration with server...';
  static const String creatingPasskey = 'Creating passkey...';
  static const String verifyingPasskey = 'Verifying passkey with server...';
  static const String errorBody =
      'Something went wrong during registration. Please try again.';
  static const String retry = 'Retry registration';
  static const String returnToLogin = 'Return to login';
  static const String cancel = 'Cancel';
}

final class QrStrings {
  static const String registrationTitle = 'Scan registration QR';
  static const String registrationBody =
      'Align the registration code inside the frame to continue.';
  static const String webLoginTitle = 'Scan web login QR';
  static const String webLoginBody =
      'Align the web login code inside the frame to continue sign-in.';
  static const String errorInvalidQr = 'Invalid registration QR code';
  static const String errorMissingData = 'Missing registration data';
  static const String errorUnexpectedFailure =
      'Unable to process the scanned QR code';
  static const String errorInvalidWebLoginQr = 'Invalid web login QR code';
  static const String errorMissingWebLoginToken =
      'Missing token in web login QR';
  static const String torch = 'Torch';
}

final class HomeStrings {
  static const String appBarTitle = 'Attendance';
  static const String dashboardTitle = 'Dashboard';
  static const String dashboardShellLabel = 'Student workspace';
  static const String dashboardTab = 'Dashboard';
  static const String checkInTab = 'Check-in';
  static const String historyTab = 'History';
  static const String backToLogin = 'Back to Login';
  static const String signedIn = 'Signed in';
  static const String readyTitle = 'Ready to check in';
  static const String noOngoingSession = 'No ongoing check-in session';
  static const String attestationPassed = 'Android key attestation passed';
  static const String attestationUnavailable =
      'Android key attestation unavailable';
  static const String currentClassLabel = 'Current target';
  static const String integrityTitle = 'Integrity';
  static const String integrityHealthy = 'Play Integrity vouched';
  static const String integrityNeedsRefresh = 'Play Integrity needs refresh';
  static const String recentStatus = 'Recent check-ins';
  static const String proximityTitle = 'Proximity';
  static const String identityTitle = 'Identity';
  static const String scoreLabel = 'Score';
  static const String checkInNow = 'Check in now';
  static const String bleSupported = 'Bluetooth is on, with BLE support';
  static const String bleUnsupported = 'BLE is not supported on this device';
  static const String bluetoothOn = 'Bluetooth is on, with BLE support';
  static const String bluetoothOff = 'Bluetooth is off';
  static const String gpsServicesOn = 'Location services on';
  static const String gpsServicesOff = 'Location services off';
  static const String gpsPermissionGranted = 'Location permission granted';
  static const String gpsPermissionDenied =
      'Location services on, permission not granted';
  static const String nfcAvailable = 'NFC available';
  static const String nfcUnavailable = 'NFC off';
  static const String nfcUnsupported = 'NFC not supported on this device';
  static const String deviceBindingActive = 'Device binding active';
  static const String registrationNeeded = 'Device registration needed';
  static const String recentHistoryEmpty = 'No recent check-ins yet';
  static const String sessionLabel = 'Session';
  static const String turnOn = 'Turn on';
  static const String grant = 'Grant';
  static const String moreInfo = 'More info';
  static const String bleInfoTitle = 'BLE limitation';
  static const String bleInfoBody =
      'This device cannot collect Bluetooth Low Energy proximity, so online check-in will have reduced proximity evidence.';
  static const String nfcInfoTitle = 'NFC unavailable';
  static const String nfcInfoBody =
      'Turn on NFC in system settings if your device supports it. Online check-in can still proceed without NFC when other signals are available.';
  static const String lastCheckIn = 'Last check-in';
  static const String piVouchExpiring =
      'Your Play Integrity vouch expires soon. Please re-verify your device integrity.';
  static const String settingsTitle = 'Settings';
  static const String accountSheetTitle = 'Student account';
  static const String accountSheetBody =
      'Manage account shortcuts, settings, and sign out.';
  static const String settingsAction = 'Settings';
  static const String signOutAction = 'Sign out';
  static const String accountLabel = 'Account';
  static const String deviceTitle = 'Device';
  static const String deviceIdLabel = 'Device ID';
  static const String studentRoleLabel = 'Student';
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
  static const String appTitle = 'Passkey Attendance\nSystem';
  static const String subtitleRegistered =
      'Continue with your passkey or scan a web login code.';
  static const String subtitleUnregistered =
      'Register this device to start using passkey attendance.';
  static const String buttonLoginPasskey = 'Login with passkey';
  static const String buttonLoginWebQr = 'Scan web login QR';
  static const String buttonRegisterPasskey = 'Register a new passkey';
}

final class TeacherStrings {
  static const String appBarTitle = 'Teacher';
  static const String openSession = 'Open Session';
  static const String landingTitle = 'Ready to open attendance';
  static const String landingBody =
      'Start a live session for normal check-in or switch to the offline flow when connectivity is unreliable.';
  static const String signedInLabel = 'Signed in as teacher';
  static const String liveSessionTitle = 'Live session';
  static const String liveSessionBody =
      'Open a classroom attendance window and broadcast proximity signals from this phone.';
  static const String offlineSessionBody =
      'Create an offline session, broadcast a short-lived nonce, and scan student QR payloads.';
  static const String sessionFlowTitle = 'What happens next';
  static const String sessionFlowStepOne =
      'Open the session and let the server lock the active class from your schedule.';
  static const String sessionFlowStepTwo =
      'Keep this phone visible so students can use BLE and, if enabled, NFC proximity.';
  static const String sessionFlowStepThree =
      'Review the live roster and resolve any low-assurance attempts before you close.';
  static const String noActiveClass = 'No active class right now';
  static const String sessionAlreadyOpen = 'A session is already open';
  static const String sessionOpened = 'Session opened';
  static const String sessionClosed = 'Session closed';
  static const String closeSession = 'Close Session';
  static const String closeSessionBody =
      'Closing ends this attendance window and stops new check-ins for the session.';
  static const String sessionActive = 'Session active';
  static const String sessionClosedLabel = 'Session closed';
  static const String sessionSummaryTitle = 'Live attendance window';
  static const String sessionSummaryBody =
      'Keep this screen open while students check in. BLE and NFC tokens stay tied to this session.';
  static const String sessionId = 'Session ID';
  static const String lastUpdated = 'Last updated';
  static const String refresh = 'Refresh';
  static const String openRoster = 'Open roster';
  static const String tokenReady = 'Ready';
  static const String tokenWaiting = 'Waiting for token';
  static const String tokenCopied = 'Copied to clipboard';
  static const String tokenUnavailableHint =
      'The server has not returned a token yet. Pull to refresh or wait for the next sync.';
  static const String bleBroadcasting = 'BLE broadcast available';
  static const String nfcBroadcasting = 'NFC tap enabled';
  static const String nfcOff = 'NFC tap disabled';
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
  static const String viewRosterHint =
      'Open the roster to review live attendance evidence and resolve low-assurance attempts.';
  static const String errorClosingSession = 'Failed to close session';
  static const String errorOpeningSession = 'Failed to open session';
  static const String errorBlePermissions =
      'Bluetooth permissions are required to open a session. Please grant access and try again.';
  static const String resumeSession = 'Resume Session';
  static const String activeSessionHint =
      'A session is currently open. Resume it or close it before starting a new one.';
  static const String leaveSessionHint =
      'The session will remain open. Students can still check in. Close the session first to end attendance.';
  static const String stay = 'Stay';
  static const String leave = 'Leave';
}

final class OfflineStrings {
  static const String studentTitle = 'Offline Check-In';
  static const String scanningForTeacher = 'Scanning for teacher device...';
  static const String noTeacherFound = 'No teacher device found';
  static const String retryScan = 'Retry Scan';
  static const String sessionFound = 'Session found';
  static const String sessionId = 'Session';
  static const String generateQr = 'Generate QR Code';
  static const String showQrToTeacher = 'Show this QR to your teacher';
  static const String expiresIn = 'Expires in';
  static const String cancel = 'Cancel';
  static const String errorMissingUserId = 'Missing user ID';
  static const String errorGeneratingPayload =
      'Failed to generate offline payload';
  static const String tabDescription =
      'Generate a short-lived QR payload when the normal online flow is unavailable.';
  static const String teacherSessionTitle = 'Offline Session';
  static const String selectClass = 'Select a class';
  static const String noClassesCached = 'No cached classes available';
  static const String chooseClass = 'Choose a class';
  static const String startOfflineSession = 'Start Offline Session';
  static const String advertising = 'Broadcasting...';
  static const String scanStudents = 'Scan Students';
  static const String stopAdvertising = 'Stop Broadcasting';
  static const String back = 'Back';
  static const String errorStartingBle = 'Failed to start BLE advertising';
  static const String scannerTitle = 'Scan Student QR';
  static const String scanned = 'Scanned';
  static const String scannedStudents = 'Scanned students';
  static const String submitSync = 'Submit to Server';
  static const String syncing = 'Syncing...';
  static const String syncSuccess = 'Records synced';
  static const String errorSyncing = 'Failed to sync offline records';
  static const String rejectNonce = 'Rejected: wrong session nonce';
  static const String rejectExpired = 'Rejected: QR expired';
  static const String rejectDuplicate = 'Already scanned';
  static const String rejectInvalid = 'Rejected: invalid QR data';
}

final class CheckInStrings {
  static const String title = 'Check-in';
  static const String normalTab = 'Normal';
  static const String offlineTab = 'Offline';
  static const String webLoginTab = 'Web login';
  static const String normalTitle = 'Normal check-in';
  static const String normalBody =
      'Use your passkey with proximity checks for the standard attendance flow.';
  static const String normalDisabled =
      'Normal check-in is available once you have an ongoing scheduled class.';
  static const String normalButton = 'Start normal check-in';
  static const String webLoginTitle = 'Web login';
  static const String webLoginBody =
      'Scan a web login QR from a browser to sign in there using this phone.';
  static const String webLoginButton = 'Scan web login QR';
  static const String stageIdleTitle = 'No ongoing check-in session';
  static const String stageIdleBody =
      'When a teacher opens attendance, the shape will wake up here.';
  static const String stageReadyTitle = 'Looking for teacher signal';
  static const String stageReadyBody =
      'Your current class is live. Move closer until the teacher signal locks in.';
  static const String stageDetectedTitle = 'Teacher signal detected';
  static const String stageDetectedBody =
      'Tap the shape to start a passkey check-in with the current proximity signal.';
  static const String stageSuccessTitle = 'Check-in recorded';
  static const String stageSuccessBody =
      'Your latest result is held here. Tap the shape again if you want another attempt.';
  static const String stageCheckingInTitle = 'Checking in…';
  static const String stageCheckingInBody =
      'Verifying your identity and proximity — hold tight.';
  static const String signalClose = 'Close range';
  static const String signalModerate = 'Moderate range';
  static const String signalFar = 'Far range';
  static const String signalUnavailable = 'No teacher signal yet';
  static const String bluetoothOff = 'Turn on Bluetooth';
  static const String bluetoothOffBody =
      'Tap the shape to enable Bluetooth for BLE check-in.';
  static const String bluetoothPermissionTitle = 'Allow Bluetooth access';
  static const String bluetoothPermissionBody =
      'Bluetooth permissions are needed before the teacher signal can appear.';
}

final class HistoryStrings {
  static const String title = 'Attendance History';
  static const String subtitle = 'Review recent attendance results.';
  static const String noRecords = 'No attendance records yet';
  static const String notLoggedIn = 'Not logged in';
  static const String score = 'Score';
  static const String bandHigh = 'High';
  static const String bandStandard = 'Standard';
  static const String bandLow = 'Low';
}

final class DashboardStrings {
  static const String title = 'Session Roster';
  static const String subtitle =
      'Review live attendance evidence and resolve low-assurance records.';
  static const String errorLoadingRecords = 'Failed to load records';
  static const String noRecords = 'No attendance records yet';
  static const String noFilteredRecords = 'No records in this view';
  static const String reviewRecord = 'Review Attendance';
  static const String reviewRecordBody =
      'Low-assurance attempts can be accepted or rejected after checking the evidence below.';
  static const String student = 'Student';
  static const String status = 'Status';
  static const String score = 'Score';
  static const String band = 'Band';
  static const String signals = 'Signals';
  static const String anomalies = 'Anomalies';
  static const String reasonOptional = 'Reason (optional)';
  static const String approve = 'Approve';
  static const String reject = 'Reject';
  static const String errorApproving = 'Failed to process approval';
  static const String total = 'Total';
  static const String needsReview = 'Needs review';
  static const String accepted = 'Accepted';
  static const String allFilter = 'All';
  static const String reviewFilter = 'Review';
  static const String acceptedFilter = 'Accepted';
  static const String lowAssuranceHint =
      'Low-assurance records need explicit teacher action before the session closes.';
  static const String missingSignal = 'Missing';
  static const String noAnomalies = 'No anomalies';
  static const String mockGps = 'Mock GPS detected';
  static const String signCountAnomaly = 'Sign count anomaly';
  static const String syncPending = 'Sync pending';
  static const String manuallyApproved = 'Manually approved';
}
