import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Future<String?> _userIdFuture;
  bool _isLoggingOut = false;

  @override
  void initState() {
    super.initState();
    _userIdFuture = SessionStore.getUserId();
  }

  Future<void> _logout(String userId) async {
    if (_isLoggingOut) return;
    setState(() {
      _isLoggingOut = true;
    });

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
      if (mounted) {
        setState(() {
          _isLoggingOut = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: _userIdFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final userId = snapshot.data;
        if (userId == null || userId.isEmpty) {
          return Scaffold(
            appBar: AppBar(title: const Text(HomeStrings.appBarTitle)),
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
            title: const Text(HomeStrings.appBarTitle),
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
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () {
                    context.push(
                      '/authenticate?user_id=${Uri.encodeComponent(userId)}',
                    );
                  },
                  icon: const Icon(Icons.how_to_reg),
                  label: const Text(HomeStrings.checkInNow),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
