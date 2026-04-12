import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_actions.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  bool _isLoading = false;
  bool _isLoggingOut = false;

  Future<void> _openSession(String userId) async {
    setState(() => _isLoading = true);
    try {
      final session = await SessionApi.openTeacherSession(userId);
      final sessionId = session['id'];
      if (!mounted) return;
      if (sessionId is String) {
        context.push('/teacher/session/$sessionId');
      }
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: TeacherStrings.errorOpeningSession,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _logout(String userId) async {
    if (_isLoggingOut) return;
    setState(() => _isLoggingOut = true);
    try {
      await SessionActions.signOutCurrentUser();
      if (!mounted) return;
      GoRouter.of(context).go('/');
    } finally {
      if (mounted) setState(() => _isLoggingOut = false);
    }
  }

  String _shortId(String value) {
    if (value.length <= 12) {
      return value;
    }
    return '${value.substring(0, 8)}...${value.substring(value.length - 4)}';
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: SessionStore.getUserId(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final userId = snapshot.data;
        if (userId == null || userId.isEmpty) {
          return Scaffold(
            appBar: AppBar(title: const Text(TeacherStrings.appBarTitle)),
            body: Center(
              child: FilledButton(
                onPressed: () => GoRouter.of(context).go('/'),
                child: const Text(HomeStrings.backToLogin),
              ),
            ),
          );
        }

        final theme = Theme.of(context);
        final colorScheme = theme.colorScheme;

        return Scaffold(
          appBar: AppBar(
            title: const Text(TeacherStrings.appBarTitle),
            actions: [
              IconButton(
                tooltip: HomeStrings.signOutAction,
                onPressed: _isLoggingOut ? null : () => _logout(userId),
                icon: _isLoggingOut
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.logout_rounded),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              Card(
                color: colorScheme.primaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.onPrimaryContainer.withValues(
                            alpha: 0.1,
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          TeacherStrings.signedInLabel,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        TeacherStrings.landingTitle,
                        style: AppTheme.variable(
                          theme.textTheme.headlineSmall,
                          weight: 700,
                          width: 134,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        TeacherStrings.landingBody,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: colorScheme.onPrimaryContainer.withValues(
                            alpha: 0.9,
                          ),
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Icon(
                            Icons.verified_user_outlined,
                            size: 18,
                            color: colorScheme.onPrimaryContainer,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _shortId(userId),
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: colorScheme.onPrimaryContainer,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _TeacherActionCard(
                icon: Icons.play_circle_fill_rounded,
                title: TeacherStrings.liveSessionTitle,
                body: TeacherStrings.liveSessionBody,
                action: FilledButton.icon(
                  onPressed: _isLoading ? null : () => _openSession(userId),
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.play_arrow_rounded),
                  label: const Text(TeacherStrings.openSession),
                ),
              ),
              const SizedBox(height: 12),
              _TeacherActionCard(
                icon: Icons.wifi_off_rounded,
                title: OfflineStrings.startOfflineSession,
                body: TeacherStrings.offlineSessionBody,
                action: OutlinedButton.icon(
                  onPressed: () => context.push('/teacher/offline'),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: const Text(OfflineStrings.startOfflineSession),
                ),
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        TeacherStrings.sessionFlowTitle,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const _TeacherStepTile(
                        index: '1',
                        body: TeacherStrings.sessionFlowStepOne,
                      ),
                      const SizedBox(height: 10),
                      const _TeacherStepTile(
                        index: '2',
                        body: TeacherStrings.sessionFlowStepTwo,
                      ),
                      const SizedBox(height: 10),
                      const _TeacherStepTile(
                        index: '3',
                        body: TeacherStrings.sessionFlowStepThree,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TeacherActionCard extends StatelessWidget {
  const _TeacherActionCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: theme.colorScheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(body, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, child: action),
          ],
        ),
      ),
    );
  }
}

class _TeacherStepTile extends StatelessWidget {
  const _TeacherStepTile({required this.index, required this.body});

  final String index;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            index,
            style: theme.textTheme.labelLarge?.copyWith(
              color: theme.colorScheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(body, style: theme.textTheme.bodyMedium)),
      ],
    );
  }
}
