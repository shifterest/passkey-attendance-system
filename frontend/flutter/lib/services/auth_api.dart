import 'package:uuid/uuid.dart';
import 'api_client.dart';
import '../config/config.dart';
import '../services/session_store.dart';
import '../strings.dart';

class AuthApi {
  static Future<Map<String, String>> _sessionHeaders() async {
    final sessionToken = await SessionStore.getSessionToken();
    if (sessionToken == null || sessionToken.isEmpty) {
      throw Exception('Missing session token');
    }
    return {'X-Session-Token': sessionToken};
  }

  // Registration
  static Future<Map<String, dynamic>> registerOptions(
    String userId,
    String registrationToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic registrationOptions = await client.post(ApiPaths.registerOptions, {
      'user_id': userId,
      'registration_token': registrationToken,
    });
    if (registrationOptions is Map<String, dynamic>) {
      return registrationOptions;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> registerVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic registrationResponse = await client.post(
      ApiPaths.registerVerify,
      response,
    );
    if (registrationResponse is Map<String, dynamic>) {
      return registrationResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  // Authentication
  static Future<Map<String, dynamic>> checkInOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final sessionHeaders = await _sessionHeaders();

    dynamic authenticationOptions = await client.post(ApiPaths.checkInOptions, {
      'user_id': userId,
    }, extraHeaders: sessionHeaders);
    if (authenticationOptions is Map<String, dynamic>) {
      return authenticationOptions;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> checkInVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);
    final idempotencyKey = const Uuid().v4();
    final sessionHeaders = await _sessionHeaders();

    dynamic authenticateResponse = await client.post(
      ApiPaths.checkInVerify,
      response,
      extraHeaders: {...sessionHeaders, 'X-Idempotency-Key': idempotencyKey},
    );
    if (authenticateResponse is Map<String, dynamic>) {
      return authenticateResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  // Login and logout
  static Future<Map<String, dynamic>> loginOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic loginOptions = await client.post(ApiPaths.loginOptions, {
      'user_id': userId,
    });
    if (loginOptions is Map<String, dynamic>) {
      return loginOptions;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> loginVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic loginResponse = await client.post(ApiPaths.loginVerify, response);
    if (loginResponse is Map<String, dynamic>) {
      return loginResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> webLoginVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic webLoginResponse = await client.post(ApiPaths.webLoginVerify, response);
    if (webLoginResponse is Map<String, dynamic>) {
      return webLoginResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> logout(
    String userId,
    String sessionToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic logoutResponse = await client.post(ApiPaths.logout, {
      'user_id': userId,
      'session_token': sessionToken,
    });
    if (logoutResponse is Map<String, dynamic>) {
      return logoutResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }
}
