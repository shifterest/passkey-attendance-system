import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;

class AuthenticationScreen extends StatefulWidget {
  const AuthenticationScreen({
    super.key,
    required this.userId,
    this.login = false,
  });

  final String userId;
  final bool login;

  @override
  State<AuthenticationScreen> createState() => _AuthenticationScreenState();
}

Future<void> _showErrorDialog(BuildContext context, String? error) {
  return showDialog<void>(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: const Text('Error'),
        content: Text(
          'Something went wrong during authentication. Please try again.'
          '\n\n$error',
        ),
        actions: <Widget>[
          TextButton(
            style: TextButton.styleFrom(
              textStyle: Theme.of(context).textTheme.labelLarge,
            ),
            child: const Text('Return'),
            onPressed: () {
              Navigator.of(context).pop();
              GoRouter.of(context).go('/');
            },
          ),
        ],
      );
    },
  );
}

Future<bool> _showBluetoothDialog(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (BuildContext context) {
          return AlertDialog(
            title: const Text('Bluetooth required'),
            content: Text(
              'Bluetooth is currently turned off. You can\'t check in without it.',
            ),
            actions: <Widget>[
              TextButton(
                style: TextButton.styleFrom(
                  textStyle: Theme.of(context).textTheme.labelLarge,
                ),
                child: const Text('Cancel'),
                onPressed: () {
                  Navigator.of(context).pop(false);
                },
              ),
              TextButton(
                style: TextButton.styleFrom(
                  textStyle: Theme.of(context).textTheme.labelLarge,
                ),
                child: const Text('Enable Bluetooth'),
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
  bool _isAuthenticating = false;
  String _status = '';
  String? _error;

  Future<int> _collectStrongestRssi() async {
    if (!await FlutterBluePlus.isSupported) {
      throw Exception('Bluetooth is not supported on this device');
    }

    var adapterState = await FlutterBluePlus.adapterState.first;
    if (adapterState != BluetoothAdapterState.on) {
      if (!kIsWeb && Platform.isAndroid) {
        final shouldEnableBluetooth = mounted
            ? await _showBluetoothDialog(context)
            : false;
        if (!shouldEnableBluetooth) {
          throw Exception(
            'Bluetooth must be turned on for attendance check-in',
          );
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
        throw Exception('Bluetooth must be turned on for attendance check-in');
      }
    }

    int? strongestRssi;
    final subscription = FlutterBluePlus.scanResults.listen((results) {
      for (final result in results) {
        if (strongestRssi == null || result.rssi > strongestRssi!) {
          strongestRssi = result.rssi;
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

    if (strongestRssi == null) {
      throw Exception('No BLE proximity signal detected');
    }

    return strongestRssi!;
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
        _status = widget.login ? 'Logging in...' : 'Checking in...';
      });

      await _authenticate();
      if (!mounted) return;

      if (widget.login) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() => _error = e.toString());

      if (_error != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) async {
          await _showErrorDialog(context, _error);
        });
      }
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  Future<bool> _authenticate() async {
    setState(() {
      _status =
          'Initiating ${widget.login ? 'login' : 'check-in'} with server...';
    });

    Map<String, dynamic> optionsJson;
    if (widget.login) {
      optionsJson = await AuthApi.loginOptions(widget.userId);
    } else {
      optionsJson = await AuthApi.checkInOptions(widget.userId);
    }

    Map<String, dynamic> credentialJson;
    if (widget.login) {
      credentialJson = await passkey.login(optionsJson, widget.userId);
    } else {
      final sessionId = optionsJson['session_id'];
      if (sessionId is! String || sessionId.isEmpty) {
        throw Exception('Missing session ID in check-in options');
      }

      setState(() {
        _status = 'Collecting BLE proximity signal...';
      });
      final bluetoothRssi = await _collectStrongestRssi();

      credentialJson = await passkey.checkIn(
        optionsJson,
        widget.userId,
        sessionId,
        bluetoothRssi,
      );
    }

    setState(() {
      _status = 'Verifying passkey with server...';
    });

    if (widget.login) {
      await AuthApi.loginVerify(credentialJson);
    } else {
      await AuthApi.checkInVerify(credentialJson);
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return (_isAuthenticating
        ? Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                spacing: 8,
                children: [
                  CircularProgressIndicator(),
                  Text(
                    _status,
                    style: Theme.of(context).textTheme.bodyLarge,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          )
        : const Scaffold(body: SizedBox.shrink()));
  }
}
