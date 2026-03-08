import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/session_store.dart';

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

class _AuthenticationScreenState extends State<AuthenticationScreen> {
  bool _isAuthenticating = false;
  String _status = '';
  String? _error;

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
        _status = widget.login ? 'Logging in...' : 'Authenticating...';
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
          'Initiating ${widget.login ? 'login' : 'authentication'} with server...';
    });

    dynamic optionsJson;
    if (widget.login) {
      optionsJson = await AuthApi.loginOptions(widget.userId);
    } else {
      optionsJson = await AuthApi.authenticateOptions(widget.userId);
    }

    // TODO: Will need this later
    final deviceId = await SessionStore.getDeviceId();
    final credentialJson = await passkey.login(optionsJson, widget.userId);

    setState(() {
      _status = 'Verifying passkey with server...';
    });

    if (widget.login) {
      await AuthApi.loginVerify(credentialJson);
    } else {
      await AuthApi.authenticateVerify(credentialJson);
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
