import 'package:flutter/services.dart';

class BleAdvertiserService {
  static const _channel = MethodChannel('pas/ble_advertise');

  static Future<bool> start(String sessionId, String nonce) async {
    try {
      final result = await _channel.invokeMethod<bool>('start', {
        'payload': 'pas_offline:$sessionId:$nonce',
      });
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  static Future<void> stop() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } on PlatformException {
      // ignore
    }
  }
}
