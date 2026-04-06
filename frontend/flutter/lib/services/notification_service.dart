import 'package:flutter/services.dart';

class NotificationService {
  static const _channel = MethodChannel('pas/notifications');

  static Future<bool> requestPermission() async {
    try {
      final result = await _channel.invokeMethod<bool>('requestPermission');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  static Future<void> showPiVouchExpiryNotification(DateTime expiresAt) async {
    try {
      await _channel.invokeMethod<void>('showNotification', {
        'title': 'Play Integrity vouch expiring',
        'body':
            'Your Play Integrity vouch expires soon. Please re-verify your device integrity.',
        'id': 1001,
      });
    } on PlatformException {
      // ignore
    }
  }
}
