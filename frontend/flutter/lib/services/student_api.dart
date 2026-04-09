import 'api_client.dart';
import '../config/config.dart';
import '../services/session_store.dart';

class StudentApi {
  static Future<Map<String, String>> _sessionHeaders() async {
    final sessionToken = await SessionStore.getSessionToken();
    if (sessionToken == null || sessionToken.isEmpty) {
      throw Exception('Missing session token');
    }
    return {'X-Session-Token': sessionToken};
  }

  static Future<Map<String, dynamic>> getStudentDetails(String userId) async {
    final client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    final response = await client.get(
      '/students/$userId',
      {},
      extraHeaders: headers,
    );
    if (response is Map<String, dynamic>) {
      return response;
    }
    throw Exception('Invalid response from server');
  }
}
