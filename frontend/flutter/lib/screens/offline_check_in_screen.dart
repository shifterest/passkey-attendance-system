import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/offline_payload_service.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/collapsing_sliver_title.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

class OfflineCheckInScreen extends StatefulWidget {
  const OfflineCheckInScreen({
    super.key,
    this.embedded = false,
    this.onReturnToDashboard,
    this.showHeader = true,
  });

  final bool embedded;
  final VoidCallback? onReturnToDashboard;
  final bool showHeader;

  @override
  State<OfflineCheckInScreen> createState() => _OfflineCheckInScreenState();
}

class _OfflineCheckInScreenState extends State<OfflineCheckInScreen> {
  bool _scanning = true;
  String? _sessionId;
  String? _nonce;
  String? _qrData;
  int _countdown = 60;
  Timer? _countdownTimer;
  Timer? _scanTimeout;

  @override
  void initState() {
    super.initState();
    _startBleScan();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _scanTimeout?.cancel();
    FlutterBluePlus.stopScan();
    super.dispose();
  }

  Future<void> _startBleScan() async {
    setState(() {
      _scanning = true;
      _sessionId = null;
      _nonce = null;
      _qrData = null;
    });
    _countdownTimer?.cancel();

    _scanTimeout = Timer(const Duration(seconds: 30), () {
      if (_sessionId == null && mounted) {
        FlutterBluePlus.stopScan();
        setState(() => _scanning = false);
      }
    });

    try {
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 30));
    } catch (_) {}

    FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        final localName = r.advertisementData.advName;
        if (localName.startsWith('pas_offline:')) {
          final parts = localName.split(':');
          if (parts.length == 3) {
            FlutterBluePlus.stopScan();
            _scanTimeout?.cancel();
            if (mounted) {
              setState(() {
                _scanning = false;
                _sessionId = parts[1];
                _nonce = parts[2];
              });
            }
            return;
          }
        }
      }
    });
  }

  Future<void> _generateQr() async {
    if (_sessionId == null || _nonce == null) return;

    try {
      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) {
        throw Exception(OfflineStrings.errorMissingUserId);
      }

      final credentialId = '';
      final issuedAtMs = DateTime.now().millisecondsSinceEpoch;

      final payload = await OfflinePayloadService.generateOfflinePayload(
        userId: userId,
        sessionId: _sessionId!,
        nonce: _nonce!,
        credentialId: credentialId,
        issuedAtMs: issuedAtMs,
      );

      final qrJson = jsonEncode(payload);

      if (!mounted) return;
      setState(() {
        _qrData = qrJson;
        _countdown = 60;
      });

      _countdownTimer?.cancel();
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        setState(() => _countdown--);
        if (_countdown <= 0) {
          timer.cancel();
          _generateQr();
        }
      });
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: OfflineStrings.errorGeneratingPayload,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = Padding(
      padding: const EdgeInsets.all(24),
      child: _scanning
          ? _buildScanning()
          : _sessionId != null
          ? _buildSessionFound()
          : _buildScanFailed(),
    );

    if (!widget.showHeader) {
      final textStyle =
          Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: Colors.white) ??
          const TextStyle(color: Colors.white);
      return ColoredBox(
        color: Colors.black,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          child: IconTheme(
            data: const IconThemeData(color: Colors.white),
            child: DefaultTextStyle(style: textStyle, child: body),
          ),
        ),
      );
    }

    final content = CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 112,
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsetsDirectional.only(
              start: 20,
              bottom: 14,
            ),
            title: const CollapsingSliverTitle(
              text: OfflineStrings.studentTitle,
            ),
          ),
        ),
        SliverFillRemaining(hasScrollBody: false, child: body),
      ],
    );

    return widget.embedded ? content : Scaffold(body: content);
  }

  Widget _buildScanning() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text(OfflineStrings.scanningForTeacher),
        ],
      ),
    );
  }

  Widget _buildScanFailed() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.bluetooth_disabled, size: 48, color: Colors.grey),
          const SizedBox(height: 16),
          const Text(OfflineStrings.noTeacherFound),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _startBleScan,
            icon: const Icon(Icons.refresh),
            label: const Text(OfflineStrings.retryScan),
          ),
        ],
      ),
    );
  }

  Widget _buildSessionFound() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 20),
            const SizedBox(width: 8),
            Text(
              OfflineStrings.sessionFound,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          '${OfflineStrings.sessionId}: ${_sessionId!.substring(0, 8)}...',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 24),
        if (_qrData == null) ...[
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _generateQr,
              icon: const Icon(Icons.qr_code),
              label: const Text(OfflineStrings.generateQr),
            ),
          ),
        ] else ...[
          Center(
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Column(
                    children: [
                      // QR rendered via mobile_scanner's Barcode or a QR image widget.
                      // For now, show the data as text for teacher to scan.
                      Text(
                        OfflineStrings.showQrToTeacher,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      SelectableText(
                        _qrData!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          fontSize: 10,
                        ),
                        maxLines: 6,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '${OfflineStrings.expiresIn}: ${_countdown}s',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _countdown <= 10 ? Colors.red : null,
                  ),
                ),
              ],
            ),
          ),
        ],
        const Spacer(),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () {
              if (widget.onReturnToDashboard != null) {
                widget.onReturnToDashboard!();
                return;
              }
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
            child: const Text(OfflineStrings.cancel),
          ),
        ),
      ],
    );
  }
}
