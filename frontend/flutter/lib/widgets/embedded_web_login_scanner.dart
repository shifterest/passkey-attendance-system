import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/managed_mobile_scanner.dart';

class EmbeddedWebLoginScanner extends StatefulWidget {
  const EmbeddedWebLoginScanner({
    super.key,
    this.embedded = false,
    this.onClose,
  });

  final bool embedded;
  final VoidCallback? onClose;

  @override
  State<EmbeddedWebLoginScanner> createState() =>
      _EmbeddedWebLoginScannerState();
}

class _EmbeddedWebLoginScannerState extends State<EmbeddedWebLoginScanner> {
  final MobileScannerController _controller = MobileScannerController(
    torchEnabled: false,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleDetect(BarcodeCapture result) async {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final barcodeList = result.barcodes;
      if (barcodeList.isEmpty) return;

      final url = barcodeList.first.rawValue;
      if (url == null || !mounted) return;

      final uri = Uri.parse(url);
      if (uri.scheme != Config.registrationProtocol ||
          uri.host != 'web-login') {
        messenger.showSnackBar(
          const SnackBar(content: Text(QrStrings.errorInvalidWebLoginQr)),
        );
        return;
      }

      final token = uri.queryParameters['token'];
      if (token == null || token.isEmpty) {
        messenger.showSnackBar(
          const SnackBar(content: Text(QrStrings.errorMissingWebLoginToken)),
        );
        return;
      }

      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) {
        if (!mounted) return;
        router.go('/');
        return;
      }

      await _controller.stop();
      if (!mounted) return;
      router.push(
        '/authenticate?user_id=${Uri.encodeComponent(userId)}&web_login_token=${Uri.encodeComponent(token)}',
      );
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text(QrStrings.errorUnexpectedFailure)),
      );
    }
  }

  Widget _buildViewport(BuildContext context) {
    final dimension =
        min(
          MediaQuery.of(context).size.width,
          MediaQuery.of(context).size.height,
        ) *
        0.8;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: SizedBox.square(
          dimension: dimension,
          child: ManagedMobileScanner(
            controller: _controller,
            fit: BoxFit.cover,
            onDetect: _handleDetect,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final contentPadding = widget.embedded
        ? const EdgeInsets.fromLTRB(20, 16, 20, 24)
        : EdgeInsets.zero;

    return Padding(
      padding: contentPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!widget.embedded)
            Row(
              children: [
                IconButton(
                  onPressed: widget.onClose ?? () => context.pop(),
                  style: IconButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                  ),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ],
            )
          else
            const SizedBox(height: 8),
          const SizedBox(height: 16),
          Text(
            QrStrings.webLoginTitle,
            textAlign: TextAlign.center,
            style: AppTheme.variable(
              theme.textTheme.headlineSmall,
              weight: 700,
              width: 136,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            QrStrings.webLoginBody,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.78),
            ),
          ),
          const Spacer(),
          Center(child: _buildViewport(context)),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 188),
                child: FilledButton.tonalIcon(
                  onPressed: () async {
                    await _controller.toggleTorch();
                  },
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 52),
                    backgroundColor: Colors.white.withValues(alpha: 0.12),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.flashlight_on_rounded),
                  label: const Text(QrStrings.torch),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
