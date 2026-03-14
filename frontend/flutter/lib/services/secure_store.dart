import 'package:flutter/services.dart';

class SecureStore {
  static const kotlinChannel = MethodChannel(
    'top.whatta.attendance/secure_store',
  );

  static Future<bool> ensureKeyExists() async {
    try {
      final result = await kotlinChannel.invokeMethod<bool>('ensureKeyExists');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  static Future<Uint8List?> getPublicKey() async {
    try {
      return await kotlinChannel.invokeMethod<Uint8List>('getPublicKey');
    } on PlatformException {
      return null;
    }
  }

  static Future<Uint8List?> signPayload(Uint8List payload) async {
    try {
      return await kotlinChannel.invokeMethod<Uint8List>(
        'signPayload',
        payload,
      );
    } on PlatformException {
      return null;
    }
  }
}
