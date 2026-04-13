import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class ManagedMobileScanner extends StatefulWidget {
  const ManagedMobileScanner({
    super.key,
    required this.onDetect,
    this.controller,
    this.fit = BoxFit.cover,
  });

  final FutureOr<void> Function(BarcodeCapture capture) onDetect;
  final MobileScannerController? controller;
  final BoxFit fit;

  @override
  State<ManagedMobileScanner> createState() => _ManagedMobileScannerState();
}

class _ManagedMobileScannerState extends State<ManagedMobileScanner> {
  MobileScannerController? _ownedController;
  bool _isHandling = false;

  MobileScannerController get _controller {
    return widget.controller ??
        (_ownedController ??= MobileScannerController(torchEnabled: false));
  }

  Future<void> _handleDetect(BarcodeCapture capture) async {
    if (_isHandling) {
      return;
    }

    _isHandling = true;
    try {
      await widget.onDetect(capture);
    } finally {
      _isHandling = false;
    }
  }

  @override
  void dispose() {
    _ownedController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MobileScanner(
      controller: _controller,
      fit: widget.fit,
      onDetect: _handleDetect,
    );
  }
}
