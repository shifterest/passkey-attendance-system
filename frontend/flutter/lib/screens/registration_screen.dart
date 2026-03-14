import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/session_store.dart';

class RegistrationScreen extends StatefulWidget {
  const RegistrationScreen({
    super.key,
    required this.userId,
    required this.registrationToken,
  });

  final String userId;
  final String registrationToken;

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

Future<void> _showErrorDialog(BuildContext context, String? error) {
  return showDialog<void>(
    context: context,
    builder: (BuildContext context) {
      return AlertDialog(
        title: const Text('Error'),
        content: Text(
          'Something went wrong during registration. Please try again.'
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

class _RegistrationScreenState extends State<RegistrationScreen> {
  bool _isRegistering = false;
  String _status = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _startRegistration();
  }

  Future<void> _startRegistration() async {
    setState(() {
      _isRegistering = true;
    });

    try {
      setState(() {
        _status = 'Registering...';
      });

      await _register();
      if (!mounted) return;

      // TODO: Add a router here or something, or not
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      if (!mounted) return;

      setState(() => _error = e.toString());

      if (_error != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) async {
          await _showErrorDialog(context, _error);
        });
      }
    } finally {
      if (mounted) setState(() => _isRegistering = false);
    }
  }

  Future<bool> _register() async {
    setState(() {
      _status = 'Initiating registration with server...';
    });

    final optionsJson = await AuthApi.registerOptions(
      widget.userId,
      widget.registrationToken,
    );

    setState(() {
      _status = 'Creating passkey...';
    });

    final credentialJson = await passkey.register(
      optionsJson,
      widget.userId,
      widget.registrationToken,
    );

    setState(() {
      _status = 'Verifying passkey with server...';
    });

    await AuthApi.registerVerify(credentialJson);
    await SessionStore.saveUserId(widget.userId);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return (_isRegistering
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
