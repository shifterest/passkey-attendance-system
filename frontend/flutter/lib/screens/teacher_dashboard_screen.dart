import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/attendance_record_surface.dart';
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

    final decision = await showAttendanceRecordDetailsSheet(
      context,
      record: record,
      mode: AttendanceRecordSurfaceMode.teacher,
    );
    if (decision == null) return;

    await _approveOrReject(recordId, decision.approve, decision.reason);
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
                  Row(
                    children: [
                      Expanded(
                        child: _SummaryMetricCard(
                          label: DashboardStrings.total,
                          value: '${_records.length}',
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _SummaryMetricCard(
                          label: DashboardStrings.needsReview,
                          value: '$_needsReviewCount',
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _SummaryMetricCard(
                          label: DashboardStrings.accepted,
                          value: '$_acceptedCount',
                        ),
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
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: AttendanceRecordCard(
                          record: record,
                          title: _shortId(record['user_id'] as String? ?? ''),
                          subtitle: record['user_id'] as String? ?? '',
                          mode: AttendanceRecordSurfaceMode.teacher,
                          onTap: () => _showApprovalSheet(record),
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
    );
  }
}
