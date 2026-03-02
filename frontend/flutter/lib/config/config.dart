import 'package:flutter_dotenv/flutter_dotenv.dart';

class Config {
  static late String apiBaseUrl;
  static late String rpId;
  static late String rpName;

  static Future<void> init() async {
    await dotenv.load(fileName: ".env");

    apiBaseUrl = dotenv.env['API_BASE_URL'] ?? 'http://localhost:8000';
    rpId = dotenv.env['RP_ID'] ?? 'attendance.whatta.top';
    rpName = dotenv.env['RP_NAME'] ?? 'Passkey Attendance System';
  }
}
