import 'dart:convert';
import 'dart:typed_data';

import 'package:passkey_attendance_system/contracts/device.dart';
import 'package:passkey_attendance_system/services/secure_store.dart';
import 'package:passkey_attendance_system/services/session_store.dart';

class OfflinePayloadService {
  static Future<Map<String, dynamic>> generateOfflinePayload({
    required String userId,
    required String sessionId,
    required String nonce,
    required String credentialId,
    required int issuedAtMs,
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
      flow: DeviceBindingFlow.offlineCheckIn,
      userId: userId,
      sessionId: sessionId,
      credentialId: credentialId,
      challenge: nonce,
      issuedAtMs: issuedAtMs,
    );

    final payloadBytes = utf8.encode(payload.toCanonicalJson());
    final signatureBytes = await SecureStore.signPayloadWithBiometric(
      Uint8List.fromList(payloadBytes),
    );

    if (signatureBytes == null) {
      throw Exception('Device signature generation failed');
    }

    final credentialIdFromStore = await _getCredentialId();

    return {
      'user_id': userId,
      'credential_id': credentialId.isNotEmpty
          ? credentialId
          : credentialIdFromStore,
      'issued_at_ms': issuedAtMs,
      'device_signature': base64Encode(signatureBytes),
      'device_public_key': base64Encode(publicKeyBytes),
      'challenge': nonce,
    };
  }

  static Future<String> _getCredentialId() async {
    final userId = await SessionStore.getUserId();
    return userId ?? '';
  }
}
