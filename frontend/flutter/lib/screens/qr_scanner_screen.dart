import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/scanner_shell.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
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
    return ScannerShell(
      title: QrStrings.registrationTitle,
      subtitle: QrStrings.registrationBody,
      onClose: () => context.go('/'),
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
          onDetect: (result) {
            if (_isBusy) return;
            _isBusy = true;

            try {
              final barcodeList = result.barcodes;
              if (barcodeList.isEmpty) {
                return;
              }

              final url = barcodeList.first.rawValue;
              if (url != null && mounted) {
                final uri = Uri.parse(url);

                if (uri.scheme != Config.registrationProtocol ||
                    uri.host != 'register') {
                  GoRouter.of(context).go('/');
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text(QrStrings.errorInvalidQr)),
                  );
                  return;
                }

                final token = uri.queryParameters['token'];
                final userId = uri.queryParameters['user_id'];

                if (token == null || userId == null) {
                  GoRouter.of(context).go('/');
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text(QrStrings.errorMissingData)),
                  );
                  return;
                }

                GoRouter.of(context).go(
                  '/register?token=${Uri.encodeComponent(token)}&user_id=${Uri.encodeComponent(userId)}',
                );
              }
            } catch (e) {
              GoRouter.of(context).go('/');
              ScaffoldMessenger.of(context).showSnackBar(
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
