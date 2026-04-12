import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/passkey.dart';
import 'package:passkey_attendance_system/services/play_integrity_service.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/bottom_heavy_state.dart';
import 'package:permission_handler/permission_handler.dart';

class AuthenticationScreen extends StatefulWidget {
  const AuthenticationScreen({
    super.key,
    required this.userId,
    this.login = false,
    this.webLoginToken,
    this.nfcToken,
  });

  final String userId;
  final bool login;
  final String? webLoginToken;
  final String? nfcToken;

  @override
  State<AuthenticationScreen> createState() => _AuthenticationScreenState();
}

Future<bool> _showBluetoothDialog(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (BuildContext context) {
          return AlertDialog(
            title: const Text(AuthStrings.bleDialogTitle),
            content: Text(AuthStrings.bleDialogBody),
            actions: <Widget>[
              TextButton(
                style: TextButton.styleFrom(
                  textStyle: Theme.of(context).textTheme.labelLarge,
                ),
                child: const Text(AuthStrings.bleDialogCancel),
                onPressed: () {
                  Navigator.of(context).pop(false);
                },
              ),
              TextButton(
                style: TextButton.styleFrom(
                  textStyle: Theme.of(context).textTheme.labelLarge,
                ),
                child: const Text(AuthStrings.bleDialogEnable),
                onPressed: () {
                  Navigator.of(context).pop(true);
                },
              ),
            ],
          );
        },
      ) ??
      false;
}

class _AuthenticationScreenState extends State<AuthenticationScreen> {
  static final _teacherServiceGuid =
      Guid('0000fff0-0000-1000-8000-00805f9b34fb');
  bool _isAuthenticating = false;
  String _status = '';
  String? _error;
  Map<String, dynamic>? _checkInRecord;

  Future<void> _handleCancellation() async {
    if (!mounted) return;
    if (widget.login || widget.webLoginToken != null) {
      context.go('/');
      return;
    }
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Future<({List<int> rssiReadings, String? bleToken})>
  _collectBleProximity() async {
    if (!kIsWeb && Platform.isAndroid) {
      final statuses = await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
      ].request();
      if (statuses[Permission.bluetoothScan] != PermissionStatus.granted ||
          statuses[Permission.bluetoothConnect] != PermissionStatus.granted) {
        throw Exception(AuthStrings.errorBlePermissions);
      }
    }

    if (!await FlutterBluePlus.isSupported) {
      throw Exception(AuthStrings.errorBleNotSupported);
    }

    var adapterState = await FlutterBluePlus.adapterState.first;
    if (adapterState != BluetoothAdapterState.on) {
      if (!kIsWeb && Platform.isAndroid) {
        final shouldEnableBluetooth = mounted
            ? await _showBluetoothDialog(context)
            : false;
        if (!shouldEnableBluetooth) {
          throw Exception(AuthStrings.errorBleMustBeOn);
        }

        await FlutterBluePlus.turnOn();
        adapterState = await FlutterBluePlus.adapterState
            .where((s) => s == BluetoothAdapterState.on)
            .first
            .timeout(
              const Duration(seconds: 10),
              onTimeout: () => BluetoothAdapterState.off,
            );
      }
      if (adapterState != BluetoothAdapterState.on) {
        throw Exception(AuthStrings.errorBleMustBeOn);
      }
    }

    int? strongestRssi;
    String? bleToken;
    final readingsByToken = <String, List<int>>{};
    final subscription = FlutterBluePlus.scanResults.listen((results) {
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
        readingsByToken.putIfAbsent(token, () => <int>[]).add(result.rssi);
        if (strongestRssi == null || result.rssi > strongestRssi!) {
          strongestRssi = result.rssi;
          bleToken = token;
        }
      }
    });

