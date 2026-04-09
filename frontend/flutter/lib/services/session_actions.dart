import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';

class SessionActions {
  static Future<void> signOutCurrentUser() async {
    final userId = await SessionStore.getUserId();
    final sessionToken = await SessionStore.getSessionToken();

    if (userId != null &&
        userId.isNotEmpty &&
        sessionToken != null &&
        sessionToken.isNotEmpty) {
      try {
        await AuthApi.logout(userId, sessionToken);
      } catch (_) {}
    }

    await SessionStore.clearSession();
  }
}
