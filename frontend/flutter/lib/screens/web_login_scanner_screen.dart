import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/scanner_shell.dart';

class WebLoginScannerScreen extends StatefulWidget {
  const WebLoginScannerScreen({super.key});

  @override
  State<WebLoginScannerScreen> createState() => _WebLoginScannerScreenState();
}

class _WebLoginScannerScreenState extends State<WebLoginScannerScreen> {
  bool _isBusy = false;
  MobileScannerController qrController = MobileScannerController(
    torchEnabled: false,
  );

  @override
  void dispose() {
    qrController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);

    return ScannerShell(
      title: QrStrings.webLoginTitle,
      subtitle: QrStrings.webLoginBody,
      onClose: () => router.go('/'),
      onToggleTorch: () async {
        await qrController.toggleTorch();
      },
      viewport: SizedBox.square(
        dimension:
            min(
              MediaQuery.of(context).size.width,
              MediaQuery.of(context).size.height,
            ) *
            0.8,
        child: MobileScanner(
          controller: qrController,
          fit: BoxFit.cover,
          onDetect: (result) async {
            if (_isBusy) return;
            _isBusy = true;

            try {
              final barcodeList = result.barcodes;
              if (barcodeList.isEmpty) return;

              final url = barcodeList.first.rawValue;
              if (url == null || !mounted) return;

              final uri = Uri.parse(url);
              if (uri.scheme != Config.registrationProtocol ||
                  uri.host != 'web-login') {
                router.go('/');
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text(QrStrings.errorInvalidWebLoginQr),
                  ),
                );
                return;
              }

              final token = uri.queryParameters['token'];
              if (token == null || token.isEmpty) {
                router.go('/');
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text(QrStrings.errorMissingWebLoginToken),
                  ),
                );
                return;
              }

              final userId = await SessionStore.getUserId();
              if (userId == null || userId.isEmpty) {
                if (!mounted) return;
                router.go('/');
                return;
              }

              if (!mounted) return;
              router.go(
                '/authenticate?user_id=${Uri.encodeComponent(userId)}&web_login_token=${Uri.encodeComponent(token)}',
              );
            } catch (e) {
              if (!mounted) return;
              router.go('/');
              messenger.showSnackBar(
                const SnackBar(content: Text(QrStrings.errorUnexpectedFailure)),
              );
            } finally {
              _isBusy = false;
            }
          },
        ),
      ),
    );
  }
}
