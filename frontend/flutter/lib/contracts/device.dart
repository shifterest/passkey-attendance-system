import 'dart:convert';

const devicePayloadVersion = 1;

enum DeviceBindingFlow {
  register('register'),
  checkIn('check_in'),
  login('login'),
  offlineCheckIn('offline_check_in');

  const DeviceBindingFlow(this.wireValue);
  final String wireValue;
}

class DeviceBindingPayload {
  DeviceBindingPayload({
    required this.flow,
    required this.userId,
    required this.sessionId,
    required this.credentialId,
    required this.challenge,
    required this.issuedAtMs,
  });

  final DeviceBindingFlow flow;
  final String? userId;
  final String? sessionId;
  final String? credentialId;
  final String? challenge;
  final int? issuedAtMs;

  Map<String, Object?> toCanonicalMap() {
    return {
      'v': devicePayloadVersion,
      'flow': flow.wireValue,
      'user_id': userId,
      'session_id': sessionId,
      'credential_id': credentialId,
      'challenge': challenge,
      'issued_at_ms': issuedAtMs,
    };
  }

  String toCanonicalJson() {
    return jsonEncode(toCanonicalMap());
  }
}
