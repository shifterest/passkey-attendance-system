import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/services/student_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/student_account_action_button.dart';

import 'offline_check_in_screen.dart';

class CheckInHubScreen extends StatefulWidget {
  const CheckInHubScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<CheckInHubScreen> createState() => _CheckInHubScreenState();
}

class _CheckInHubScreenState extends State<CheckInHubScreen> {
  late final Future<String?> _userIdFuture;
  String? _ongoingClass;

  @override
  void initState() {
    super.initState();
    _userIdFuture = SessionStore.getUserId();
    _loadStudentDetails();
  }

  Future<void> _loadStudentDetails() async {
    try {
      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) return;
      final data = await StudentApi.getStudentDetails(userId);
      if (mounted) {
        setState(() => _ongoingClass = data['ongoing_class'] as String?);
      }
    } catch (_) {}
  }

  Widget _buildNormalTab(BuildContext context, String userId) {
    final canCheckIn = _ongoingClass != null && _ongoingClass!.isNotEmpty;
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                CheckInStrings.normalTitle,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              Text(
                _ongoingClass ?? HomeStrings.noOngoingSession,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              Text(
                canCheckIn
                    ? CheckInStrings.normalBody
                    : CheckInStrings.normalDisabled,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Text(HomeStrings.userId(userId)),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: canCheckIn
                    ? () => context.push(
                        '/authenticate?user_id=${Uri.encodeComponent(userId)}',
                      )
                    : null,
                child: const Text(CheckInStrings.normalButton),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final theme = Theme.of(context);
    return FutureBuilder<String?>(
      future: _userIdFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final userId = snapshot.data;
        if (userId == null || userId.isEmpty) {
          return Center(
            child: FilledButton(
              onPressed: () => context.go('/'),
              child: const Text(HomeStrings.backToLogin),
            ),
          );
        }

        return DefaultTabController(
          length: 2,
          child: NestedScrollView(
            physics: const BouncingScrollPhysics(),
            headerSliverBuilder: (context, innerBoxIsScrolled) => [
              SliverAppBar(
                pinned: true,
                expandedHeight: 112,
                actions: const [StudentAccountActionButton()],
                flexibleSpace: FlexibleSpaceBar(
                  titlePadding: const EdgeInsetsDirectional.only(
                    start: 20,
                    bottom: 48,
                  ),
                  title: Text(
                    CheckInStrings.title,
                    style: AppTheme.sliverTitle(
                      theme.textTheme,
                      theme.colorScheme,
                    ),
                  ),
                ),
                bottom: const TabBar(
                  tabs: [
                    Tab(text: CheckInStrings.normalTab),
                    Tab(text: CheckInStrings.offlineTab),
                  ],
                ),
              ),
            ],
            body: TabBarView(
              children: [
                _buildNormalTab(context, userId),
                const OfflineCheckInScreen(embedded: true, showHeader: false),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _buildBody(context);
    return widget.embedded ? body : Scaffold(body: body);
  }
}
