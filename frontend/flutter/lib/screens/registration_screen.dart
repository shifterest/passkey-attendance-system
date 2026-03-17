import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/screens/home_screen.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

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
        _status = RegistrationStrings.registering;
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
          await showErrorDialog(
            context,
            _error,
            body: RegistrationStrings.errorBody,
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isRegistering = false);
    }
  }

  Future<bool> _register() async {
    setState(() {
      _status = RegistrationStrings.initiating;
    });

    final optionsJson = await AuthApi.registerOptions(
      widget.userId,
      widget.registrationToken,
    );

    setState(() {
      _status = RegistrationStrings.creatingPasskey;
    });

    final credentialJson = await passkey.register(
      optionsJson,
      widget.userId,
      widget.registrationToken,
    );

    setState(() {
      _status = RegistrationStrings.verifyingPasskey;
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
