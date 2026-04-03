import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

class NfcHceService {
  static const _channel = MethodChannel('pas/nfc_hce');

  static bool get isSupported => !kIsWeb && Platform.isAndroid;

  static Future<void> start(String nfcToken) async {
    if (!isSupported) return;
    await _channel.invokeMethod<void>('start', {'token': nfcToken});
  }

  static Future<void> stop() async {
    if (!isSupported) return;
    await _channel.invokeMethod<void>('stop');
  }
}
