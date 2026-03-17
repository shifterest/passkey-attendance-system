import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:play_integrity_flutter/play_integrity_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import '../config/config.dart';
import '../strings.dart';

const _vouchDateKey = 'pi_vouch_date';

Future<void> submitPlayIntegrityVouch() async {
  if (kIsWeb || !Platform.isAndroid) return;

  final prefs = await SharedPreferences.getInstance();
  final today = DateTime.now().toIso8601String().substring(0, 10);
  if (prefs.getString(_vouchDateKey) == today) return;

  try {
    final nonce = DateTime.now().millisecondsSinceEpoch.toString();
    final token = await PlayIntegrityFlutter.requestIntegrityToken(nonce);

    final client = ApiClient(Config.apiBaseUrl);
    await client.post(ApiPaths.playIntegrityVouch, {'integrity_token': token});

    await prefs.setString(_vouchDateKey, today);
  } catch (_) {}
}
