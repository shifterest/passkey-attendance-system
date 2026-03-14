import 'api_client.dart';
import '../config/config.dart';

class AuthApi {
  // Registration
  static Future<Map<String, dynamic>> registerOptions(
    String userId,
    String registrationToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic registrationOptions = await client.post('/auth/register/options', {
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
      '/auth/register/verify',
      response,
    );
    if (registrationResponse is Map<String, dynamic>) {
      return registrationResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  // Authentication
  static Future<Map<String, dynamic>> authenticateOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic authenticationOptions = await client.post(
      '/auth/check-in/options',
      {'user_id': userId},
    );
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

    dynamic authenticateResponse = await client.post(
      '/auth/check-in/verify',
      response,
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

    dynamic loginOptions = await client.post('/auth/login/options', {
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

    dynamic loginResponse = await client.post('/auth/login/verify', response);
    if (loginResponse is Map<String, dynamic>) {
      return loginResponse;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> logout(
    String userId,
    String sessionToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic logoutResponse = await client.post('/auth/logout', {
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
