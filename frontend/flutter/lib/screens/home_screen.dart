import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    this.embedded = false,
    this.onOpenHistory,
    this.onOpenOffline,
  });

  final bool embedded;
  final VoidCallback? onOpenHistory;
  final VoidCallback? onOpenOffline;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late final Future<String?> _userIdFuture;
  bool _isLoggingOut = false;
  Map<String, dynamic>? _lastCheckIn;
  bool _piVouchExpiresSoon = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SessionStore.sessionRevision.addListener(_handleSessionRevision);
    _userIdFuture = SessionStore.getUserId();
    _loadLastCheckIn();
    _checkPiVouchStatus();
  }

  void _handleSessionRevision() {
    _loadLastCheckIn();
    _checkPiVouchStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    SessionStore.sessionRevision.removeListener(_handleSessionRevision);
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
    if (mounted) {
      setState(() => _lastCheckIn = data);
    }
  }

  Future<void> _refreshDashboard() async {
    await Future.wait([_loadLastCheckIn(), _checkPiVouchStatus()]);
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

  Future<void> _goToCheckIn(String userId) async {
    await context.push('/authenticate?user_id=${Uri.encodeComponent(userId)}');
  }

  Widget _buildInfoCard({
    required BuildContext context,
    required String label,
    required Widget child,
    Color? color,
  }) {
    final theme = Theme.of(context);
    return Card(
      color: color,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTheme.sectionLabel(theme.textTheme, theme.colorScheme)
                  .copyWith(
                    color: color == null
                        ? theme.colorScheme.onSurfaceVariant
                        : theme.colorScheme.onPrimaryContainer.withValues(
                            alpha: 0.8,
                          ),
                  ),
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }

  Widget _buildDashboard(BuildContext context, String userId) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final status = _lastCheckIn?['status'] as String?;
    final band = _lastCheckIn?['band'] as String?;
    final score = _lastCheckIn?['score'];
    final savedTime = _lastCheckIn?['time'] as String?;

    return RefreshIndicator(
      onRefresh: _refreshDashboard,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 124,
            actions: [
              IconButton(
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
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsetsDirectional.only(
                start: 20,
                bottom: 14,
              ),
              title: Text(
                HomeStrings.dashboardTitle,
                style: AppTheme.sliverTitle(theme.textTheme, colorScheme),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.readyTitle,
                  color: colorScheme.primaryContainer,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status == null
                            ? HomeStrings.readyBody
                            : '${status[0].toUpperCase()}${status.substring(1)}${band != null ? ' · ${band.toString().toUpperCase()}' : ''}',
                        style: AppTheme.heroMetric(
                          theme.textTheme,
                          colorScheme,
                        ).copyWith(color: colorScheme.onPrimaryContainer),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        HomeStrings.userId(userId),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onPrimaryContainer.withValues(
                            alpha: 0.82,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () => _goToCheckIn(userId),
                        style: FilledButton.styleFrom(
                          backgroundColor: colorScheme.onPrimaryContainer,
                          foregroundColor: colorScheme.primaryContainer,
                        ),
                        icon: const Icon(Icons.how_to_reg_rounded),
                        label: const Text(HomeStrings.checkInNow),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.quickActions,
                  child: Column(
                    children: [
                      OutlinedButton.icon(
                        onPressed:
                            widget.onOpenHistory ??
                            () => context.push('/history'),
                        icon: const Icon(Icons.history_rounded),
                        label: const Text(HomeStrings.viewHistory),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed:
                            widget.onOpenOffline ??
                            () => context.push('/offline-check-in'),
                        icon: const Icon(Icons.wifi_off_rounded),
                        label: const Text(HomeStrings.checkInOffline),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.integrityTitle,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        _piVouchExpiresSoon
                            ? Icons.warning_amber_rounded
                            : Icons.verified_user_rounded,
                        color: _piVouchExpiresSoon
                            ? Colors.orange
                            : colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _piVouchExpiresSoon
                              ? HomeStrings.integrityNeedsRefresh
                              : HomeStrings.integrityHealthy,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (_lastCheckIn != null)
                  _buildInfoCard(
                    context: context,
                    label: HomeStrings.recentStatus,
                    child: Row(
                      children: [
                        Icon(
                          Icons.circle,
                          size: 12,
                          color: switch (status) {
                            'present' => Colors.green,
                            'late' => Colors.orange,
                            _ => Colors.red,
                          },
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${status?[0].toUpperCase() ?? ''}${status?.substring(1) ?? ''}',
                                style: theme.textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${HomeStrings.scoreLabel}: ${score ?? '—'}${savedTime != null ? ' · $savedTime' : ''}',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        if (band != null)
                          Chip(
                            label: Text(band.toUpperCase()),
                            visualDensity: VisualDensity.compact,
                          ),
                      ],
                    ),
                  ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String?>(
      future: _userIdFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          final loading = const Center(child: CircularProgressIndicator());
          return widget.embedded ? loading : Scaffold(body: loading);
        }

        final userId = snapshot.data;
        if (userId == null || userId.isEmpty) {
          final fallback = Center(
            child: FilledButton(
              onPressed: () => GoRouter.of(context).go('/'),
              child: const Text(HomeStrings.backToLogin),
            ),
          );
          return widget.embedded ? fallback : Scaffold(body: fallback);
        }

        final dashboard = _buildDashboard(context, userId);
        return widget.embedded ? dashboard : Scaffold(body: dashboard);
      },
    );
  }
}
