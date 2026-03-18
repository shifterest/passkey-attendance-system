import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:play_integrity_flutter/play_integrity_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import '../config/config.dart';
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
    final random = Random.secure();
    final nonce = base64UrlEncode(
      List<int>.generate(32, (_) => random.nextInt(256)),
    );
    final token = await PlayIntegrityFlutter.requestIntegrityToken(nonce);

    final client = ApiClient(Config.apiBaseUrl);
    await client.post(
      ApiPaths.playIntegrityVouch,
      {'integrity_token': token},
      extraHeaders: {'X-Session-Token': sessionToken},
    );

    await prefs.setString(_vouchDateKey, today);
  } catch (_) {}
}
