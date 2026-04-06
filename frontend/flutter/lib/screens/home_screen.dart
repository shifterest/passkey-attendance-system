import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late final Future<String?> _userIdFuture;
  bool _isLoggingOut = false;
  Map<String, dynamic>? _lastCheckIn;
  bool _piVouchExpiresSoon = false;
  bool _hasPiVouch = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _userIdFuture = SessionStore.getUserId();
    _loadLastCheckIn();
    _checkPiVouchStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkPiVouchStatus();
    }
  }

  Future<void> _loadLastCheckIn() async {
    final data = await SessionStore.getLastCheckIn();
    if (mounted && data != null) {
      setState(() => _lastCheckIn = data);
    }
  }

  Future<void> _checkPiVouchStatus() async {
    try {
      final sessionToken = await SessionStore.getSessionToken();
      if (sessionToken == null || sessionToken.isEmpty) return;

      final client = ApiClient(Config.apiBaseUrl);
      final response = await client.get(
        ApiPaths.playIntegrityVouchStatus,
        {},
        extraHeaders: {'X-Session-Token': sessionToken},
      );

      if (response is Map<String, dynamic> && mounted) {
        setState(() {
          _hasPiVouch = response['has_vouch'] == true;
          _piVouchExpiresSoon = response['expires_soon'] == true;
        });
      }
    } catch (_) {}
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
                if (_piVouchExpiresSoon) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.warning_amber,
                          color: Colors.orange,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            HomeStrings.piVouchExpiring,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_lastCheckIn != null) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            HomeStrings.lastCheckIn,
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                Icons.circle,
                                size: 10,
                                color: switch (_lastCheckIn!['status']) {
                                  'present' => Colors.green,
                                  'late' => Colors.orange,
                                  _ => Colors.red,
                                },
                              ),
                              const SizedBox(width: 6),
                              Text(_lastCheckIn!['status'] as String? ?? ''),
                              const SizedBox(width: 12),
                              Text(
                                _lastCheckIn!['band'] as String? ?? '',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              const Spacer(),
                              Text(
                                _lastCheckIn!['date'] as String? ?? '',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
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
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push('/offline-check-in'),
                  icon: const Icon(Icons.wifi_off),
                  label: const Text(HomeStrings.checkInOffline),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
