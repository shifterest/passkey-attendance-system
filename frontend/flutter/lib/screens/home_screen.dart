import 'dart:io' show Platform;

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
import 'package:passkey_attendance_system/widgets/collapsing_sliver_title.dart';
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
  List<Map<String, dynamic>> _recentRecords = const [];
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
      _loadRecentRecords(),
      _checkPiVouchStatus(),
      _loadStudentDetails(),
      _loadDeviceState(),
    ]);
  }

  Future<void> _loadRecentRecords() async {
    try {
      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) {
        return;
      }
      final records = await StudentApi.getStudentRecords(userId);
      records.sort((a, b) {
        final aTime =
            DateTime.tryParse(a['timestamp'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final bTime =
            DateTime.tryParse(b['timestamp'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });
      if (mounted) {
        setState(
          () => _recentRecords = records.take(3).toList(growable: false),
        );
      }
    } catch (_) {}
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

  Widget _buildStatusRow({
    required BuildContext context,
    required IconData icon,
    required String text,
    VoidCallback? onAction,
    String? actionLabel,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text, style: theme.textTheme.bodyMedium),
                if (onAction != null && actionLabel != null) ...[
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: onAction,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(0, 0),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      alignment: Alignment.centerLeft,
                    ),
                    child: Text(actionLabel),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showInfoDialog(String title, String body) async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _turnOnBluetooth() async {
    if (!Platform.isAndroid) return;
    try {
      await FlutterBluePlus.turnOn();
    } catch (_) {}
    await _loadDeviceState();
  }

  Future<void> _requestLocationPermission() async {
    await Geolocator.requestPermission();
    await _loadDeviceState();
  }

  Future<void> _openLocationSettings() async {
    await Geolocator.openLocationSettings();
    await _loadDeviceState();
  }

  Future<void> _showNfcTurnOnInfo() async {
    await _showInfoDialog(HomeStrings.nfcInfoTitle, HomeStrings.nfcInfoBody);
  }

  String _formatRecentTime(String timestamp) {
    final dt = DateTime.tryParse(timestamp)?.toLocal();
    if (dt == null) {
      return timestamp;
    }
    return '${dt.month}/${dt.day} ${dt.hour}:${dt.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildDashboard(BuildContext context, String userId) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final status = _lastCheckIn?['status'] as String?;
    final band = _lastCheckIn?['band'] as String?;
    final score = _lastCheckIn?['score'];
    final savedTime = _lastCheckIn?['time'] as String?;
    final ongoingClass = _studentDetails?['ongoing_class'] as String?;
    final fullName = (_studentDetails?['full_name'] as String?)?.trim();
    final greetingName = fullName == null || fullName.isEmpty
        ? null
        : fullName.split(' ').first;
    final canCheckIn = ongoingClass != null && ongoingClass.isNotEmpty;
    final registered = _studentDetails?['registered'] == true;
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
              title: const CollapsingSliverTitle(
                text: HomeStrings.dashboardTitle,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildInfoCard(
                  context: context,
                  label: greetingName == null ? 'Hey' : 'Hey, $greetingName',
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
                  label: HomeStrings.recentStatus,
                  child: _recentRecords.isEmpty
                      ? Text(
                          HomeStrings.recentHistoryEmpty,
                          style: theme.textTheme.bodyMedium,
                        )
                      : Column(
                          children: _recentRecords.map((record) {
                            final itemStatus =
                                record['status'] as String? ?? 'unknown';
                            final itemScore = record['assurance_score'];
                            final itemBand =
                                record['assurance_band_recorded'] as String?;
                            final sessionId =
                                record['session_id'] as String? ?? '—';
                            final timestamp =
                                record['timestamp'] as String? ?? '';
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.history_rounded,
                                    size: 18,
                                    color: colorScheme.primary,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${HomeStrings.sessionLabel}: ${sessionId.substring(0, sessionId.length > 8 ? 8 : sessionId.length)}',
                                          style: AppTheme.variable(
                                            theme.textTheme.titleSmall,
                                            weight: 620,
                                            width: 120,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${itemStatus[0].toUpperCase()}${itemStatus.substring(1)} · ${HomeStrings.scoreLabel}: ${itemScore ?? '—'}${itemBand != null ? ' · ${itemBand.toUpperCase()}' : ''}',
                                          style: theme.textTheme.bodySmall,
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    _formatRecentTime(timestamp),
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.integrityTitle,
                  child: Column(
                    children: [
                      _buildStatusRow(
                        context: context,
                        icon: Icons.shield_outlined,
                        text: _piVouchExpiresSoon
                            ? HomeStrings.integrityNeedsRefresh
                            : HomeStrings.integrityHealthy,
                      ),
                      _buildStatusRow(
                        context: context,
                        icon: Icons.android_rounded,
                        text: registered
                            ? HomeStrings.attestationPassed
                            : HomeStrings.attestationUnavailable,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.proximityTitle,
                  child: Column(
                    children: [
                      if (!_bleSupported)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.bluetooth_disabled_rounded,
                          text: HomeStrings.bleUnsupported,
                          onAction: () => _showInfoDialog(
                            HomeStrings.bleInfoTitle,
                            HomeStrings.bleInfoBody,
                          ),
                          actionLabel: HomeStrings.moreInfo,
                        )
                      else if (!_bluetoothOn)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.bluetooth_disabled_rounded,
                          text: HomeStrings.bluetoothOff,
                          onAction: _turnOnBluetooth,
                          actionLabel: HomeStrings.turnOn,
                        )
                      else
                        _buildStatusRow(
                          context: context,
                          icon: Icons.bluetooth_rounded,
                          text: HomeStrings.bluetoothOn,
                        ),
                      if (_locationServicesEnabled && !gpsPermissionGranted)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.location_on_outlined,
                          text: HomeStrings.gpsPermissionDenied,
                          onAction: _requestLocationPermission,
                          actionLabel: HomeStrings.grant,
                        )
                      else if (!_locationServicesEnabled)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.location_off_outlined,
                          text: HomeStrings.gpsServicesOff,
                          onAction: _openLocationSettings,
                          actionLabel: HomeStrings.turnOn,
                        )
                      else
                        _buildStatusRow(
                          context: context,
                          icon: Icons.location_on_outlined,
                          text: HomeStrings.gpsServicesOn,
                        ),
                      if (!_nfcSupported)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.nfc_rounded,
                          text: HomeStrings.nfcUnsupported,
                        )
                      else if (!_nfcAvailable)
                        _buildStatusRow(
                          context: context,
                          icon: Icons.nfc_rounded,
                          text: HomeStrings.nfcUnavailable,
                          onAction: _showNfcTurnOnInfo,
                          actionLabel: HomeStrings.turnOn,
                        )
                      else
                        _buildStatusRow(
                          context: context,
                          icon: Icons.nfc_rounded,
                          text: HomeStrings.nfcAvailable,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _buildInfoCard(
                  context: context,
                  label: HomeStrings.identityTitle,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildStatusRow(
                        context: context,
                        icon: Icons.link_rounded,
                        text: registered
                            ? HomeStrings.deviceBindingActive
                            : HomeStrings.registrationNeeded,
                      ),
                      Text(
                        HomeStrings.userId(userId),
                        style: theme.textTheme.bodyLarge,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${HomeStrings.deviceIdLabel}: $deviceIdLabel',
                        style: theme.textTheme.bodyMedium,
                      ),
                      if (_lastCheckIn != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          '${status?[0].toUpperCase() ?? ''}${status?.substring(1) ?? ''}${band != null ? ' · ${band.toUpperCase()}' : ''}${savedTime != null ? ' · $savedTime' : ''}',
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${HomeStrings.scoreLabel}: ${score ?? '—'}',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
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
