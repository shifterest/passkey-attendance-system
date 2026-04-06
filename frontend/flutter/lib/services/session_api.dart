import 'api_client.dart';
import '../config/config.dart';
import '../services/session_store.dart';
import '../strings.dart';

class SessionApi {
  static Future<Map<String, String>> _sessionHeaders() async {
    final sessionToken = await SessionStore.getSessionToken();
    if (sessionToken == null || sessionToken.isEmpty) {
      throw Exception('Missing session token');
    }
    return {'X-Session-Token': sessionToken};
  }

  static Future<Map<String, dynamic>> openTeacherSession(
    String teacherId,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.post(ApiPaths.sessionsOpenTeacher(), {
      'teacher_id': teacherId,
      'client_time': DateTime.now().toIso8601String(),
    }, extraHeaders: headers);
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }

  static Future<Map<String, dynamic>> closeSession(String sessionId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.post(
      ApiPaths.sessionClose(sessionId),
      {},
      extraHeaders: headers,
    );
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }

  static Future<Map<String, dynamic>> getBleToken(String sessionId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.get(
      ApiPaths.sessionBleToken(sessionId),
      {},
      extraHeaders: headers,
    );
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }

  static Future<Map<String, dynamic>> getNfcToken(String sessionId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.get(
      ApiPaths.sessionNfcToken(sessionId),
      {},
      extraHeaders: headers,
    );
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }

  static Future<List<dynamic>> getSessionRecords(String sessionId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.get(
      '${ApiPaths.sessionRecords(sessionId)}?canonical=true&limit=500',
      {},
      extraHeaders: headers,
    );
    if (response is List) return response;
    throw Exception('Invalid response from server');
  }

  static Future<Map<String, dynamic>> offlineSync({
    required String classId,
    required String sessionId,
    required List<String> nonceSet,
    required List<Map<String, dynamic>> records,
  }) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    dynamic response = await client.post(ApiPaths.offlineSync, {
      'class_id': classId,
      'session_id': sessionId,
      'opened_at': DateTime.now().toIso8601String(),
      'closed_at': DateTime.now().toIso8601String(),
      'nonce_set': nonceSet,
      'records': records,
    }, extraHeaders: headers);
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }

  static Future<Map<String, dynamic>> approveRecord(
    String recordId,
    bool approve,
    String reason,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final headers = await _sessionHeaders();
    final path = '/records/$recordId/approve';
    dynamic response = await client.post(path, {
      'approved': approve,
      if (reason.isNotEmpty) 'reason': reason,
    }, extraHeaders: headers);
    if (response is Map<String, dynamic>) return response;
    throw Exception('Invalid response from server');
  }
}
