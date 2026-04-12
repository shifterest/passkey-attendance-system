import 'package:flutter/services.dart';
import 'package:passkey_attendance_system/config/config.dart';

class SecureStore {
  static const kotlinChannel = MethodChannel(Config.secureStoreChannel);

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

  static Future<Uint8List?> signPayloadWithBiometric(Uint8List payload) async {
    try {
      return await kotlinChannel.invokeMethod<Uint8List>(
        'signPayloadWithBiometric',
        payload,
      );
    } on PlatformException {
      return null;
    }
  }

  static Future<bool> deleteKey() async {
    try {
      final result = await kotlinChannel.invokeMethod<bool>('deleteKey');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }
}
