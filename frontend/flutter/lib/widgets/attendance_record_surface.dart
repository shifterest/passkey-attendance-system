import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/strings.dart';

enum AttendanceRecordSurfaceMode { student, teacher }

class AttendanceRecordActionDecision {
  const AttendanceRecordActionDecision({
    required this.approve,
    required this.reason,
  });

  final bool approve;
  final String reason;
}

class AttendanceRecordCard extends StatelessWidget {
  const AttendanceRecordCard({
    super.key,
    required this.record,
    required this.title,
    required this.subtitle,
    required this.mode,
    this.onTap,
  });

  final Map<String, dynamic> record;
  final String title;
  final String subtitle;
  final AttendanceRecordSurfaceMode mode;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final status = record['status'] as String?;
    final band = record['assurance_band_recorded'] as String?;
    final score = record['assurance_score'] as int? ?? 0;
    final signals = recordSignalLabels(record['verification_methods']);
    final anomalies = recordAnomalyLabels(record);
    final needsReview = recordNeedsReview(record);
    final statusNote = record['manually_approved'] == true
        ? DashboardStrings.manuallyApproved
        : (needsReview ? DashboardStrings.queuedForReview : null);
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      color: needsReview
          ? const Color(0xFFFFF4E7)
          : colorScheme.surfaceContainerLow,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _RecordBadge(
                        label: recordStatusLabel(status),
                        color: recordStatusColor(status),
                      ),
                      const SizedBox(height: 6),
                      _RecordBadge(
                        label: '$score · ${recordBandLabel(band)}',
                        color: recordBandColor(band),
                      ),
                    ],
                  ),
                ],
              ),
              if (signals.isNotEmpty) ...[
                const SizedBox(height: 14),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: signals
                      .map((signal) => _SignalChip(label: signal))
                      .toList(growable: false),
                ),
              ],
              if (anomalies.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: anomalies
                      .map((label) => _AnomalyChip(label: label))
                      .toList(growable: false),
                ),
              ],
              if (statusNote != null) ...[
                const SizedBox(height: 12),
                Text(
                  statusNote,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: needsReview
                        ? recordBandColor('low')
                        : recordStatusColor('present'),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

Future<AttendanceRecordActionDecision?> showAttendanceRecordDetailsSheet(
  BuildContext context, {
  required Map<String, dynamic> record,
  required AttendanceRecordSurfaceMode mode,
}) async {
  final reasonController = TextEditingController();
  final decision = await showModalBottomSheet<AttendanceRecordActionDecision>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      final theme = Theme.of(ctx);
      final userId = record['user_id'] as String? ?? '';
      final timestamp = recordFormattedTimestamp(
        record['timestamp'] as String?,
      );
      final canReview =
          mode == AttendanceRecordSurfaceMode.teacher &&
          recordNeedsReview(record);
      final signals = _recordSignalStates(
        record['verification_methods'],
        showMissing: mode == AttendanceRecordSurfaceMode.teacher,
      );
      final anomalies = recordAnomalyLabels(record);

      return Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                canReview
                    ? DashboardStrings.reviewRecord
                    : HistoryStrings.detailsTitle,
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                canReview
                    ? DashboardStrings.reviewRecordBody
                    : HistoryStrings.detailsBody,
                style: theme.textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              AttendanceRecordCard(
                record: record,
                title: mode == AttendanceRecordSurfaceMode.teacher
                    ? userId
                    : recordStatusLabel(record['status'] as String?),
                subtitle: timestamp,
                mode: mode,
              ),
              const SizedBox(height: 12),
              _DetailCard(
                title: DashboardStrings.status,
                child: _DetailRowGroup(
                  rows: [
                    _DetailRowData(
                      label: DashboardStrings.status,
                      value: recordStatusLabel(record['status'] as String?),
                    ),
                    _DetailRowData(
                      label: DashboardStrings.score,
                      value: '${record['assurance_score'] as int? ?? 0}',
                    ),
                    _DetailRowData(
                      label: DashboardStrings.band,
                      value: recordBandLabel(
                        record['assurance_band_recorded'] as String?,
                      ),
                    ),
                    if (userId.isNotEmpty)
                      _DetailRowData(
                        label: DashboardStrings.student,
                        value: userId,
                      ),
                    _DetailRowData(
                      label: TeacherStrings.lastUpdated,
                      value: timestamp,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _DetailCard(
                title: DashboardStrings.signals,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: signals
                      .map(
                        (signal) => _SignalStateChip(
                          label: signal.label,
                          present: signal.present,
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
              const SizedBox(height: 12),
              _DetailCard(
                title: DashboardStrings.anomalies,
                child: anomalies.isEmpty
                    ? Text(
                        DashboardStrings.noAnomalies,
                        style: theme.textTheme.bodySmall,
                      )
                    : Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: anomalies
                            .map((label) => _AnomalyChip(label: label))
                            .toList(growable: false),
                      ),
              ),
              if (canReview) ...[
                const SizedBox(height: 16),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    labelText: DashboardStrings.reasonOptional,
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Navigator.pop(
                            ctx,
                            AttendanceRecordActionDecision(
                              approve: false,
                              reason: reasonController.text,
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                        ),
                        child: const Text(DashboardStrings.reject),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.pop(
                            ctx,
                            AttendanceRecordActionDecision(
                              approve: true,
                              reason: reasonController.text,
                            ),
                          );
                        },
                        child: const Text(DashboardStrings.approve),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text(CheckInResultStrings.done),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    },
  );
  reasonController.dispose();
  return decision;
}

String recordStatusLabel(String? status) {
  return switch (status) {
    'present' => CheckInResultStrings.present.toUpperCase(),
    'late' => CheckInResultStrings.late.toUpperCase(),
    'absent' => CheckInResultStrings.absent.toUpperCase(),
    _ => (status ?? CheckInResultStrings.unknownStatus).toUpperCase(),
  };
}

String recordBandLabel(String? band) {
  return switch (band) {
    'high' => HistoryStrings.bandHigh,
    'standard' => HistoryStrings.bandStandard,
    'low' => HistoryStrings.bandLow,
    _ => DashboardStrings.band,
  };
}

Color recordStatusColor(String? status) {
  return switch (status) {
    'present' => const Color(0xFF1F9D57),
    'late' => const Color(0xFFCB6A00),
    'absent' => const Color(0xFFC53B3B),
    _ => Colors.grey,
  };
}

Color recordBandColor(String? band) {
  return switch (band) {
    'high' => const Color(0xFF1F9D57),
    'standard' => const Color(0xFF3768D7),
    'low' => const Color(0xFFCB6A00),
    _ => Colors.grey,
  };
}

bool recordNeedsReview(Map<String, dynamic> record) {
  return record['assurance_band_recorded'] == 'low' &&
      record['manually_approved'] != true;
}

String recordFormattedTimestamp(String? timestamp) {
  if (timestamp == null || timestamp.isEmpty) {
    return 'Unknown time';
  }
  try {
    final dt = DateTime.parse(timestamp).toLocal();
    return '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return timestamp;
  }
}

List<String> recordSignalLabels(dynamic methods) {
  return _recordSignalStates(methods, showMissing: false)
      .where((signal) => signal.present)
      .map((signal) => signal.label)
      .toList(growable: false);
}

List<String> recordAnomalyLabels(Map<String, dynamic> record) {
  final labels = <String>[];
  final methods = record['verification_methods'];

  if (methods is Map<String, dynamic>) {
    final gps = methods['gps'] as Map<String, dynamic>?;
    if (gps != null && gps['mock'] == true) {
      labels.add(DashboardStrings.mockGps);
    }
  }

  if (record['sign_count_anomaly'] == true) {
    labels.add(DashboardStrings.signCountAnomaly);
  }
  if (record['sync_pending'] == true) {
    labels.add(DashboardStrings.syncPending);
  }

  return labels;
}

List<_RecordSignalState> _recordSignalStates(
  dynamic methods, {
  required bool showMissing,
}) {
  const knownSignals = ['bluetooth', 'gps', 'nfc', 'network', 'qr_proximity'];

  if (methods is Map<String, dynamic>) {
    return knownSignals
        .where((signal) => showMissing || methods.containsKey(signal))
        .map(
          (signal) => _RecordSignalState(
            label: _signalLabel(signal),
            present: methods.containsKey(signal),
          ),
        )
        .toList(growable: false);
  }

  if (methods is List) {
    final labels = methods
        .map((method) => _signalLabel(_normalizeSignalKey(method.toString())))
        .toSet()
        .toList(growable: false);
    return labels
        .map((label) => _RecordSignalState(label: label, present: true))
        .toList(growable: false);
  }

  return const [];
}

String _normalizeSignalKey(String raw) {
  final base = raw.split(':').first.trim();
  if (base.startsWith('qr')) {
    return 'qr_proximity';
  }
  return base;
}

String _signalLabel(String signal) {
  return switch (signal) {
    'bluetooth' => 'BLE',
    'gps' => 'GPS',
    'nfc' => 'NFC',
    'network' => 'Network',
    'qr_proximity' => 'QR',
    _ => signal,
  };
}

class _RecordSignalState {
  const _RecordSignalState({required this.label, required this.present});

  final String label;
  final bool present;
}

class _RecordBadge extends StatelessWidget {
  const _RecordBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
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

class _SignalChip extends StatelessWidget {
  const _SignalChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: EdgeInsets.zero,
      labelPadding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}

class _SignalStateChip extends StatelessWidget {
  const _SignalStateChip({required this.label, required this.present});

  final String label;
  final bool present;

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(
        present ? Icons.check_circle : Icons.cancel,
        size: 16,
        color: present ? Colors.green : Colors.grey,
      ),
      label: Text(label, style: const TextStyle(fontSize: 11)),
      backgroundColor: present ? Colors.green.shade50 : Colors.grey.shade100,
      side: BorderSide(
        color: present ? Colors.green.shade200 : Colors.grey.shade300,
      ),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}

class _AnomalyChip extends StatelessWidget {
  const _AnomalyChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}

class _DetailCard extends StatelessWidget {
  const _DetailCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _DetailRowData {
  const _DetailRowData({required this.label, required this.value});

  final String label;
  final String value;
}

class _DetailRowGroup extends StatelessWidget {
  const _DetailRowGroup({required this.rows});

  final List<_DetailRowData> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: rows
          .map(
            (row) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 92,
                    child: Text(
                      row.label,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      row.value,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}
