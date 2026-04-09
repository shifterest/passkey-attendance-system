import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/widgets/embedded_web_login_scanner.dart';

class WebLoginScannerScreen extends StatefulWidget {
  const WebLoginScannerScreen({super.key});

  @override
  State<WebLoginScannerScreen> createState() => _WebLoginScannerScreenState();
}

class _WebLoginScannerScreenState extends State<WebLoginScannerScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: EmbeddedWebLoginScanner(
            onClose: () => GoRouter.of(context).go('/'),
          ),
        ),
      ),
    );
  }
}
