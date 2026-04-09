import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/nfc_service.dart';
import 'package:passkey_attendance_system/services/student_api.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/config/config.dart';
import 'package:passkey_attendance_system/services/api_client.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/student_account_action_button.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.embedded = false, this.onOpenCheckIn});

  final bool embedded;
  final VoidCallback? onOpenCheckIn;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  late final Future<String?> _userIdFuture;
  Map<String, dynamic>? _lastCheckIn;
  Map<String, dynamic>? _studentDetails;
  bool _piVouchExpiresSoon = false;
  bool _bleSupported = false;
  bool _bluetoothOn = false;
  bool _locationServicesEnabled = false;
  LocationPermission _locationPermission = LocationPermission.denied;
  bool _nfcSupported = false;
  bool _nfcAvailable = false;
  String? _deviceId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SessionStore.sessionRevision.addListener(_handleSessionRevision);
    _userIdFuture = SessionStore.getUserId();
    _refreshDashboard();
  }

  void _handleSessionRevision() {
    _refreshDashboard();
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
    await Future.wait([
      _loadLastCheckIn(),
      _checkPiVouchStatus(),
      _loadStudentDetails(),
      _loadDeviceState(),
    ]);
  }

  Future<void> _loadStudentDetails() async {
    try {
      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) {
        return;
      }
      final data = await StudentApi.getStudentDetails(userId);
      if (mounted) {
        setState(() => _studentDetails = data);
      }
    } catch (_) {}
  }

  Future<void> _loadDeviceState() async {
    try {
      final deviceId = await SessionStore.getDeviceId();
      final bleSupported = await FlutterBluePlus.isSupported;
      final bluetoothOn = bleSupported
          ? await FlutterBluePlus.adapterState.first == BluetoothAdapterState.on
          : false;
      final locationServicesEnabled =
          await Geolocator.isLocationServiceEnabled();
      final locationPermission = await Geolocator.checkPermission();
      final nfcSupported = NfcService.isSupported;
      final nfcAvailable = nfcSupported
          ? await NfcService.isAvailable()
          : false;

      if (mounted) {
        setState(() {
          _deviceId = deviceId;
          _bleSupported = bleSupported;
          _bluetoothOn = bluetoothOn;
          _locationServicesEnabled = locationServicesEnabled;
          _locationPermission = locationPermission;
          _nfcSupported = nfcSupported;
          _nfcAvailable = nfcAvailable;
        });
      }
    } catch (_) {}
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

  Widget _buildStatusColumn(BuildContext context, List<String> lines) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines
          .map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(line, style: theme.textTheme.bodyMedium),
            ),
          )
          .toList(),
    );
  }

  Widget _buildDashboard(BuildContext context, String userId) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final status = _lastCheckIn?['status'] as String?;
    final band = _lastCheckIn?['band'] as String?;
    final score = _lastCheckIn?['score'];
    final savedTime = _lastCheckIn?['time'] as String?;
    final ongoingClass = _studentDetails?['ongoing_class'] as String?;
    final canCheckIn = ongoingClass != null && ongoingClass.isNotEmpty;
    final deviceIdLabel = _deviceId == null
        ? '—'
        : '${_deviceId!.substring(0, 8)}...';
    final gpsPermissionGranted =
        _locationPermission != LocationPermission.denied &&
        _locationPermission != LocationPermission.deniedForever;

    return RefreshIndicator(
      onRefresh: _refreshDashboard,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 108,
            actions: [const StudentAccountActionButton()],
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
                        ongoingClass ?? HomeStrings.noOngoingSession,
                        style: AppTheme.heroMetric(
                          theme.textTheme,
                          colorScheme,
                        ).copyWith(color: colorScheme.onPrimaryContainer),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        HomeStrings.userId(userId),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onPrimaryContainer.withValues(
                            alpha: 0.82,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: canCheckIn
                            ? (widget.onOpenCheckIn ?? () => context.go('/'))
                            : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: colorScheme.onPrimaryContainer,
                          foregroundColor: colorScheme.primaryContainer,
                        ),
                        child: const Text(HomeStrings.checkInNow),
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
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.bluetoothTitle,
                  child: _buildStatusColumn(context, [
                    _bleSupported
                        ? HomeStrings.bleSupported
                        : HomeStrings.bleUnsupported,
                    _bleSupported
                        ? (_bluetoothOn
                              ? HomeStrings.bluetoothOn
                              : HomeStrings.bluetoothOff)
                        : HomeStrings.bluetoothOff,
                  ]),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.gpsTitle,
                  child: _buildStatusColumn(context, [
                    _locationServicesEnabled
                        ? HomeStrings.gpsServicesOn
                        : HomeStrings.gpsServicesOff,
                    gpsPermissionGranted
                        ? HomeStrings.gpsPermissionGranted
                        : HomeStrings.gpsPermissionDenied,
                  ]),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.nfcTitle,
                  child: _buildStatusColumn(context, [
                    _nfcSupported
                        ? (_nfcAvailable
                              ? HomeStrings.nfcAvailable
                              : HomeStrings.nfcUnavailable)
                        : HomeStrings.nfcUnsupported,
                  ]),
                ),
                const SizedBox(height: 16),
                if (_lastCheckIn != null) ...[
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
                  const SizedBox(height: 16),
                ],
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.deviceTitle,
                  child: _buildStatusColumn(context, [
                    HomeStrings.deviceRegistered,
                    HomeStrings.userId(userId),
                    '${HomeStrings.deviceIdLabel}: $deviceIdLabel',
                    HomeStrings.openCheckInTab,
                  ]),
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
