import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

enum _RosterFilter { all, review, accepted }

class TeacherDashboardScreen extends StatefulWidget {
  const TeacherDashboardScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<TeacherDashboardScreen> createState() => _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  List<dynamic> _records = [];
  bool _loading = true;
  _RosterFilter _filter = _RosterFilter.all;

  @override
  void initState() {
    super.initState();
    _fetchRecords();
  }

  Future<void> _fetchRecords() async {
    setState(() => _loading = true);
    try {
      final records = await SessionApi.getSessionRecords(widget.sessionId);
      if (mounted) {
        setState(() {
          _records = records;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        await showErrorDialog(
          context,
          e.toString(),
          body: DashboardStrings.errorLoadingRecords,
        );
      }
    }
  }

  Color _bandColor(String? band) {
    return switch (band) {
      'high' => const Color(0xFF1F9D57),
      'standard' => const Color(0xFF3768D7),
      'low' => const Color(0xFFCB6A00),
      _ => Colors.grey,
    };
  }

  Color _statusColor(String? status) {
    return switch (status) {
      'present' => const Color(0xFF1F9D57),
      'late' => const Color(0xFFCB6A00),
      'absent' => const Color(0xFFC53B3B),
      _ => Colors.grey,
    };
  }

  String _bandLabel(String? band) {
    return switch (band) {
      'high' => CheckInResultStrings.bandHigh,
      'standard' => CheckInResultStrings.bandStandard,
      'low' => CheckInResultStrings.bandLow,
      _ => DashboardStrings.band,
    };
  }

  String _methodLabel(String signal) {
    return switch (signal) {
      'bluetooth' => 'BLE',
      'gps' => 'GPS',
      'nfc' => 'NFC',
      'network' => 'Network',
      'qr_proximity' => 'QR',
      _ => signal,
    };
  }

  List<Widget> _signalChips(Map<String, dynamic>? methods) {
    if (methods == null) return [];

    final chips = <Widget>[];
    final signals = ['bluetooth', 'gps', 'nfc', 'network', 'qr_proximity'];

    for (final signal in signals) {
      final present = methods.containsKey(signal);
      chips.add(
        Padding(
          padding: const EdgeInsets.only(right: 4),
          child: Chip(
            label: Text(
              _methodLabel(signal),
              style: const TextStyle(fontSize: 10),
            ),
            backgroundColor: present
                ? Colors.green.shade50
                : Colors.grey.shade100,
            side: BorderSide(
              color: present ? Colors.green : Colors.grey.shade300,
            ),
            padding: EdgeInsets.zero,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.compact,
          ),
        ),
      );
    }
    return chips;
  }

  List<String> _anomalyLabels(Map<String, dynamic> record) {
    final labels = <String>[];
    final methods = record['verification_methods'] as Map<String, dynamic>?;

    if (methods != null) {
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

  List<Map<String, dynamic>> get _filteredRecords {
    return _records
        .cast<Map<String, dynamic>>()
        .where((record) {
          final band = record['assurance_band_recorded'] as String?;
          final manuallyApproved = record['manually_approved'] == true;

          return switch (_filter) {
            _RosterFilter.all => true,
            _RosterFilter.review => band == 'low' && !manuallyApproved,
            _RosterFilter.accepted => manuallyApproved || band != 'low',
          };
        })
        .toList(growable: false);
  }

  int get _needsReviewCount {
    return _records.cast<Map<String, dynamic>>().where((record) {
      return record['assurance_band_recorded'] == 'low' &&
          record['manually_approved'] != true;
    }).length;
  }

  int get _acceptedCount {
    return _records.cast<Map<String, dynamic>>().where((record) {
      return record['manually_approved'] == true ||
          record['assurance_band_recorded'] != 'low';
    }).length;
  }

  String _shortId(String value) {
    if (value.length <= 14) {
      return value;
    }
    return '${value.substring(0, 10)}...';
  }

  Future<void> _showApprovalSheet(Map<String, dynamic> record) async {
    final recordId = record['id'] as String?;
    if (recordId == null) return;

    final reasonController = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final methods = record['verification_methods'] as Map<String, dynamic>?;
        final anomalies = _anomalyLabels(record);
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                DashboardStrings.reviewRecord,
                style: Theme.of(ctx).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                DashboardStrings.reviewRecordBody,
                style: Theme.of(ctx).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${DashboardStrings.student}: ${record['user_id'] ?? ''}',
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${DashboardStrings.status}: ${record['status'] ?? ''}',
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${DashboardStrings.score}: ${record['assurance_score'] ?? 0}',
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${DashboardStrings.band}: ${_bandLabel(record['assurance_band_recorded'] as String?)}',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                DashboardStrings.signals,
                style: Theme.of(ctx).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Wrap(children: _signalChips(methods)),
              const SizedBox(height: 12),
              Text(
                DashboardStrings.anomalies,
                style: Theme.of(ctx).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              if (anomalies.isEmpty)
                Text(
                  DashboardStrings.noAnomalies,
                  style: Theme.of(ctx).textTheme.bodySmall,
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: anomalies
                      .map((label) => _ReviewTag(label: label))
                      .toList(),
                ),
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
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _approveOrReject(
                          recordId,
                          false,
                          reasonController.text,
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
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await _approveOrReject(
                          recordId,
                          true,
                          reasonController.text,
                        );
                      },
                      child: const Text(DashboardStrings.approve),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );

    reasonController.dispose();
  }

  Future<void> _approveOrReject(
    String recordId,
    bool approve,
    String reason,
  ) async {
    try {
      await SessionApi.approveRecord(recordId, approve, reason);
      await _fetchRecords();
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: DashboardStrings.errorApproving,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filteredRecords = _filteredRecords;

    return Scaffold(
      appBar: AppBar(title: const Text(DashboardStrings.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchRecords,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  Card(
                    color: theme.colorScheme.primaryContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            DashboardStrings.title,
                            style: AppTheme.variable(
                              theme.textTheme.headlineSmall,
                              weight: 700,
                              width: 134,
                              color: theme.colorScheme.onPrimaryContainer,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            DashboardStrings.subtitle,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: theme.colorScheme.onPrimaryContainer
                                  .withValues(alpha: 0.9),
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            DashboardStrings.lowAssuranceHint,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onPrimaryContainer
                                  .withValues(alpha: 0.82),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _SummaryMetricCard(
                        label: DashboardStrings.total,
                        value: '${_records.length}',
                      ),
                      _SummaryMetricCard(
                        label: DashboardStrings.needsReview,
                        value: '$_needsReviewCount',
                      ),
                      _SummaryMetricCard(
                        label: DashboardStrings.accepted,
                        value: '$_acceptedCount',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SegmentedButton<_RosterFilter>(
                    segments: const [
                      ButtonSegment<_RosterFilter>(
                        value: _RosterFilter.all,
                        label: Text(DashboardStrings.allFilter),
                      ),
                      ButtonSegment<_RosterFilter>(
                        value: _RosterFilter.review,
                        label: Text(DashboardStrings.reviewFilter),
                      ),
                      ButtonSegment<_RosterFilter>(
                        value: _RosterFilter.accepted,
                        label: Text(DashboardStrings.acceptedFilter),
                      ),
                    ],
                    selected: {_filter},
                    onSelectionChanged: (next) {
                      setState(() => _filter = next.first);
                    },
                  ),
                  const SizedBox(height: 16),
                  if (_records.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: Center(child: Text(DashboardStrings.noRecords)),
                    )
                  else if (filteredRecords.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: Center(
                        child: Text(DashboardStrings.noFilteredRecords),
                      ),
                    )
                  else
                    ...filteredRecords.map((record) {
                      final status = record['status'] as String?;
                      final band = record['assurance_band_recorded'] as String?;
                      final score = record['assurance_score'] as int? ?? 0;
                      final methods =
                          record['verification_methods']
                              as Map<String, dynamic>?;
                      final isLow =
                          band == 'low' && record['manually_approved'] != true;
                      final anomalies = _anomalyLabels(record);

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          color: isLow
                              ? const Color(0xFFFFF4E7)
                              : theme.colorScheme.surfaceContainerLow,
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
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _shortId(
                                              record['user_id'] as String? ??
                                                  '',
                                            ),
                                            style: theme.textTheme.titleMedium
                                                ?.copyWith(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            record['user_id'] as String? ?? '',
                                            style: theme.textTheme.bodySmall
                                                ?.copyWith(
                                                  color: theme
                                                      .colorScheme
                                                      .onSurfaceVariant,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: [
                                        _RecordBadge(
                                          label: (status ?? '').toUpperCase(),
                                          color: _statusColor(status),
                                        ),
                                        const SizedBox(height: 6),
                                        _RecordBadge(
                                          label: '$score · ${_bandLabel(band)}',
                                          color: _bandColor(band),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  DashboardStrings.signals,
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 6,
                                  children: _signalChips(methods),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  DashboardStrings.anomalies,
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                if (anomalies.isEmpty)
                                  Text(
                                    DashboardStrings.noAnomalies,
                                    style: theme.textTheme.bodySmall,
                                  )
                                else
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: anomalies
                                        .map(
                                          (label) => _ReviewTag(label: label),
                                        )
                                        .toList(),
                                  ),
                                if (record['manually_approved'] == true) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                    DashboardStrings.manuallyApproved,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: _statusColor('present'),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                                if (isLow) ...[
                                  const SizedBox(height: 16),
                                  SizedBox(
                                    width: double.infinity,
                                    child: FilledButton.icon(
                                      onPressed: () =>
                                          _showApprovalSheet(record),
                                      icon: const Icon(
                                        Icons.fact_check_outlined,
                                      ),
                                      label: const Text(
                                        DashboardStrings.reviewRecord,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _SummaryMetricCard extends StatelessWidget {
  const _SummaryMetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: SizedBox(
        width: 112,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Text(label, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
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

class _ReviewTag extends StatelessWidget {
  const _ReviewTag({required this.label});

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
