import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/managed_mobile_scanner.dart';
import 'package:passkey_attendance_system/widgets/scanner_shell.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _qrController = MobileScannerController(
    torchEnabled: false,
  );

  Future<void> _handleDetect(BarcodeCapture result) async {
    final barcodeList = result.barcodes;
    if (barcodeList.isEmpty || !mounted) {
      return;
    }

    try {
      final url = barcodeList.first.rawValue;
      if (url == null) {
        return;
      }

      final uri = Uri.parse(url);
      if (uri.scheme != Config.registrationProtocol || uri.host != 'register') {
        if (!mounted) return;
        GoRouter.of(context).go('/');
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text(QrStrings.errorInvalidQr)));
        return;
      }

      final token = uri.queryParameters['token'];
      final userId = uri.queryParameters['user_id'];
      if (token == null || userId == null) {
        if (!mounted) return;
        GoRouter.of(context).go('/');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(QrStrings.errorMissingData)),
        );
        return;
      }

      await _qrController.stop();
      if (!mounted) return;
      GoRouter.of(context).go(
        '/register?token=${Uri.encodeComponent(token)}&user_id=${Uri.encodeComponent(userId)}',
      );
    } catch (_) {
      if (!mounted) return;
      GoRouter.of(context).go('/');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(QrStrings.errorUnexpectedFailure)),
      );
    }
  }

  @override
  void dispose() {
    _qrController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScannerShell(
      title: QrStrings.registrationTitle,
      subtitle: QrStrings.registrationBody,
      onClose: () => context.go('/'),
      onToggleTorch: () async {
        await _qrController.toggleTorch();
      },
      viewport: SizedBox.square(
        dimension:
            min(
              MediaQuery.of(context).size.width,
              MediaQuery.of(context).size.height,
            ) *
            0.8,
        child: ManagedMobileScanner(
          controller: _qrController,
          fit: BoxFit.cover,
          onDetect: _handleDetect,
        ),
      ),
    );
  }
}
