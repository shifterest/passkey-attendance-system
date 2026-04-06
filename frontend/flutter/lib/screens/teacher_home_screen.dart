import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
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
      final sessionToken = await SessionStore.getSessionToken();
      if (sessionToken != null && sessionToken.isNotEmpty) {
        try {
          await AuthApi.logout(userId, sessionToken);
        } catch (_) {}
      }
      await SessionStore.clearSession();
      if (!mounted) return;
      GoRouter.of(context).go('/');
    } finally {
      if (mounted) setState(() => _isLoggingOut = false);
    }
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

        return Scaffold(
          appBar: AppBar(
            title: const Text(TeacherStrings.appBarTitle),
            actions: [
              IconButton(
                onPressed: _isLoggingOut ? null : () => _logout(userId),
                icon: _isLoggingOut
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.logout),
              ),
            ],
          ),
          body: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  HomeStrings.signedIn,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  HomeStrings.userId(userId),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _isLoading ? null : () => _openSession(userId),
                    icon: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.play_arrow),
                    label: const Text(TeacherStrings.openSession),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.push('/teacher/offline'),
                    icon: const Icon(Icons.wifi_off),
                    label: const Text(OfflineStrings.startOfflineSession),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
