import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/nfc_service.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/passkey.dart'
    show PasskeyAuthCancelledException;
import 'package:passkey_attendance_system/services/play_integrity_service.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/services/student_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';
import 'package:passkey_attendance_system/widgets/check_in_signal_shape.dart';
import 'package:passkey_attendance_system/widgets/embedded_web_login_scanner.dart';
import 'package:passkey_attendance_system/widgets/live_session_surface.dart';
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
  static final _teacherServiceGuid = Guid(
    '0000fff0-0000-1000-8000-00805f9b34fb',
  );
  late final Future<String?> _userIdFuture;
  bool _hasActiveSession = false;
  Map<String, dynamic>? _lastCheckIn;
  StreamSubscription<List<ScanResult>>? _scanSubscription;
  Timer? _scanRestartTimer;
  DateTime? _lastSignalSeenAt;
  final DateTime _enteredAt = DateTime.now();
  int _selectedTab = 0;
  int? _strongestRssi;
  String? _detectedBleToken;
  final List<int> _accumulatedRssiReadings = [];
  bool _bluetoothReady = false;
  bool _bleSupported = false;
  bool _blePermissionGranted = true;
  bool _scanCycleRunning = false;
  bool _isCheckingIn = false;
  String? _checkInError;
  bool _nfcListening = false;
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
      _syncNfcListener();
    }
  }

  @override
  void didUpdateWidget(CheckInHubScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) {
      _syncPassiveScan();
      _syncNfcListener();
    }
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    SessionStore.sessionRevision.removeListener(_handleSessionRevision);
    _stopPassiveScan();
    _stopNfcListener();
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
      _syncNfcListener();
    } else {
      _stopPassiveScan();
      _stopNfcListener();
    }
  }

  void _handleSessionRevision() {
    _loadStudentDetails();
    _loadLastCheckIn();
    _syncPassiveScan();
    _syncNfcListener();
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
        setState(() {
          _hasActiveSession = data['has_active_session'] as bool? ?? false;
        });
      }
      await _syncPassiveScan();
      _syncNfcListener();
    } catch (_) {}
  }

  bool get _canCheckIn => _hasActiveSession;

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
        final serviceData = result.advertisementData.serviceData;
        List<int>? bytes;
        for (final entry in serviceData.entries) {
          if (entry.key == _teacherServiceGuid) {
            bytes = entry.value;
            break;
          }
        }
        if (bytes == null || bytes.isEmpty) continue;
        final token = utf8.decode(bytes, allowMalformed: true).trim();
        if (token.isEmpty) continue;
        _accumulatedRssiReadings.add(result.rssi);
        if (strongestRssi == null || result.rssi > strongestRssi) {
          strongestRssi = result.rssi;
          strongestToken = token;
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
            _accumulatedRssiReadings.clear();
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
    if (_isCheckingIn) {
      return CheckInSignalVisualState.checkingIn;
    }
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

  LiveSessionPhase get _livePhase {
    if (_checkInError != null) {
      return LiveSessionPhase.error;
    }
    if (!_canCheckIn) {
      return LiveSessionPhase.idle;
    }
    if (_isCheckingIn) {
      return LiveSessionPhase.reviewing;
    }
    if (_hasFreshSuccess) {
      return LiveSessionPhase.completed;
    }
    if (!_blePermissionGranted ||
        !_bluetoothReady ||
        _detectedBleToken == null) {
      return LiveSessionPhase.preparing;
    }
    return LiveSessionPhase.active;
  }

  String get _phaseLabel {
    return switch (_livePhase) {
      LiveSessionPhase.idle => 'Idle',
      LiveSessionPhase.preparing => 'Preparing',
      LiveSessionPhase.active => 'Signal live',
      LiveSessionPhase.reviewing => 'Submitting',
      LiveSessionPhase.completed => 'Recorded',
      LiveSessionPhase.error => 'Needs attention',
    };
  }

  String get _sessionMetricLabel => _canCheckIn ? 'Live' : 'Waiting';

  String get _bleMetricLabel {
    if (!_blePermissionGranted) {
      return 'Blocked';
    }
    if (!_bluetoothReady) {
      return 'Off';
    }
    if (_detectedBleToken != null) {
      return _signalLabel;
    }
    return 'Searching';
  }

  String get _nfcMetricLabel {
    if (!NfcService.isSupported) {
      return 'Unavailable';
    }
    return _nfcListening ? 'Ready' : 'Standby';
  }

  String get _bluetoothCapabilityBody {
    if (!_canCheckIn) {
      return CheckInStrings.normalDisabled;
    }
    if (!_blePermissionGranted) {
      return CheckInStrings.bluetoothPermissionBody;
    }
    if (!_bluetoothReady) {
      return CheckInStrings.bluetoothOffBody;
    }
    if (_detectedBleToken != null) {
      return CheckInStrings.stageDetectedBody;
    }
    return CheckInStrings.stageReadyBody;
  }

  String get _nfcCapabilityBody {
    if (!NfcService.isSupported) {
      return HomeStrings.nfcInfoBody;
    }
    if (_nfcListening) {
      return AuthStrings.collectingNfc;
    }
    return 'NFC tap will wake up automatically when a teacher token is available.';
  }

  String get _submissionCapabilityBody {
    if (_hasFreshSuccess) {
      return CheckInStrings.stageSuccessBody;
    }
    if (_isCheckingIn) {
      return CheckInStrings.stageCheckingInBody;
    }
    return 'Passkey and device binding will be verified when you submit the current signal.';
  }

  Color get _bluetoothCapabilityColor {
    if (!_blePermissionGranted) {
      return const Color(0xFFFF5B57);
    }
    if (!_bluetoothReady) {
      return const Color(0xFFF5A623);
    }
    if (_detectedBleToken != null) {
      return const Color(0xFF35C66B);
    }
    return const Color(0xFF4E8DFF);
  }

  Color get _nfcCapabilityColor {
    if (!NfcService.isSupported) {
      return const Color(0xFF8A94A6);
    }
    return _nfcListening ? const Color(0xFF35C66B) : const Color(0xFF4E8DFF);
  }

  Color get _submissionCapabilityColor {
    if (_checkInError != null) {
      return const Color(0xFFFF5B57);
    }
    if (_hasFreshSuccess) {
      return const Color(0xFF35C66B);
    }
    if (_isCheckingIn) {
      return const Color(0xFFF5A623);
    }
    return Colors.white70;
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
    if (_isCheckingIn) {
      return const Color(0xFF4AA4FF);
    }
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
    if (_isCheckingIn) {
      return 232;
    }
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
      CheckInSignalVisualState.checkingIn =>
        CheckInStrings.stageCheckingInTitle,
      CheckInSignalVisualState.success => CheckInStrings.stageSuccessTitle,
    };
  }

  String get _stageBody {
    if (_checkInError != null) {
      return _checkInError!;
    }
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
      CheckInSignalVisualState.checkingIn => CheckInStrings.stageCheckingInBody,
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
    if (_hasFreshSuccess) {
      await _performCheckIn(userId);
      return;
    }
    if (_detectedBleToken != null) {
      await _performCheckIn(userId);
    }
  }

  Future<void> _performCheckIn(String userId, {String? nfcToken}) async {
    if (_isCheckingIn) return;
    setState(() {
      _isCheckingIn = true;
      _checkInError = null;
    });

    try {
      final optionsJson = await AuthApi.checkInInitiate(userId);
      final sessionId = optionsJson['session_id'];
      if (sessionId is! String || sessionId.isEmpty) {
        throw Exception(AuthStrings.errorMissingSessionId);
      }

      final gpsPosition = await _collectGpsPosition();

      final rssiReadings = List<int>.from(_accumulatedRssiReadings);
      final bleToken = _detectedBleToken;

      final credentialJson = await passkey.checkIn(
        optionsJson,
        userId,
        sessionId,
        rssiReadings,
        bleToken: bleToken,
        gpsLatitude: gpsPosition?.latitude,
        gpsLongitude: gpsPosition?.longitude,
        gpsIsMock: gpsPosition?.isMocked,
        nfcToken: nfcToken,
      );

      final result = await AuthApi.checkInVerify(credentialJson);
      await SessionStore.saveLastCheckIn(
        status: result['status'] as String? ?? 'unknown',
        band: result['assurance_band_recorded'] as String? ?? 'unknown',
        score: result['assurance_score'] as int? ?? 0,
      );
      _accumulatedRssiReadings.clear();
      await _loadLastCheckIn();
      unawaited(submitPlayIntegrityVouch());
    } on PasskeyAuthCancelledException {
      // User cancelled biometric — silently return to detected state
    } catch (e) {
      if (!mounted) return;
      setState(() => _checkInError = e.toString());
    } finally {
      if (mounted) setState(() => _isCheckingIn = false);
    }
  }

  Future<Position?> _collectGpsPosition() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 10));
    } catch (_) {
      return null;
    }
  }

  Future<void> _syncNfcListener() async {
    if (!widget.active || _selectedTab != 0 || !_canCheckIn) {
      _stopNfcListener();
      return;
    }
    if (_nfcListening) return;
    if (!NfcService.isSupported) return;
    final available = await NfcService.isAvailable();
    if (!available) return;
    _nfcListening = true;
    _listenForNfc();
  }

  Future<void> _listenForNfc() async {
    while (_nfcListening && mounted) {
      try {
        final token = await NfcService.readToken();
        if (!_nfcListening || !mounted) break;
        if (token != null && token.isNotEmpty) {
          final userId = await SessionStore.getUserId();
          if (userId != null && userId.isNotEmpty && _canCheckIn) {
            await _performCheckIn(userId, nfcToken: token);
          }
        }
      } catch (_) {
        if (!_nfcListening || !mounted) break;
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
  }

  void _stopNfcListener() {
    _nfcListening = false;
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
    final canTap =
        !_isCheckingIn &&
        (_hasFreshSuccess ||
            _detectedBleToken != null ||
            (_canCheckIn && _blePermissionGranted && !_bluetoothReady) ||
            (_canCheckIn && !_blePermissionGranted));
    const surfaceColor = Color(0xFF0D0D0D);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      children: [
        Text(
          HomeStrings.userId(userId),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.white.withValues(alpha: 0.54),
          ),
        ),
        const SizedBox(height: 12),
        LiveSessionHeroCard(
          phase: _livePhase,
          phaseLabel: _phaseLabel,
          title: _stageTitle,
          body: _stageBody,
          backgroundColor: surfaceColor,
          foregroundColor: Colors.white,
          metrics: [
            LiveSessionMetricItem(
              label: 'Session',
              value: _sessionMetricLabel,
              icon: Icons.event_available_rounded,
            ),
            LiveSessionMetricItem(
              label: 'BLE',
              value: _bleMetricLabel,
              icon: Icons.bluetooth_searching_rounded,
            ),
            LiveSessionMetricItem(
              label: 'NFC',
              value: _nfcMetricLabel,
              icon: Icons.nfc_rounded,
            ),
          ],
          visual: SizedBox(
            width: double.infinity,
            height: 300,
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
                            Theme.of(context).textTheme.headlineSmall,
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
                              Theme.of(context).textTheme.labelLarge,
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
        const SizedBox(height: 12),
        LiveSessionSectionCard(
          title: 'Readiness',
          subtitle: _canCheckIn
              ? CheckInStrings.normalBody
              : CheckInStrings.normalDisabled,
          backgroundColor: surfaceColor,
          foregroundColor: Colors.white,
          child: Column(
            children: [
              LiveSessionCapabilityTile(
                icon: Icons.bluetooth_searching_rounded,
                title: 'Bluetooth',
                body: _bluetoothCapabilityBody,
                statusLabel: _bleMetricLabel,
                statusColor: _bluetoothCapabilityColor,
                foregroundColor: Colors.white,
              ),
              const SizedBox(height: 14),
              LiveSessionCapabilityTile(
                icon: Icons.nfc_rounded,
                title: 'NFC tap',
                body: _nfcCapabilityBody,
                statusLabel: _nfcMetricLabel,
                statusColor: _nfcCapabilityColor,
                foregroundColor: Colors.white,
              ),
              const SizedBox(height: 14),
              LiveSessionCapabilityTile(
                icon: Icons.verified_user_outlined,
                title: 'Submission',
                body: _submissionCapabilityBody,
                statusLabel: _hasFreshSuccess
                    ? 'Recorded'
                    : (_isCheckingIn ? 'Running' : 'Passkey'),
                statusColor: _submissionCapabilityColor,
                foregroundColor: Colors.white,
              ),
            ],
          ),
        ),
      ],
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
