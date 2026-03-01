import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static late final SharedPreferencesWithCache prefs;

  static Future<void> init() async {
    prefs = await SharedPreferencesWithCache.create(
      cacheOptions: const SharedPreferencesWithCacheOptions(
        allowList: <String>{'userId', 'sessionToken', 'sessionExpiry'},
      ),
    );
  }

  static Future<void> saveSession(
    String userId,
    String sessionToken,
    String expiresIn,
  ) async {
    await prefs.setString('userId', userId);
    await prefs.setString('sessionToken', sessionToken);
    await prefs.setString(
      'sessionExpiry',
      DateTime.now()
          .add(Duration(seconds: int.parse(expiresIn)))
          .toIso8601String(),
    );
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
    return prefs.getString('sessionToken');
  }

  static Future<void> clearSession() async {
    await prefs.clear();
  }
}
