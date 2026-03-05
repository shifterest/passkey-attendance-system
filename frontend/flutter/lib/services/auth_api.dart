import 'api_client.dart';
import '../config/config.dart';

class AuthApi {
  // Registration
  static Future<Map<String, dynamic>> registerOptions(
    String userId,
    String registrationToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/register/options', {
      'user_id': userId,
      'registration_token': registrationToken,
    });
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> registerVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/register/verify', response);
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  // Authentication
  static Future<Map<String, dynamic>> authenticateOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/authenticate/options', {
      'user_id': userId,
    });
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> authenticateVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/authenticate/verify', response);
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  // Login and logout
  static Future<Map<String, dynamic>> loginOptions(String userId) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/login/options', {
      'user_id': userId,
    });
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> loginVerify(
    Map<String, dynamic> response,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/login/verify', response);
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }

  static Future<Map<String, dynamic>> logout(
    String userId,
    String sessionToken,
  ) async {
    ApiClient client = ApiClient(Config.apiBaseUrl);

    dynamic options = await client.post('/auth/logout', {
      'user_id': userId,
      'session_token': sessionToken,
    });
    if (options is Map<String, dynamic>) {
      return options;
    } else {
      throw Exception('Invalid response from server');
    }
  }
}
