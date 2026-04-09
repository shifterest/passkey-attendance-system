import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class SessionStore {
  static late final SharedPreferencesWithCache prefs;
  static final ValueNotifier<int> sessionRevision = ValueNotifier<int>(0);
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
  );

  static void _notifySessionChanged() {
    sessionRevision.value = sessionRevision.value + 1;
  }

  static Future<void> init() async {
    prefs = await SharedPreferencesWithCache.create(
      cacheOptions: const SharedPreferencesWithCacheOptions(
        allowList: <String>{
          'deviceId',
          'userId',
          'sessionExpiry',
          'role',
          'lastCheckIn',
        },
      ),
    );
  }

  static Future<void> saveSession(
    String userId,
    String sessionToken,
    int expiresIn,
  ) async {
    await prefs.setString('userId', userId);
    await _secureStorage.write(key: 'sessionToken', value: sessionToken);
    await prefs.setString(
      'sessionExpiry',
      DateTime.now().add(Duration(seconds: expiresIn)).toIso8601String(),
    );
    _notifySessionChanged();
  }

  static Future<void> saveUserId(String userId) async {
    await prefs.setString('userId', userId);
    _notifySessionChanged();
  }

  static Future<String> getDeviceId() async {
    String? deviceId = prefs.getString('deviceId');
    if (deviceId == null) {
      deviceId = const Uuid().v4();
      await prefs.setString('deviceId', deviceId);
    }
    return deviceId;
  }

  static Future<bool> isSessionValid() async {
    final expiryString = prefs.getString('sessionExpiry');
    if (expiryString == null) return false;
    final expiry = DateTime.parse(expiryString);
    if (DateTime.now().isAfter(expiry)) {
      await clearSession();
      return false;
    }
    return true;
  }

  static Future<String?> getUserId() async {
    return prefs.getString('userId');
  }

  static Future<String?> getSessionToken() async {
    return _secureStorage.read(key: 'sessionToken');
  }

  static Future<void> clearSession() async {
    await _secureStorage.delete(key: 'sessionToken');
    await prefs.remove("sessionExpiry");
    await prefs.remove("role");
    _notifySessionChanged();
  }

  static Future<void> saveRole(String role) async {
    await prefs.setString('role', role);
    _notifySessionChanged();
  }

  static String? getRole() {
    return prefs.getString('role');
  }

  static Future<void> saveLastCheckIn({
    required String status,
    required String band,
    required int score,
  }) async {
    final now = DateTime.now();
    final data = jsonEncode({
      'status': status,
      'band': band,
      'score': score,
      'date': '${now.month}/${now.day}',
      'time': '${now.hour}:${now.minute.toString().padLeft(2, '0')}',
      'saved_at': now.toIso8601String(),
    });
    await prefs.setString('lastCheckIn', data);
    _notifySessionChanged();
  }

  static Future<Map<String, dynamic>?> getLastCheckIn() async {
    final raw = prefs.getString('lastCheckIn');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
