import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/session_store.dart';

const _vouchDateKey = 'pi_vouch_date';

Future<void> submitPlayIntegrityVouch() async {
  if (kIsWeb || !Platform.isAndroid) return;
  final sessionToken = await SessionStore.getSessionToken();
  if (sessionToken == null || sessionToken.isEmpty) return;

  final prefs = await SharedPreferences.getInstance();
  final today = DateTime.now().toIso8601String().substring(0, 10);
  if (prefs.getString(_vouchDateKey) == today) return;
}
