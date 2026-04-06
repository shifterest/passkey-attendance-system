import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

class TeacherDashboardScreen extends StatefulWidget {
  const TeacherDashboardScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<TeacherDashboardScreen> createState() => _TeacherDashboardScreenState();
}

class _TeacherDashboardScreenState extends State<TeacherDashboardScreen> {
  List<dynamic> _records = [];
  bool _loading = true;

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
      'high' => Colors.green,
      'standard' => Colors.blue,
      'low' => Colors.orange,
      _ => Colors.grey,
    };
  }

  Color _statusColor(String? status) {
    return switch (status) {
      'present' => Colors.green,
      'late' => Colors.orange,
      'absent' => Colors.red,
      _ => Colors.grey,
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
              signal.split('_').first.toUpperCase(),
              style: const TextStyle(fontSize: 10),
            ),
            backgroundColor: present ? Colors.green.shade50 : Colors.grey.shade100,
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

  List<Widget> _anomalyIcons(Map<String, dynamic> record) {
    final icons = <Widget>[];
    final methods = record['verification_methods'] as Map<String, dynamic>?;

    if (methods != null) {
      final gps = methods['gps'] as Map<String, dynamic>?;
      if (gps != null && gps['mock'] == true) {
        icons.add(const Tooltip(
          message: DashboardStrings.mockGps,
          child: Icon(Icons.gps_off, size: 16, color: Colors.red),
        ));
      }
    }

    if (record['sign_count_anomaly'] == true) {
      icons.add(const Tooltip(
        message: DashboardStrings.signCountAnomaly,
        child: Icon(Icons.warning, size: 16, color: Colors.amber),
      ));
    }

    if (record['sync_pending'] == true) {
      icons.add(const Tooltip(
        message: DashboardStrings.syncPending,
        child: Icon(Icons.cloud_off, size: 16, color: Colors.orange),
      ));
    }

    return icons;
  }

  Future<void> _showApprovalSheet(Map<String, dynamic> record) async {
    final recordId = record['id'] as String?;
    if (recordId == null) return;

    final reasonController = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
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
              const SizedBox(height: 12),
              Text('${DashboardStrings.student}: ${record['user_id'] ?? ''}'),
              Text('${DashboardStrings.score}: ${record['assurance_score'] ?? 0}'),
              Text('${DashboardStrings.band}: ${record['assurance_band_recorded'] ?? ''}'),
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
                        await _approveOrReject(recordId, false, reasonController.text);
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
                        await _approveOrReject(recordId, true, reasonController.text);
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
    return Scaffold(
      appBar: AppBar(title: const Text(DashboardStrings.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchRecords,
              child: _records.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 100),
                        Center(child: Text(DashboardStrings.noRecords)),
                      ],
                    )
                  : ListView.builder(
                      itemCount: _records.length,
                      itemBuilder: (context, index) {
                        final record = _records[index] as Map<String, dynamic>;
                        final status = record['status'] as String?;
                        final band = record['assurance_band_recorded'] as String?;
                        final score = record['assurance_score'] as int? ?? 0;
                        final methods =
                            record['verification_methods'] as Map<String, dynamic>?;
                        final isLow = band == 'low';

                        return Card(
                          color: isLow ? Colors.orange.shade50 : null,
                          margin: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 4),
                          child: InkWell(
                            onTap: isLow ? () => _showApprovalSheet(record) : null,
                            borderRadius: BorderRadius.circular(12),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          record['user_id'] as String? ?? '',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium
                                              ?.copyWith(
                                                  fontWeight: FontWeight.w600),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: _statusColor(status)
                                              .withValues(alpha: 0.1),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          status ?? '',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: _statusColor(status),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: _bandColor(band)
                                              .withValues(alpha: 0.1),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          '$band ($score)',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: _bandColor(band),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      ..._signalChips(methods),
                                      const Spacer(),
                                      ..._anomalyIcons(record),
                                    ],
                                  ),
                                  if (record['manually_approved'] == true)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        DashboardStrings.manuallyApproved,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(color: Colors.green),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
