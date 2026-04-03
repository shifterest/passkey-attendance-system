import 'dart:io' show Platform;

import 'package:app_device_integrity/app_device_integrity.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../config/config.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';
import '../strings.dart';

const _vouchDateKey = 'pi_vouch_date';
const _uuid = Uuid();

Future<void> submitPlayIntegrityVouch() async {
  if (kIsWeb || !Platform.isAndroid) return;
  final sessionToken = await SessionStore.getSessionToken();
  if (sessionToken == null || sessionToken.isEmpty) return;

  final prefs = await SharedPreferences.getInstance();
  final today = DateTime.now().toIso8601String().substring(0, 10);
  if (prefs.getString(_vouchDateKey) == today) return;

  try {
    final cloudProjectNumber = int.tryParse(Config.cloudProjectNumber);
    if (cloudProjectNumber == null) return;

    final token = await AppDeviceIntegrity().getAttestationServiceSupport(
      challengeString: _uuid.v4(),
      gcp: cloudProjectNumber,
    );
    if (token == null) return;

    final client = ApiClient(Config.apiBaseUrl);
    await client.post(
      ApiPaths.playIntegrityVouch,
      {'integrity_token': token},
      extraHeaders: {'X-Session-Token': sessionToken},
    );
    await prefs.setString(_vouchDateKey, today);
  } catch (_) {
    return;
  }
}