    try {
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 30));
      await FlutterBluePlus.isScanning.where((value) => !value).first;
    } finally {
      await FlutterBluePlus.stopScan();
      await subscription.cancel();
    }

    final rssiReadings = bleToken == null
        ? <int>[]
        : (readingsByToken[bleToken] ?? <int>[]);

    if (rssiReadings.isEmpty) {
      throw Exception(AuthStrings.errorNoBleSignal);
    }

    return (rssiReadings: rssiReadings, bleToken: bleToken);
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

  @override
  void initState() {
    super.initState();
    _startAuthentication();
  }

  Future<void> _startAuthentication() async {
    setState(() {
      _isAuthenticating = true;
    });

    try {
      setState(() {
        _status = (widget.webLoginToken != null || widget.login)
            ? AuthStrings.loggingIn
            : AuthStrings.checkingIn;
      });

      await _authenticate();
      if (!mounted) return;

      if (widget.webLoginToken != null || widget.login) {
        context.go('/');
      } else {
        context.pushReplacement('/check-in-result', extra: _checkInRecord);
      }
    } on PasskeyAuthCancelledException {
      await _handleCancellation();
    } catch (e) {
      if (!mounted) return;

      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  Future<bool> _authenticate() async {
    setState(() {
      _status = (widget.webLoginToken != null || widget.login)
          ? AuthStrings.initiatingLogin
          : AuthStrings.initiatingCheckIn;
    });

    Map<String, dynamic> optionsJson;
    if (widget.webLoginToken != null || widget.login) {
      optionsJson = await AuthApi.loginOptions(widget.userId);
    } else {
      optionsJson = await AuthApi.checkInOptions(widget.userId);
    }

    Map<String, dynamic> credentialJson;
    if (widget.webLoginToken != null || widget.login) {
      credentialJson = await passkey.login(optionsJson, widget.userId);
    } else {
      final sessionId = optionsJson['session_id'];
      if (sessionId is! String || sessionId.isEmpty) {
        throw Exception(AuthStrings.errorMissingSessionId);
      }

      setState(() {
        _status = AuthStrings.collectingBle;
      });
      final bleResult = await _collectBleProximity();

      setState(() {
        _status = AuthStrings.collectingGps;
      });
      final gpsPosition = await _collectGpsPosition();

      credentialJson = await passkey.checkIn(
        optionsJson,
        widget.userId,
        sessionId,
        bleResult.rssiReadings,
        bleToken: bleResult.bleToken,
        gpsLatitude: gpsPosition?.latitude,
        gpsLongitude: gpsPosition?.longitude,
        gpsIsMock: gpsPosition?.isMocked,
        nfcToken: widget.nfcToken,
      );
    }

    setState(() {
      _status = AuthStrings.verifyingPasskey;
    });

    if (widget.webLoginToken != null) {
      final webLoginResponse = await AuthApi.webLoginVerify({
        ...credentialJson,
        'web_login_token': widget.webLoginToken!,
      });
      final sessionToken = webLoginResponse['session_token'];
      final expiresIn = webLoginResponse['expires_in'];
      final role = webLoginResponse['role'];
      if (sessionToken is String &&
          sessionToken.isNotEmpty &&
          expiresIn is int) {
        await SessionStore.saveSession(widget.userId, sessionToken, expiresIn);
        if (role is String) await SessionStore.saveRole(role);
      }
      unawaited(submitPlayIntegrityVouch());
    } else if (widget.login) {
      final loginResponse = await AuthApi.loginVerify(credentialJson);
      final sessionToken = loginResponse['session_token'];
      final expiresIn = loginResponse['expires_in'];
      final role = loginResponse['role'];
      if (sessionToken is! String || sessionToken.isEmpty) {
        throw Exception(AuthStrings.errorMissingSessionToken);
      }
      if (expiresIn is! int) {
        throw Exception(AuthStrings.errorMissingSessionExpiry);
      }
      await SessionStore.saveSession(widget.userId, sessionToken, expiresIn);
      if (role is String) await SessionStore.saveRole(role);
      unawaited(submitPlayIntegrityVouch());
    } else {
      final result = await AuthApi.checkInVerify(credentialJson);
      _checkInRecord = result;
      await SessionStore.saveLastCheckIn(
        status: result['status'] as String? ?? 'unknown',
        band: result['assurance_band_recorded'] as String? ?? 'unknown',
        score: result['assurance_score'] as int? ?? 0,
      );
      unawaited(submitPlayIntegrityVouch());
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    if (_isAuthenticating) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            spacing: 8,
            children: [
              const CircularProgressIndicator(),
              Text(
                _status,
                style: Theme.of(context).textTheme.bodyLarge,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        body: BottomHeavyState(
          title: 'Authentication Error',
          message: AuthStrings.authErrorBody,
          detail: _error,
          icon: Icon(
            Icons.error_outline_rounded,
            size: 64,
            color: Theme.of(context).colorScheme.error,
          ),
          primaryAction: FilledButton(
            onPressed: _startAuthentication,
            child: const Text(AuthStrings.retry),
          ),
          secondaryAction: TextButton(
            onPressed: () {
              if (widget.login || widget.webLoginToken != null) {
                context.go('/');
                return;
              }
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
            child: Text(
              widget.login || widget.webLoginToken != null
                  ? AuthStrings.returnToLogin
                  : AuthStrings.returnToDashboard,
            ),
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    return const Scaffold(body: SizedBox.shrink());
  }
}
