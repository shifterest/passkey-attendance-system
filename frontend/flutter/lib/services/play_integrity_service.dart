import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_play_integrity_wrapper/flutter_play_integrity_wrapper.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/config.dart';
import '../services/api_client.dart';
import '../services/session_store.dart';
import '../strings.dart';

const _vouchDateKey = 'pi_vouch_date';

Future<void> submitPlayIntegrityVouch() async {
  if (kIsWeb || !Platform.isAndroid) return;
  final sessionToken = await SessionStore.getSessionToken();
  if (sessionToken == null || sessionToken.isEmpty) return;

  final prefs = await SharedPreferences.getInstance();
  final today = DateTime.now().toIso8601String().substring(0, 10);
  if (prefs.getString(_vouchDateKey) == today) return;

  try {
    final token = await FlutterPlayIntegrityWrapper().requestIntegrityToken(
      cloudProjectNumber: Config.cloudProjectNumber,
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
