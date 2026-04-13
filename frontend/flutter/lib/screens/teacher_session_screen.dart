import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/ble_advertiser_service.dart';
import 'package:passkey_attendance_system/services/nfc_hce_service.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';
import 'package:passkey_attendance_system/widgets/live_session_surface.dart';

class TeacherSessionScreen extends StatefulWidget {
  const TeacherSessionScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<TeacherSessionScreen> createState() => _TeacherSessionScreenState();
}

class _TeacherSessionScreenState extends State<TeacherSessionScreen> {
  String? _bleToken;
  String? _nfcToken;
  bool _nfcEnabled = false;
  int _checkInCount = 0;
  bool _isClosed = false;
  bool _isClosing = false;
  bool _isRefreshing = false;
  Timer? _bleRefreshTimer;
  Timer? _recordRefreshTimer;
  DateTime? _lastUpdatedAt;

  @override
  void initState() {
    super.initState();
    _refreshAll();
    _bleRefreshTimer = Timer.periodic(
      const Duration(seconds: 25),
      (_) => _refreshAll(silent: true, includeNfc: _nfcEnabled),
    );
    _recordRefreshTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _refreshAll(silent: true, includeNfc: _nfcEnabled),
    );
  }

  @override
  void dispose() {
    _bleRefreshTimer?.cancel();
    _recordRefreshTimer?.cancel();
    NfcHceService.stop();
    BleAdvertiserService.stop();
    super.dispose();
  }

  Future<void> _fetchBleToken() async {
    try {
      final data = await SessionApi.getBleToken(widget.sessionId);
      final token = data['ble_token'];
      if (token is String && mounted) {
        if (_bleToken != null) {
          await BleAdvertiserService.stop();
        }
        await BleAdvertiserService.startToken(token);
        setState(() => _bleToken = token);
      }
    } catch (_) {}
  }

  Future<void> _refreshAll({
    bool silent = false,
    bool includeNfc = false,
  }) async {
    if (_isRefreshing && !silent) {
      return;
    }
    if (!silent && mounted) {
      setState(() => _isRefreshing = true);
    }
    try {
      await _fetchBleToken();
      await _fetchRecords();
      if (includeNfc || _nfcEnabled) {
        await _fetchNfcToken();
      }
      if (mounted) {
        setState(() => _lastUpdatedAt = DateTime.now());
      }
    } finally {
      if (!silent && mounted) {
        setState(() => _isRefreshing = false);
      }
    }
  }

  Future<void> _fetchRecords() async {
    try {
      final records = await SessionApi.getSessionRecords(widget.sessionId);
      if (mounted) {
        setState(() => _checkInCount = records.length);
      }
    } catch (_) {}
  }

  Future<void> _fetchNfcToken() async {
    try {
      final data = await SessionApi.getNfcToken(widget.sessionId);
      final token = data['nfc_token'];
      if (token is String && mounted) {
        setState(() => _nfcToken = token);
        if (_nfcEnabled) {
          await NfcHceService.start(token);
        }
      }
    } catch (_) {}
  }

  Future<void> _toggleNfc(bool enabled) async {
    if (!NfcHceService.isSupported) return;
    setState(() => _nfcEnabled = enabled);
    if (enabled) {
      if (_nfcToken == null) {
        await _fetchNfcToken();
      } else {
        await NfcHceService.start(_nfcToken!);
      }
    } else {
      await NfcHceService.stop();
    }
  }

  void _copyToken(String token) {
    Clipboard.setData(ClipboardData(text: token));
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text(TeacherStrings.tokenCopied)));
  }

  String _shortId(String value) {
    if (value.length <= 16) {
      return value;
    }
    return '${value.substring(0, 8)}...${value.substring(value.length - 4)}';
  }

  String _formatTimestamp(DateTime? value) {
    if (value == null) {
      return TeacherStrings.loadingToken;
    }
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }

  LiveSessionPhase get _livePhase {
    if (_isClosed) {
      return LiveSessionPhase.completed;
    }
    if (_bleToken == null) {
      return LiveSessionPhase.preparing;
    }
    return LiveSessionPhase.active;
  }

  String get _phaseLabel {
    return switch (_livePhase) {
      LiveSessionPhase.idle => 'Idle',
      LiveSessionPhase.preparing => 'Preparing',
      LiveSessionPhase.active => 'Broadcasting',
      LiveSessionPhase.reviewing => 'Reviewing',
      LiveSessionPhase.completed => 'Closed',
      LiveSessionPhase.error => 'Needs attention',
    };
  }

  String get _nfcMetricLabel {
    if (!NfcHceService.isSupported) {
      return 'Unavailable';
    }
    return _nfcEnabled ? 'On' : 'Off';
  }

  String get _bleCapabilityBody {
    if (_bleToken == null) {
      return TeacherStrings.tokenUnavailableHint;
    }
    return TeacherStrings.sessionSummaryBody;
  }

  String get _nfcCapabilityBody {
    if (!NfcHceService.isSupported) {
      return TeacherStrings.nfcNotSupported;
    }
    if (_nfcEnabled) {
      return TeacherStrings.nfcBroadcasting;
    }
    return TeacherStrings.nfcOff;
  }

  Future<void> _closeSession() async {
    if (_isClosing) return;
    setState(() => _isClosing = true);
    try {
      await BleAdvertiserService.stop();
      await SessionApi.closeSession(widget.sessionId);
      if (!mounted) return;
      setState(() => _isClosed = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(TeacherStrings.sessionClosed)),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: TeacherStrings.errorClosingSession,
      );
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final sessionStatusColor = _isClosed
        ? colorScheme.outline
        : colorScheme.primary;
    final bleStatus = _bleToken == null
        ? TeacherStrings.tokenWaiting
        : TeacherStrings.tokenReady;
    final nfcStatus = !NfcHceService.isSupported
        ? TeacherStrings.nfcNotSupported
        : (_nfcEnabled
              ? TeacherStrings.nfcBroadcasting
              : TeacherStrings.nfcOff);

    return PopScope(
      canPop: _isClosed,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text(TeacherStrings.sessionActive),
            content: const Text(TeacherStrings.leaveSessionHint),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text(TeacherStrings.stay),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text(TeacherStrings.leave),
              ),
            ],
          ),
        );
        if ((confirmed ?? false) && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text(TeacherStrings.sessionScreen),
          actions: [
            IconButton(
              tooltip: TeacherStrings.refresh,
              onPressed: _isRefreshing
                  ? null
                  : () => _refreshAll(includeNfc: _nfcEnabled),
              icon: _isRefreshing
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () => _refreshAll(includeNfc: _nfcEnabled),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              LiveSessionHeroCard(
                phase: _livePhase,
                phaseLabel: _phaseLabel,
                title: TeacherStrings.sessionSummaryTitle,
                body:
                    '${TeacherStrings.sessionSummaryBody} ${TeacherStrings.sessionId}: ${_shortId(widget.sessionId)}',
                backgroundColor: colorScheme.primaryContainer,
                foregroundColor: colorScheme.onPrimaryContainer,
                metrics: [
                  LiveSessionMetricItem(
                    label: TeacherStrings.checkedIn,
                    value: '$_checkInCount',
                    icon: Icons.people_alt_rounded,
                  ),
                  LiveSessionMetricItem(
                    label: TeacherStrings.lastUpdated,
                    value: _formatTimestamp(_lastUpdatedAt),
                    icon: Icons.schedule_rounded,
                  ),
                  LiveSessionMetricItem(
                    label: 'BLE',
                    value: bleStatus,
                    icon: Icons.bluetooth_searching_rounded,
                  ),
                  LiveSessionMetricItem(
                    label: 'NFC',
                    value: _nfcMetricLabel,
                    icon: Icons.nfc_rounded,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              LiveSessionSectionCard(
                title: 'Broadcast readiness',
                subtitle:
                    'Students depend on the same session signals you host here. Keep BLE live, enable NFC when available, and move to roster review when submissions arrive.',
                child: Column(
                  children: [
                    LiveSessionCapabilityTile(
                      icon: Icons.bluetooth_searching_rounded,
                      title: 'Bluetooth broadcast',
                      body: _bleCapabilityBody,
                      statusLabel: bleStatus,
                      statusColor: _bleToken == null
                          ? colorScheme.outline
                          : colorScheme.primary,
                    ),
                    const SizedBox(height: 14),
                    LiveSessionCapabilityTile(
                      icon: Icons.nfc_rounded,
                      title: 'NFC proximity',
                      body: _nfcCapabilityBody,
                      statusLabel: _nfcMetricLabel,
                      statusColor: !NfcHceService.isSupported
                          ? colorScheme.outline
                          : (_nfcEnabled
                                ? colorScheme.primary
                                : const Color(0xFFCB6A00)),
                    ),
                    const SizedBox(height: 14),
                    LiveSessionCapabilityTile(
                      icon: Icons.fact_check_outlined,
                      title: 'Live roster',
                      body: TeacherStrings.viewRosterHint,
                      statusLabel: '$_checkInCount',
                      statusColor: sessionStatusColor,
                      trailing: Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () {
                            context.push(
                              '/teacher/session/${widget.sessionId}/roster',
                            );
                          },
                          icon: const Icon(Icons.list_alt_rounded),
                          label: const Text(TeacherStrings.openRoster),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _TokenPanel(
                title: TeacherStrings.bleToken,
                subtitle: TeacherStrings.bleBroadcasting,
                statusLabel: bleStatus,
                token: _bleToken,
                fallbackLabel: TeacherStrings.tokenUnavailableHint,
                onCopy: _bleToken == null ? null : () => _copyToken(_bleToken!),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  TeacherStrings.nfcEnabled,
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  nfcStatus,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Switch(
                            value: _nfcEnabled,
                            onChanged: !NfcHceService.isSupported || _isClosed
                                ? null
                                : _toggleNfc,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _StatusPill(
                        label: NfcHceService.isSupported
                            ? nfcStatus
                            : TeacherStrings.nfcNotSupported,
                        color: NfcHceService.isSupported && _nfcEnabled
                            ? theme.colorScheme.primary
                            : theme.colorScheme.outline,
                      ),
                      if (_nfcEnabled) ...[
                        const SizedBox(height: 12),
                        _TokenPanel(
                          title: TeacherStrings.nfcToken,
                          subtitle: TeacherStrings.nfcBroadcasting,
                          statusLabel: _nfcToken == null
                              ? TeacherStrings.tokenWaiting
                              : TeacherStrings.tokenReady,
                          token: _nfcToken,
                          fallbackLabel: TeacherStrings.tokenUnavailableHint,
                          compact: true,
                          onCopy: _nfcToken == null
                              ? null
                              : () => _copyToken(_nfcToken!),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        TeacherStrings.openRoster,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        TeacherStrings.viewRosterHint,
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                context.push(
                                  '/teacher/session/${widget.sessionId}/roster',
                                );
                              },
                              icon: const Icon(Icons.list_alt_rounded),
                              label: const Text(TeacherStrings.openRoster),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _isRefreshing
                                  ? null
                                  : () => _refreshAll(includeNfc: _nfcEnabled),
                              icon: const Icon(Icons.refresh_rounded),
                              label: const Text(TeacherStrings.refresh),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        TeacherStrings.closeSession,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        TeacherStrings.closeSessionBody,
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _isClosed || _isClosing
                              ? null
                              : _closeSession,
                          style: FilledButton.styleFrom(
                            backgroundColor: colorScheme.error,
                            foregroundColor: colorScheme.onError,
                          ),
                          icon: _isClosing
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.stop_circle_rounded),
                          label: const Text(TeacherStrings.closeSession),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _TokenPanel extends StatelessWidget {
  const _TokenPanel({
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.token,
    required this.fallbackLabel,
    this.onCopy,
    this.compact = false,
  });

  final String title;
  final String subtitle;
  final String statusLabel;
  final String? token;
  final String fallbackLabel;
  final VoidCallback? onCopy;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusColor = token == null
        ? theme.colorScheme.outline
        : theme.colorScheme.primary;

    return Card(
      margin: compact ? EdgeInsets.zero : null,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(subtitle, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
                _StatusPill(label: statusLabel, color: statusColor),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                token ?? fallbackLabel,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontFamily: 'monospace',
                  color: token == null
                      ? theme.colorScheme.onSurfaceVariant
                      : theme.colorScheme.onSurface,
                ),
              ),
            ),
            if (onCopy != null) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onCopy,
                  icon: const Icon(Icons.copy_rounded),
                  label: const Text('Copy token'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
