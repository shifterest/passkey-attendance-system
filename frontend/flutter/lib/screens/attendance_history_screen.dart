import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/attendance_record_surface.dart';
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
                    child: AttendanceRecordCard(
                      record: _records![index],
                      title: recordStatusLabel(
                        _records![index]['status'] as String?,
                      ),
                      subtitle: recordFormattedTimestamp(
                        _records![index]['timestamp'] as String?,
                      ),
                      mode: AttendanceRecordSurfaceMode.student,
                      onTap: () {
                        showAttendanceRecordDetailsSheet(
                          context,
                          record: _records![index],
                          mode: AttendanceRecordSurfaceMode.student,
                        );
                      },
                    ),
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
