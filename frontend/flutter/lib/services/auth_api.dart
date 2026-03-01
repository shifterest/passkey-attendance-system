import 'api_client.dart';
import '../config/config.dart';

class AuthApi {
  // Registration
  Future<Map<String, dynamic>> registerOptions(
    String userId,
    String registrationToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/register/options', {
      'user_id': userId,
      'registration_token': registrationToken,
    });
  }

  Future<Map<String, dynamic>> registerVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/register/verify', response);
  }

  // Authentication
  Future<Map<String, dynamic>> authenticateOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/authenticate/options', {'user_id': userId});
  }

  Future<Map<String, dynamic>> authenticateVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/authenticate/verify', response);
  }

  // Login and logout
  Future<Map<String, dynamic>> loginOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/login/options', {'user_id': userId});
  }

  Future<Map<String, dynamic>> loginVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/login/verify', response);
  }

  Future<Map<String, dynamic>> logout(
    String userId,
    String sessionToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    return client.post('/auth/logout', {
      'user_id': userId,
      'session_token': sessionToken,
    });
  }
}
