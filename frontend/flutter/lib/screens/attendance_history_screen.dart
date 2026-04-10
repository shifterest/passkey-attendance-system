import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/bottom_heavy_state.dart';
import 'package:passkey_attendance_system/widgets/collapsing_sliver_title.dart';
import 'package:passkey_attendance_system/widgets/student_account_action_button.dart';

class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  List<Map<String, dynamic>>? _records;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchRecords();
  }

  Future<void> _fetchRecords() async {
    try {
      final userId = await SessionStore.getUserId();
      final sessionToken = await SessionStore.getSessionToken();
      if (userId == null || sessionToken == null) {
        if (mounted) {
          setState(() {
            _error = HistoryStrings.notLoggedIn;
            _loading = false;
          });
        }
        return;
      }

      final client = ApiClient(Config.apiBaseUrl);
      final response = await client.get(
        ApiPaths.recordsByUser(userId),
        {},
        extraHeaders: {'X-Session-Token': sessionToken},
      );

      if (response is List && mounted) {
        setState(() {
          _records = List<Map<String, dynamic>>.from(response);
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Widget _buildScrollContent(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _fetchRecords,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 112,
            actions: const [StudentAccountActionButton()],
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsetsDirectional.only(
                start: 20,
                bottom: 14,
              ),
              title: const CollapsingSliverTitle(text: HistoryStrings.title),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: BottomHeavyState(
                title: _error == HistoryStrings.notLoggedIn
                    ? 'Session Required'
                    : 'Could Not Load History',
                message: _error == HistoryStrings.notLoggedIn
                    ? HistoryStrings.notLoggedIn
                    : HistoryStrings.subtitle,
                detail: _error == HistoryStrings.notLoggedIn ? null : _error,
                icon: Icon(
                  _error == HistoryStrings.notLoggedIn
                      ? Icons.lock_outline_rounded
                      : Icons.history_toggle_off_rounded,
                  size: 56,
                  color: Theme.of(context).colorScheme.primary,
                ),
                primaryAction: FilledButton(
                  onPressed: _error == HistoryStrings.notLoggedIn
                      ? () => context.go('/')
                      : _fetchRecords,
                  child: Text(
                    _error == HistoryStrings.notLoggedIn
                        ? HomeStrings.backToLogin
                        : AuthStrings.retry,
                  ),
                ),
                safeAreaTop: false,
                textAlign: TextAlign.center,
              ),
            )
          else if (_records == null || _records!.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: Text(HistoryStrings.noRecords)),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _RecordCard(record: _records![index]),
                  );
                }, childCount: _records!.length),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final content = _buildScrollContent(context);
    return widget.embedded ? content : Scaffold(body: content);
  }
}

class _RecordCard extends StatelessWidget {
  const _RecordCard({required this.record});

  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context) {
    final status = record['status'] as String? ?? 'unknown';
    final score = record['assurance_score'] as int? ?? 0;
    final band = record['assurance_band_recorded'] as String?;
    final timestamp = record['timestamp'] as String?;
    final methods = record['verification_methods'] as List<dynamic>?;

    final Color statusColor = switch (status) {
      'present' => Colors.green,
      'late' => Colors.orange,
      _ => Colors.red,
    };

    final bandLabel = switch (band) {
      'high' => HistoryStrings.bandHigh,
      'standard' => HistoryStrings.bandStandard,
      'low' => HistoryStrings.bandLow,
      _ => '',
    };

    String formattedTime = '';
    if (timestamp != null) {
      try {
        final dt = DateTime.parse(timestamp).toLocal();
        formattedTime =
            '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        formattedTime = timestamp;
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.circle, color: statusColor, size: 10),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        status[0].toUpperCase() + status.substring(1),
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                      if (bandLabel.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            bandLabel,
                            style: TextStyle(fontSize: 11, color: statusColor),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '${HistoryStrings.score}: $score',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (methods != null && methods.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: Wrap(
                            spacing: 4,
                            children: methods.take(4).map((m) {
                              final label = m
                                  .toString()
                                  .split(':')
                                  .first
                                  .split('_')
                                  .first
                                  .toUpperCase();
                              return Chip(
                                label: Text(
                                  label,
                                  style: const TextStyle(fontSize: 11),
                                ),
                                visualDensity: VisualDensity.compact,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.shrinkWrap,
                                padding: EdgeInsets.zero,
                                labelPadding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Text(formattedTime, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
