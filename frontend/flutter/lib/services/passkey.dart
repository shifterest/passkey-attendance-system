import 'dart:convert';
import 'dart:typed_data';

import 'package:passkey_attendance_system/contracts/device.dart';
import 'package:passkey_attendance_system/services/secure_store.dart';
import 'package:passkeys/authenticator.dart';
import 'package:passkeys/types.dart';

String? _extractChallenge(Map<String, dynamic> optionsJson) {
  final topLevel = optionsJson['challenge'];
  if (topLevel is String) {
    return topLevel;
  }

  final publicKey = optionsJson['publicKey'];
  if (publicKey is Map<String, dynamic>) {
    final nested = publicKey['challenge'];
    if (nested is String) {
      return nested;
    }
  }

  return null;
}

int? _extractIssuedAtMs(Map<String, dynamic> optionsJson) {
  final value = optionsJson['issued_at_ms'];
  if (value is int) {
    return value;
  }

  if (value is String) {
    return int.tryParse(value);
  }

  return null;
}

String? _extractCredentialId(Map<String, dynamic> credentialJson) {
  final id = credentialJson['id'];
  if (id is String) {
    return id;
  }

  final rawId = credentialJson['rawId'];
  if (rawId is String) {
    return rawId;
  }

  return null;
}

Map<String, dynamic> _sanitizeRegisterOptions(
  Map<String, dynamic> optionsJson,
) {
  final sanitized = Map<String, dynamic>.from(optionsJson);

  final authenticatorSelection = sanitized['authenticatorSelection'];
  if (authenticatorSelection is Map) {
    final selection = Map<String, dynamic>.from(
      authenticatorSelection as Map<dynamic, dynamic>,
    );

    final requireResidentKey = selection['requireResidentKey'];
    if (requireResidentKey is! bool) {
      selection['requireResidentKey'] = false;
    }

    final residentKey = selection['residentKey'];
    if (residentKey is! String || residentKey.isEmpty) {
      selection['residentKey'] = 'preferred';
    }

    final userVerification = selection['userVerification'];
    if (userVerification is! String || userVerification.isEmpty) {
      selection['userVerification'] = 'required';
    }

    sanitized['authenticatorSelection'] = selection;
  }

  return sanitized;
}

Future<Map<String, String>> _createDeviceBinding({
  required DeviceBindingFlow flow,
  required String? userId,
  required String? sessionId,
  required String? credentialId,
  required String? challenge,
  required int? issuedAtMs,
}) async {
  final keyReady = await SecureStore.ensureKeyExists();
  if (!keyReady) {
    throw Exception('Device key initialization failed');
  }

  final publicKeyBytes = await SecureStore.getPublicKey();
  if (publicKeyBytes == null) {
    throw Exception('Device public key unavailable');
  }

  final payload = DeviceBindingPayload(
    flow: flow,
    userId: userId,
    sessionId: sessionId,
    credentialId: credentialId,
    challenge: challenge,
    issuedAtMs: issuedAtMs,
  );

  final payloadBytes = utf8.encode(payload.toCanonicalJson());
  final signatureBytes = await SecureStore.signPayload(
    Uint8List.fromList(payloadBytes),
  );

  if (signatureBytes == null) {
    throw Exception('Device signature generation failed');
  }

  return {
    'device_public_key': base64Encode(publicKeyBytes),
    'device_signature': base64Encode(signatureBytes),
  };
}

// Registration
Future<Map<String, dynamic>> register(
  Map<String, dynamic> optionsJson,
  String? userId,
  String? registrationToken,
) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = RegisterRequestType.fromJson(
      _sanitizeRegisterOptions(optionsJson),
    );

    final response = await authenticator.register(request);
    final credential = response.toJson();
    final deviceBinding = await _createDeviceBinding(
      flow: DeviceBindingFlow.register,
      userId: userId,
      sessionId: null,
      credentialId: _extractCredentialId(credential),
      challenge: _extractChallenge(optionsJson),
      issuedAtMs: _extractIssuedAtMs(optionsJson),
    );

    return {
      'user_id': userId,
      'registration_token': registrationToken,
      'device_signature': deviceBinding['device_signature'],
      'device_public_key': deviceBinding['device_public_key'],
      'credential': credential,
    };
  } catch (e) {
    throw Exception('Registration error: $e');
  }
}

// Authentication
Future<Map<String, dynamic>> checkIn(
  Map<String, dynamic> optionsJson,
  String? userId,
  String? sessionId,
  List<int> bluetoothRssiReadings, {
  String? bleToken,
  double? gpsLatitude,
  double? gpsLongitude,
  bool? gpsIsMock,
  String? nfcToken,
}) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = AuthenticateRequestType.fromJson(optionsJson);

    final response = await authenticator.authenticate(request);
    final credential = response.toJson();
    final deviceBinding = await _createDeviceBinding(
      flow: DeviceBindingFlow.checkIn,
      userId: userId,
      sessionId: sessionId,
      credentialId: _extractCredentialId(credential),
      challenge: _extractChallenge(optionsJson),
      issuedAtMs: _extractIssuedAtMs(optionsJson),
    );

    return {
      'user_id': userId,
      'session_id': sessionId,
      if (bluetoothRssiReadings.isNotEmpty)
        'bluetooth_rssi_readings': bluetoothRssiReadings,
      ?'ble_token': bleToken,
      ?'gps_latitude': gpsLatitude,
      ?'gps_longitude': gpsLongitude,
      ?'gps_is_mock': gpsIsMock,
      ?'nfc_token': nfcToken,
      'credential': credential,
      'device_signature': deviceBinding['device_signature'],
      'device_public_key': deviceBinding['device_public_key'],
    };
  } catch (e) {
    throw Exception('Authentication error: $e');
  }
}

// Login
Future<Map<String, dynamic>> login(
  Map<String, dynamic> optionsJson,
  String? userId,
) async {
  try {
    final authenticator = PasskeyAuthenticator();
    final request = AuthenticateRequestType.fromJson(optionsJson);

    final response = await authenticator.authenticate(request);
    final credential = response.toJson();
    final deviceBinding = await _createDeviceBinding(
      flow: DeviceBindingFlow.login,
      userId: userId,
      sessionId: null,
      credentialId: _extractCredentialId(credential),
      challenge: _extractChallenge(optionsJson),
      issuedAtMs: _extractIssuedAtMs(optionsJson),
    );

    return {
      'user_id': userId,
      'credential': credential,
      'device_signature': deviceBinding['device_signature'],
      'device_public_key': deviceBinding['device_public_key'],
    };
  } catch (e) {
    throw Exception('Login error: $e');
  }
}
