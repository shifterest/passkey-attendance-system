import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/screens/login_screen.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/session_store.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.userId, this.registrationToken});

  final String? userId;
  final String? registrationToken;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

Future<void> _errorDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: const Text('Error'),
        content: const Text(
          'Something went wrong during registration.\n'
          'Please try again.',
        ),
        actions: <Widget>[
          TextButton(
            style: TextButton.styleFrom(
              textStyle: Theme.of(context).textTheme.labelLarge,
            ),
            child: const Text('OK'),
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      );
    },
  );
}

class _RegisterScreenState extends State<RegisterScreen> {
  bool _isLoading = false;
  bool _started = false;
  bool _isBusy = false;
  String? _error;
  MobileScannerController qrController = MobileScannerController(
    torchEnabled: false,
  );

  @override
  void initState() {
    super.initState();
    final hasParams =
        (widget.userId?.isNotEmpty ?? false) &&
        (widget.registrationToken?.isNotEmpty ?? false);

    if (hasParams) {
      _startRegistration();
    }
  }

  @override
  void dispose() {
    qrController.dispose();
    super.dispose();
  }

  Future<void> _startRegistration() async {
    if (_started) return;
    _started = true;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await _register();
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      if (_error != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) async {
          await _errorDialog(context);
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<bool> _register() async {
    final optionsJson = await AuthApi.registerOptions(
      widget.userId!,
      widget.registrationToken!,
    );

    // Create passkey
    final deviceId = await SessionStore.getDeviceId();
    final credentialJson = await passkey.register(
      optionsJson,
      widget.userId!,
      widget.registrationToken,
      deviceId,
    );

    // User is registered, FINALLY 🎉
    await AuthApi.registerVerify(credentialJson);
    await SessionStore.saveUserId(widget.userId!);
    return true;
  }

  // QR code scanner
  Widget _qrCodeScanner() {
    return Scaffold(
      body: Center(
        child: Container(
          color: Colors.black,
          child: SizedBox.square(
            dimension:
                min(
                  MediaQuery.of(context).size.width,
                  MediaQuery.of(context).size.height,
                ) *
                0.8,
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
              ),
              child: MobileScanner(
                controller: qrController,
                onDetect: (result) {
                  // Avoid processing scans in parallel
                  if (_isBusy) return;
                  _isBusy = true;

                  try {
                    List<Barcode> barcodeList = result.barcodes;
                    if (barcodeList.isEmpty) {
                      return;
                    }

                    final url = barcodeList.first.rawValue;
                    if (url != null && mounted) {
                      final uri = Uri.parse(url);

                      if (uri.scheme != 'shifterest-pas' ||
                          uri.host != 'register') {
                        GoRouter.of(context).go('/');
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Invalid registration QR code'),
                          ),
                        );
                        return;
                      }

                      final token = uri.queryParameters['token'];
                      final userId = uri.queryParameters['user_id'];

                      if (token == null || userId == null) {
                        GoRouter.of(context).go('/');
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Missing registration data'),
                          ),
                        );
                        return;
                      }

                      GoRouter.of(context).go(
                        '/register?token=${Uri.encodeComponent(token)}&user_id=${Uri.encodeComponent(userId)}',
                      );
                    }
                  } catch (e) {
                    GoRouter.of(context).go('/');
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('An error occurred')),
                    );
                  } finally {
                    _isBusy = false;
                  }
                },
              ),
            ),
          ),
        ),
      ),
      // Flashlight toggle
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.flashlight_on),
        onPressed: () async {
          await qrController.toggleTorch();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasParams =
        (widget.userId?.isNotEmpty ?? false) &&
        (widget.registrationToken?.isNotEmpty ?? false);

    return hasParams
        ? (_isLoading
              ? const Scaffold(body: Center(child: CircularProgressIndicator()))
              : const Scaffold(body: SizedBox.shrink()))
        : _qrCodeScanner();
  }
}
