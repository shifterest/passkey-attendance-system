import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:nfc_manager/nfc_manager.dart';

class NfcService {
  static bool get isSupported => !kIsWeb && Platform.isAndroid;

  static Future<String?> readToken() async {
    if (!isSupported) return null;

    final bool available = await NfcManager.instance.isAvailable();
    if (!available) return null;

    final completer = Completer<String?>();

    await NfcManager.instance.startSession(
      onDiscovered: (NfcTag tag) async {
        try {
          final ndef = Ndef.from(tag);
          if (ndef != null) {
            final message = await ndef.read();
            for (final record in message.records) {
              if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
                  record.type.length == 1 &&
                  record.type[0] == 0x54) {
                final payload = record.payload;
                final langCodeLength = payload[0] & 0x3F;
                final text = utf8.decode(payload.sublist(1 + langCodeLength));
                if (!completer.isCompleted) completer.complete(text);
                break;
              }
            }
            if (!completer.isCompleted) completer.complete(null);
          } else {
            if (!completer.isCompleted) completer.complete(null);
          }
        } catch (_) {
          if (!completer.isCompleted) completer.complete(null);
        } finally {
          await NfcManager.instance.stopSession();
        }
      },
    );

    try {
      return await completer.future.timeout(const Duration(seconds: 5));
    } catch (_) {
      await NfcManager.instance.stopSession();
      return null;
    }
  }
}
