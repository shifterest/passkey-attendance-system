import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';

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
    return Scaffold(
      body: Center(
        child: Container(
          color: Colors.black,
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12)),
            child: SizedBox.square(
              dimension:
                  min(
                    MediaQuery.of(context).size.width,
                    MediaQuery.of(context).size.height,
                  ) *
                  0.8,
              child: MobileScanner(
                controller: qrController,
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
                      if (!mounted) return;
                      GoRouter.of(context).go('/');
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(QrStrings.errorInvalidWebLoginQr),
                        ),
                      );
                      return;
                    }

                    final token = uri.queryParameters['token'];
                    if (token == null || token.isEmpty) {
                      if (!mounted) return;
                      GoRouter.of(context).go('/');
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(QrStrings.errorMissingWebLoginToken),
                        ),
                      );
                      return;
                    }

                    final userId = await SessionStore.getUserId();
                    if (userId == null || userId.isEmpty) {
                      if (!mounted) return;
                      GoRouter.of(context).go('/');
                      return;
                    }

                    if (!mounted) return;
                    GoRouter.of(context).go(
                      '/authenticate?user_id=${Uri.encodeComponent(userId)}&web_login_token=${Uri.encodeComponent(token)}',
                    );
                  } catch (e) {
                    if (!mounted) return;
                    GoRouter.of(context).go('/');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(QrStrings.errorUnexpectedFailure),
                      ),
                    );
                  } finally {
                    _isBusy = false;
                  }
                },
              ),
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.flashlight_on),
        onPressed: () async {
          await qrController.toggleTorch();
        },
      ),
    );
  }
}
