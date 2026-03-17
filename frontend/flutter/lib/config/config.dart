class Config {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api-attendance.whatta.top',
  );
  static const String rpId = String.fromEnvironment(
    'RP_ID',
    defaultValue: 'attendance.whatta.top',
  );
  static const String rpName = String.fromEnvironment(
    'RP_NAME',
    defaultValue: 'Passkey Attendance System',
  );
  static const String registrationProtocol = String.fromEnvironment(
    'REGISTRATION_PROTOCOL',
    defaultValue: 'shifterest-pas',
  );
  static const String secureStoreChannel = 'pas/secure_store';

  static Future<void> init() async {}
}
