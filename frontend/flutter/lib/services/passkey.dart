import 'package:passkeys/authenticator.dart';
import 'package:passkeys/types.dart';

// Registration
Future<Map<String, dynamic>> register(
  Map<String, dynamic> optionsJson,
  String userId,
  String registrationToken,
  String deviceId,
) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = RegisterRequestType.fromJson(optionsJson);

    final response = await authenticator.register(request);
    return {
      'user_id': userId,
      'registration_token': registrationToken,
      'device_id': deviceId,
      'credential': response.toJson(),
    };
  } catch (e) {
    throw Exception('Registration error: $e');
  }
}

// Authentication
Future<Map<String, dynamic>> authenticate(
  Map<String, dynamic> optionsJson,
  String userId,
  String sessionId,
) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = AuthenticateRequestType.fromJson(optionsJson);

    final response = await authenticator.authenticate(request);
    return {
      'user_id': userId,
      'session_id': sessionId,
      'credential': response.toJson(),
    };
  } catch (e) {
    throw Exception('Authentication error: $e');
  }
}

// Login
Future<Map<String, dynamic>> login(
  Map<String, dynamic> optionsJson,
  String userId,
) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = AuthenticateRequestType.fromJson(optionsJson);

    final response = await authenticator.authenticate(request);
    return {'user_id': userId, 'credential': response.toJson()};
  } catch (e) {
    throw Exception('Login error: $e');
  }
}
