import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';
import 'package:passkey_attendance_system/widgets/live_session_surface.dart';
import 'package:passkey_attendance_system/widgets/managed_mobile_scanner.dart';

class TeacherOfflineScannerScreen extends StatefulWidget {
  const TeacherOfflineScannerScreen({
    super.key,
    required this.sessionId,
    required this.nonce,
    required this.classId,
  });

  final String sessionId;
  final String nonce;
  final String classId;

  @override
  State<TeacherOfflineScannerScreen> createState() =>
      _TeacherOfflineScannerScreenState();
}

class _TeacherOfflineScannerScreenState
    extends State<TeacherOfflineScannerScreen> {
  final List<Map<String, dynamic>> _scannedRecords = [];
  final Set<String> _seenUsers = {};
  bool _submitting = false;
  bool _scannerActive = true;

  LiveSessionPhase get _livePhase {
    if (_submitting) {
      return LiveSessionPhase.reviewing;
    }
    if (_scannerActive) {
      return LiveSessionPhase.active;
    }
    return LiveSessionPhase.preparing;
  }

  String get _phaseLabel {
    return switch (_livePhase) {
      LiveSessionPhase.idle => 'Idle',
      LiveSessionPhase.preparing => 'Paused',
      LiveSessionPhase.active => 'Scanning',
      LiveSessionPhase.reviewing => 'Syncing',
      LiveSessionPhase.completed => 'Done',
      LiveSessionPhase.error => 'Needs attention',
    };
  }

  String get _heroTitle {
    return _submitting
        ? OfflineStrings.scannerPausedTitle
        : OfflineStrings.scannerReadyTitle;
  }

  String get _heroBody {
    return _submitting
        ? OfflineStrings.scannerPausedBody
        : OfflineStrings.scannerReadyBody;
  }

  String _shortId(String value) {
    if (value.length <= 12) {
      return value;
    }
    return '${value.substring(0, 8)}...';
  }

  void _showRejectSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  void _onDetect(BarcodeCapture capture) {
    if (!_scannerActive) return;

    for (final barcode in capture.barcodes) {
      final rawValue = barcode.rawValue;
      if (rawValue == null) continue;

      try {
        final data = jsonDecode(rawValue) as Map<String, dynamic>;

        final userId = data['user_id'] as String?;
        final challenge = data['challenge'] as String?;
        final issuedAtMs = data['issued_at_ms'] as int?;

        if (userId == null || challenge == null || issuedAtMs == null) {
          _showRejectSnack(OfflineStrings.rejectInvalid);
          continue;
        }

        if (challenge != widget.nonce) {
          _showRejectSnack(OfflineStrings.rejectNonce);
          continue;
        }

        final issuedAt = DateTime.fromMillisecondsSinceEpoch(issuedAtMs);
        final age = DateTime.now().difference(issuedAt).inSeconds;
        if (age > 60 || age < -5) {
          _showRejectSnack(OfflineStrings.rejectExpired);
          continue;
        }

        if (_seenUsers.contains(userId)) {
          _showRejectSnack(OfflineStrings.rejectDuplicate);
          continue;
        }

        _seenUsers.add(userId);
        setState(() => _scannedRecords.add(data));

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${OfflineStrings.scanned}: $userId'),
            duration: const Duration(seconds: 1),
          ),
        );
      } catch (_) {
        _showRejectSnack(OfflineStrings.rejectInvalid);
      }
    }
  }

  Future<void> _submit() async {
    if (_scannedRecords.isEmpty || _submitting) return;

    setState(() {
      _submitting = true;
      _scannerActive = false;
    });

    try {
      await SessionApi.offlineSync(
        classId: widget.classId,
        sessionId: widget.sessionId,
        nonceSet: [widget.nonce],
        records: _scannedRecords,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${OfflineStrings.syncSuccess} (${_scannedRecords.length})',
          ),
        ),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _scannerActive = true);
      await showErrorDialog(
        context,
        e.toString(),
        body: OfflineStrings.errorSyncing,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text(OfflineStrings.scannerTitle),
        actions: const [],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          LiveSessionHeroCard(
            phase: _livePhase,
            phaseLabel: _phaseLabel,
            title: _heroTitle,
            body:
                '$_heroBody ${OfflineStrings.scannerSessionLabel}: ${_shortId(widget.sessionId)}',
            backgroundColor: colorScheme.primaryContainer,
            foregroundColor: colorScheme.onPrimaryContainer,
            metrics: [
              LiveSessionMetricItem(
                label: OfflineStrings.scannedStudents,
                value: '${_scannedRecords.length}',
                icon: Icons.groups_rounded,
              ),
              LiveSessionMetricItem(
                label: 'Scanner',
                value: _scannerActive ? 'Live' : 'Paused',
                icon: Icons.qr_code_scanner_rounded,
              ),
              LiveSessionMetricItem(
                label: 'Sync',
                value: _submitting ? 'Running' : 'Waiting',
                icon: Icons.cloud_upload_rounded,
              ),
            ],
            visual: SizedBox(
              height: 240,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: ColoredBox(
                  color: Colors.black,
                  child: _scannerActive
                      ? ManagedMobileScanner(onDetect: _onDetect)
                      : const Center(
                          child: Icon(
                            Icons.pause_circle,
                            size: 52,
                            color: Colors.white54,
                          ),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: OfflineStrings.reviewQueueTitle,
            subtitle: OfflineStrings.reviewQueueBody,
            child: Column(
              children: [
                LiveSessionCapabilityTile(
                  icon: Icons.verified_outlined,
                  title: 'Validation gate',
                  body:
                      'The scanner only accepts fresh payloads tied to this nonce and rejects duplicate student IDs.',
                  statusLabel: 'Locked',
                  statusColor: colorScheme.primary,
                ),
                const SizedBox(height: 14),
                LiveSessionCapabilityTile(
                  icon: Icons.playlist_add_check_circle_outlined,
                  title: 'Queued students',
                  body: _scannedRecords.isEmpty
                      ? OfflineStrings.scannerQueueEmpty
                      : 'Review the queued list below before pushing the batch to the server.',
                  statusLabel: '${_scannedRecords.length}',
                  statusColor: _scannedRecords.isEmpty
                      ? const Color(0xFFF5A623)
                      : const Color(0xFF35C66B),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(
                    minHeight: 96,
                    maxHeight: 240,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: _scannedRecords.isEmpty
                      ? Center(
                          child: Text(
                            OfflineStrings.scannerQueueEmpty,
                            style: theme.textTheme.bodyMedium,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _scannedRecords.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, index) {
                            final record = _scannedRecords[index];
                            final userId =
                                record['user_id'] as String? ?? 'Unknown';
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surface,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.person, size: 18),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      userId,
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                  Text(
                                    '#${index + 1}',
                                    style: theme.textTheme.labelMedium,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: 'Scanner actions',
            subtitle: OfflineStrings.scannerBody,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton.icon(
                  onPressed: _scannedRecords.isEmpty || _submitting
                      ? null
                      : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.cloud_upload),
                  label: Text(
                    _submitting
                        ? OfflineStrings.syncing
                        : OfflineStrings.submitSync,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/teacher/offline');
                    }
                  },
                  child: const Text(OfflineStrings.back),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
