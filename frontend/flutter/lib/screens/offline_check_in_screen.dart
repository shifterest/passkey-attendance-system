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
import 'package:passkey_attendance_system/widgets/live_session_surface.dart';
import 'package:qr_flutter/qr_flutter.dart';

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
  static final _teacherServiceGuid = Guid(
    '0000fff0-0000-1000-8000-00805f9b34fb',
  );
  bool _scanning = true;
  String? _sessionId;
  String? _nonce;
  String? _qrData;
  int _countdown = 60;
  Timer? _countdownTimer;
  Timer? _scanTimeout;
  StreamSubscription<List<ScanResult>>? _scanSubscription;

  LiveSessionPhase get _livePhase {
    if (_scanning) {
      return LiveSessionPhase.preparing;
    }
    if (_sessionId == null) {
      return LiveSessionPhase.error;
    }
    if (_qrData != null) {
      return LiveSessionPhase.completed;
    }
    return LiveSessionPhase.active;
  }

  String get _phaseLabel {
    return switch (_livePhase) {
      LiveSessionPhase.idle => 'Idle',
      LiveSessionPhase.preparing => 'Searching',
      LiveSessionPhase.active => 'Session found',
      LiveSessionPhase.reviewing => 'Reviewing',
      LiveSessionPhase.completed => 'QR ready',
      LiveSessionPhase.error => 'Retry',
    };
  }

  String get _heroTitle {
    return switch (_livePhase) {
      LiveSessionPhase.preparing => OfflineStrings.scanningTitle,
      LiveSessionPhase.active => OfflineStrings.sessionFound,
      LiveSessionPhase.completed => OfflineStrings.qrReadyTitle,
      LiveSessionPhase.error => 'No Teacher Signal',
      LiveSessionPhase.idle => OfflineStrings.studentTitle,
      LiveSessionPhase.reviewing => OfflineStrings.studentTitle,
    };
  }

  String get _heroBody {
    return switch (_livePhase) {
      LiveSessionPhase.preparing => OfflineStrings.scanningBody,
      LiveSessionPhase.active => OfflineStrings.sessionFoundBody,
      LiveSessionPhase.completed => OfflineStrings.qrReadyBody,
      LiveSessionPhase.error => OfflineStrings.noTeacherFoundBody,
      LiveSessionPhase.idle => OfflineStrings.tabDescription,
      LiveSessionPhase.reviewing => OfflineStrings.tabDescription,
    };
  }

  String get _sessionMetricValue {
    if (_sessionId == null || _sessionId!.isEmpty) {
      return 'Waiting';
    }
    return '${_sessionId!.substring(0, _sessionId!.length > 8 ? 8 : _sessionId!.length)}...';
  }

  String get _countdownMetricValue {
    if (_qrData == null) {
      return 'Pending';
    }
    return '${_countdown}s';
  }

  Color _statusColor(bool ok) {
    return ok ? const Color(0xFF35C66B) : const Color(0xFFF5A623);
  }

  @override
  void initState() {
    super.initState();
    _startBleScan();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _scanTimeout?.cancel();
    _scanSubscription?.cancel();
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

    _scanSubscription?.cancel();
    _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        final serviceData = r.advertisementData.serviceData;
        List<int>? bytes;
        for (final entry in serviceData.entries) {
          if (entry.key == _teacherServiceGuid) {
            bytes = entry.value;
            break;
          }
        }
        if (bytes == null || bytes.isEmpty) continue;
        final payload = utf8.decode(bytes, allowMalformed: true).trim();
        if (payload.startsWith('pas_offline:')) {
          final parts = payload.split(':');
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
    final body = _buildFlowBody(context);

    if (!widget.showHeader) {
      return ColoredBox(color: Colors.black, child: body);
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
        SliverToBoxAdapter(child: body),
      ],
    );

    return widget.embedded ? content : Scaffold(body: content);
  }

  Widget _buildFlowBody(BuildContext context) {
    final theme = Theme.of(context);
    final immersive = !widget.showHeader;
    final heroBackground = immersive
        ? const Color(0xFF0D0D0D)
        : theme.colorScheme.primaryContainer;
    final heroForeground = immersive
        ? Colors.white
        : theme.colorScheme.onPrimaryContainer;
    final sectionBackground = immersive ? const Color(0xFF0D0D0D) : null;
    final sectionForeground = immersive ? Colors.white : null;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, widget.showHeader ? 32 : 96),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LiveSessionHeroCard(
            phase: _livePhase,
            phaseLabel: _phaseLabel,
            title: _heroTitle,
            body: _heroBody,
            backgroundColor: heroBackground,
            foregroundColor: heroForeground,
            metrics: [
              LiveSessionMetricItem(
                label: OfflineStrings.sessionId,
                value: _sessionMetricValue,
                icon: Icons.bluetooth_searching_rounded,
              ),
              LiveSessionMetricItem(
                label: 'QR',
                value: _qrData == null ? 'Pending' : 'Ready',
                icon: Icons.qr_code_rounded,
              ),
              LiveSessionMetricItem(
                label: OfflineStrings.expiresIn,
                value: _countdownMetricValue,
                icon: Icons.timer_outlined,
              ),
            ],
            visual: _buildHeroVisual(immersive),
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: 'Offline steps',
            subtitle: OfflineStrings.tabDescription,
            backgroundColor: sectionBackground,
            foregroundColor: sectionForeground,
            child: Column(
              children: [
                LiveSessionCapabilityTile(
                  icon: Icons.bluetooth_searching_rounded,
                  title: 'Teacher broadcast',
                  body: _scanning
                      ? OfflineStrings.scanningForTeacher
                      : (_sessionId == null
                            ? OfflineStrings.noTeacherFoundBody
                            : OfflineStrings.sessionFoundBody),
                  statusLabel: _scanning
                      ? 'Searching'
                      : (_sessionId == null ? 'Missing' : 'Locked'),
                  statusColor: _scanning
                      ? const Color(0xFF4E8DFF)
                      : _statusColor(_sessionId != null),
                  foregroundColor: sectionForeground,
                ),
                const SizedBox(height: 14),
                LiveSessionCapabilityTile(
                  icon: Icons.qr_code_rounded,
                  title: 'Student QR payload',
                  body: _qrData == null
                      ? 'Generate a signed QR once the teacher session is detected.'
                      : OfflineStrings.qrReadyBody,
                  statusLabel: _qrData == null ? 'Pending' : 'Ready',
                  statusColor: _qrData == null
                      ? const Color(0xFFF5A623)
                      : const Color(0xFF35C66B),
                  foregroundColor: sectionForeground,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: 'Actions',
            backgroundColor: sectionBackground,
            foregroundColor: sectionForeground,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_scanning)
                  FilledButton.icon(
                    onPressed: null,
                    icon: const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    label: const Text(OfflineStrings.scanningForTeacher),
                  )
                else if (_sessionId == null)
                  FilledButton.icon(
                    onPressed: _startBleScan,
                    icon: const Icon(Icons.refresh),
                    label: const Text(OfflineStrings.retryScan),
                  )
                else if (_qrData == null)
                  FilledButton.icon(
                    onPressed: _generateQr,
                    icon: const Icon(Icons.qr_code),
                    label: const Text(OfflineStrings.generateQr),
                  )
                else ...[
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Column(
                        children: [
                          Text(
                            OfflineStrings.showQrToTeacher,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: Colors.black,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 12),
                          QrImageView(
                            data: _qrData!,
                            version: QrVersions.auto,
                            size: 220,
                            errorCorrectionLevel: QrErrorCorrectLevel.L,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _generateQr,
                    icon: const Icon(Icons.refresh),
                    label: const Text(OfflineStrings.generateQr),
                  ),
                ],
                const SizedBox(height: 12),
                OutlinedButton(
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroVisual(bool immersive) {
    if (_scanning) {
      return const SizedBox(
        height: 120,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final iconColor = _sessionId == null
        ? const Color(0xFFF5A623)
        : const Color(0xFF35C66B);

    return SizedBox(
      height: _qrData == null ? 120 : 140,
      child: Center(
        child: Container(
          width: 92,
          height: 92,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: immersive ? 0.14 : 0.1),
            borderRadius: BorderRadius.circular(28),
          ),
          child: Icon(
            _qrData == null
                ? Icons.bluetooth_searching_rounded
                : Icons.qr_code_2_rounded,
            size: 42,
            color: iconColor,
          ),
        ),
      ),
    );
  }
}
