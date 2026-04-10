import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/services/student_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/check_in_signal_shape.dart';
import 'package:passkey_attendance_system/widgets/embedded_web_login_scanner.dart';
import 'package:passkey_attendance_system/widgets/student_account_action_button.dart';

import 'offline_check_in_screen.dart';

class CheckInHubScreen extends StatefulWidget {
  const CheckInHubScreen({
    super.key,
    this.embedded = false,
    this.active = true,
  });

  final bool embedded;
  final bool active;

  @override
  State<CheckInHubScreen> createState() => _CheckInHubScreenState();
}

class _CheckInHubScreenState extends State<CheckInHubScreen>
    with SingleTickerProviderStateMixin {
  late final Future<String?> _userIdFuture;
  String? _ongoingClass;
  Map<String, dynamic>? _lastCheckIn;
  StreamSubscription<List<ScanResult>>? _scanSubscription;
  Timer? _scanRestartTimer;
  DateTime? _lastSignalSeenAt;
  final DateTime _enteredAt = DateTime.now();
  int _selectedTab = 0;
  int? _strongestRssi;
  String? _detectedBleToken;
  bool _bluetoothReady = false;
  bool _bleSupported = false;
  bool _blePermissionGranted = true;
  bool _scanCycleRunning = false;
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _userIdFuture = SessionStore.getUserId();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_handleTabChange);
    SessionStore.sessionRevision.addListener(_handleSessionRevision);
    _loadStudentDetails();
    _loadLastCheckIn();
    if (widget.active) {
      _syncPassiveScan();
    }
  }

  @override
  void didUpdateWidget(CheckInHubScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) {
      _syncPassiveScan();
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    SessionStore.sessionRevision.removeListener(_handleSessionRevision);
    _stopPassiveScan();
    super.dispose();
  }

  void _handleTabChange() {
    final nextIndex = _tabController.index;
    if (_selectedTab == nextIndex) {
      return;
    }
    setState(() => _selectedTab = nextIndex);
    if (nextIndex == 0) {
      _syncPassiveScan();
    } else {
      _stopPassiveScan();
    }
  }

  void _handleSessionRevision() {
    _loadStudentDetails();
    _loadLastCheckIn();
    _syncPassiveScan();
  }

  Future<void> _loadLastCheckIn() async {
    final data = await SessionStore.getLastCheckIn();
    if (!mounted) return;
    setState(() => _lastCheckIn = data);
  }

  Future<void> _loadStudentDetails() async {
    try {
      final userId = await SessionStore.getUserId();
      if (userId == null || userId.isEmpty) return;
      final data = await StudentApi.getStudentDetails(userId);
      if (mounted) {
        setState(() => _ongoingClass = data['ongoing_class'] as String?);
      }
      await _syncPassiveScan();
    } catch (_) {}
  }

  bool get _canCheckIn => _ongoingClass != null && _ongoingClass!.isNotEmpty;

  bool get _hasFreshSuccess {
    final savedAt = DateTime.tryParse(
      _lastCheckIn?['saved_at'] as String? ?? '',
    );
    return savedAt != null && savedAt.isAfter(_enteredAt);
  }

  Future<void> _syncPassiveScan() async {
    if (!_shouldSenseBle) {
      await _stopPassiveScan();
      return;
    }

    _bleSupported = await FlutterBluePlus.isSupported;
    if (!_bleSupported) {
      if (mounted) {
        setState(() {
          _bluetoothReady = false;
          _detectedBleToken = null;
          _strongestRssi = null;
        });
      }
      return;
    }

    if (!kIsWeb) {
      final statuses = await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
      ].request();
      _blePermissionGranted =
          statuses[Permission.bluetoothScan] == PermissionStatus.granted &&
          statuses[Permission.bluetoothConnect] == PermissionStatus.granted;
      if (!_blePermissionGranted) {
        if (mounted) {
          setState(() {
            _blePermissionGranted = false;
            _bluetoothReady = false;
            _detectedBleToken = null;
            _strongestRssi = null;
          });
        }
        return;
      }
    }

    final adapterState = await FlutterBluePlus.adapterState.first;
    _bluetoothReady = adapterState == BluetoothAdapterState.on;
    if (!_bluetoothReady) {
      if (mounted) {
        setState(() {
          _detectedBleToken = null;
          _strongestRssi = null;
        });
      }
      return;
    }
    if (mounted) {
      setState(() {
        _blePermissionGranted = true;
      });
    }

    _scanSubscription ??= FlutterBluePlus.scanResults.listen((results) {
      int? strongestRssi;
      String? strongestToken;
      for (final result in results) {
        final advName = result.advertisementData.advName;
        if (advName.isEmpty) {
          continue;
        }
        if (strongestRssi == null || result.rssi > strongestRssi) {
          strongestRssi = result.rssi;
          strongestToken = advName;
        }
      }
      if (!mounted || strongestRssi == null || strongestToken == null) {
        return;
      }
      _lastSignalSeenAt = DateTime.now();
      setState(() {
        _strongestRssi = strongestRssi;
        _detectedBleToken = strongestToken;
      });
    });

    if (_scanCycleRunning) {
      if (mounted) setState(() {});
      return;
    }

    _scanCycleRunning = true;
    if (mounted) setState(() {});
    try {
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 6));
      await FlutterBluePlus.isScanning.where((value) => !value).first;
    } catch (_) {
    } finally {
      _scanCycleRunning = false;
      final lastSeen = _lastSignalSeenAt;
      if (lastSeen == null ||
          DateTime.now().difference(lastSeen) > const Duration(seconds: 8)) {
        if (mounted) {
          setState(() {
            _detectedBleToken = null;
            _strongestRssi = null;
          });
        }
      }
      if (_shouldSenseBle) {
        _scanRestartTimer?.cancel();
        _scanRestartTimer = Timer(const Duration(milliseconds: 900), () {
          _syncPassiveScan();
        });
      }
      if (mounted) setState(() {});
    }
  }

  Future<void> _stopPassiveScan() async {
    _scanRestartTimer?.cancel();
    _scanRestartTimer = null;
    await FlutterBluePlus.stopScan();
    await _scanSubscription?.cancel();
    _scanSubscription = null;
    _scanCycleRunning = false;
    if (mounted) {
      setState(() {
        _detectedBleToken = null;
        _strongestRssi = null;
      });
    }
  }

  bool get _shouldSenseBle => widget.active && _selectedTab == 0 && _canCheckIn;

  CheckInSignalVisualState get _visualState {
    if (_hasFreshSuccess) {
      return CheckInSignalVisualState.success;
    }
    if (_canCheckIn && _detectedBleToken != null && _strongestRssi != null) {
      return CheckInSignalVisualState.detected;
    }
    if (_canCheckIn) {
      return CheckInSignalVisualState.ready;
    }
    return CheckInSignalVisualState.idle;
  }

  String get _signalLabel {
    final rssi = _strongestRssi;
    if (rssi == null) {
      return CheckInStrings.signalUnavailable;
    }
    if (rssi > -65) {
      return CheckInStrings.signalClose;
    }
    if (rssi >= -80) {
      return CheckInStrings.signalModerate;
    }
    return CheckInStrings.signalFar;
  }

  Color get _stageColor {
    if (_hasFreshSuccess) {
      return switch (_lastCheckIn?['band'] as String?) {
        'high' => const Color(0xFF35C66B),
        'standard' => const Color(0xFF4E8DFF),
        'low' => const Color(0xFFFF5B57),
        _ => Colors.white70,
      };
    }
    final rssi = _strongestRssi;
    if (!_canCheckIn) {
      return Colors.white24;
    }
    if (!_bluetoothReady) {
      return const Color(0xFF5C6470);
    }
    if (rssi == null) {
      return const Color(0xFF77808D);
    }
    if (rssi > -65) {
      return const Color(0xFF38D86B);
    }
    if (rssi >= -80) {
      return const Color(0xFF4AA4FF);
    }
    return const Color(0xFFF5A623);
  }

  double get _stageSize {
    if (_hasFreshSuccess) {
      return 192;
    }
    final rssi = _strongestRssi;
    if (!_canCheckIn) {
      return 164;
    }
    if (rssi == null) {
      return 182;
    }
    if (rssi > -65) {
      return 248;
    }
    if (rssi >= -80) {
      return 222;
    }
    return 198;
  }

  String get _stageTitle {
    if (!_canCheckIn) {
      return CheckInStrings.stageIdleTitle;
    }
    if (!_blePermissionGranted) {
      return CheckInStrings.bluetoothPermissionTitle;
    }
    if (!_bluetoothReady) {
      return CheckInStrings.bluetoothOff;
    }
    return switch (_visualState) {
      CheckInSignalVisualState.idle => CheckInStrings.stageIdleTitle,
      CheckInSignalVisualState.ready => CheckInStrings.stageReadyTitle,
      CheckInSignalVisualState.detected => CheckInStrings.stageDetectedTitle,
      CheckInSignalVisualState.success => CheckInStrings.stageSuccessTitle,
    };
  }

  String get _stageBody {
    if (!_canCheckIn) {
      return CheckInStrings.stageIdleBody;
    }
    if (!_blePermissionGranted) {
      return CheckInStrings.bluetoothPermissionBody;
    }
    if (!_bluetoothReady) {
      return CheckInStrings.bluetoothOffBody;
    }
    return switch (_visualState) {
      CheckInSignalVisualState.idle => CheckInStrings.stageIdleBody,
      CheckInSignalVisualState.ready => CheckInStrings.stageReadyBody,
      CheckInSignalVisualState.detected => CheckInStrings.stageDetectedBody,
      CheckInSignalVisualState.success => CheckInStrings.stageSuccessBody,
    };
  }

  Future<void> _handleShapeTap(String userId) async {
    if (!_canCheckIn) {
      return;
    }
    if (!_blePermissionGranted) {
      await _syncPassiveScan();
      return;
    }
    if (!_bluetoothReady) {
      if (!kIsWeb && Platform.isAndroid) {
        try {
          await FlutterBluePlus.turnOn();
        } catch (_) {}
      }
      await _syncPassiveScan();
      return;
    }
    if (_detectedBleToken != null || _hasFreshSuccess) {
      await _launchCheckIn(userId);
    }
  }

  Future<void> _launchCheckIn(String userId) async {
    if (!_canCheckIn) {
      return;
    }
    await context.push('/authenticate?user_id=${Uri.encodeComponent(userId)}');
    await _loadLastCheckIn();
    await _syncPassiveScan();
  }

  ThemeData _immersiveTheme() {
    final base = AppTheme.dark();
    return base.copyWith(
      scaffoldBackgroundColor: Colors.black,
      canvasColor: Colors.black,
      appBarTheme: base.appBarTheme.copyWith(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        color: const Color(0xFF0D0D0D),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: Colors.transparent,
        indicator: UnderlineTabIndicator(
          borderSide: const BorderSide(color: Colors.white, width: 2),
          insets: const EdgeInsets.symmetric(horizontal: 24),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: Colors.white70,
        labelStyle: AppTheme.variable(
          base.textTheme.labelLarge,
          weight: 620,
          width: 112,
          color: Colors.white,
        ),
        unselectedLabelStyle: AppTheme.variable(
          base.textTheme.labelLarge,
          weight: 560,
          width: 108,
          color: Colors.white70,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.white,
          side: BorderSide(color: Colors.white.withValues(alpha: 0.18)),
          minimumSize: const Size.fromHeight(56),
        ),
      ),
    );
  }

  Widget _buildNormalTab(BuildContext context, String userId) {
    final theme = Theme.of(context);
    final canTap =
        _hasFreshSuccess ||
        _detectedBleToken != null ||
        (_canCheckIn && _blePermissionGranted && !_bluetoothReady) ||
        (_canCheckIn && !_blePermissionGranted);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            HomeStrings.userId(userId),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.54),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Center(
              child: SizedBox(
                width: double.infinity,
                height: 352,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Center(
                      child: CheckInSignalShape(
                        visualState: _visualState,
                        color: _stageColor,
                        size: _stageSize,
                        enabled: canTap,
                        onTap: () => _handleShapeTap(userId),
                      ),
                    ),
                    IgnorePointer(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _stageTitle,
                              textAlign: TextAlign.center,
                              style: AppTheme.variable(
                                theme.textTheme.headlineSmall,
                                weight: 700,
                                width: 142,
                                color: Colors.white,
                              ),
                            ),
                            if (_detectedBleToken != null &&
                                _strongestRssi != null) ...[
                              const SizedBox(height: 8),
                              Text(
                                _signalLabel,
                                textAlign: TextAlign.center,
                                style: AppTheme.variable(
                                  theme.textTheme.labelLarge,
                                  weight: 620,
                                  width: 110,
                                  color: Colors.white.withValues(alpha: 0.82),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _stageBody,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.72),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildOfflineTab(BuildContext context) {
    return Theme(
      data: _immersiveTheme(),
      child: const DecoratedBox(
        decoration: BoxDecoration(color: Colors.black),
        child: OfflineCheckInScreen(embedded: true, showHeader: false),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final theme = _immersiveTheme();
    final titleStyle = AppTheme.variable(
      theme.textTheme.titleLarge,
      weight: 660,
      width: 118,
      size: (theme.textTheme.titleLarge?.fontSize ?? 22) * 1.18,
      color: Colors.white,
      letterSpacing: -0.2,
    );

    return Theme(
      data: theme,
      child: DecoratedBox(
        decoration: const BoxDecoration(color: Colors.black),
        child: FutureBuilder<String?>(
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
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SafeArea(
                  bottom: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 72,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 8, 0),
                          child: Row(
                            children: [
                              Expanded(
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    CheckInStrings.title,
                                    style: titleStyle,
                                  ),
                                ),
                              ),
                              const StudentAccountActionButton(),
                            ],
                          ),
                        ),
                      ),
                      TabBar(
                        controller: _tabController,
                        tabs: const [
                          Tab(text: CheckInStrings.normalTab),
                          Tab(text: CheckInStrings.offlineTab),
                          Tab(text: CheckInStrings.webLoginTab),
                        ],
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildNormalTab(context, userId),
                      _buildOfflineTab(context),
                      const EmbeddedWebLoginScanner(embedded: true),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _buildBody(context);
    return widget.embedded ? body : Scaffold(body: body);
  }
}
