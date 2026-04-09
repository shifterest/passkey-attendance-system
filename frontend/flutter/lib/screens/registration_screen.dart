import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/passkey.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/auth_scaffold.dart';

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

      context.go('/');
    } on PasskeyRegistrationCancelledException {
      if (!mounted) return;
      context.go('/');
    } catch (e) {
      if (!mounted) return;

      setState(() => _error = e.toString());
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
    if (_isRegistering) {
      return AuthScaffold(
        title: RegistrationStrings.title,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              RegistrationStrings.subtitle,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 24),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 3),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _status,
                      style: Theme.of(context).textTheme.titleMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.go('/'),
              child: const Text(RegistrationStrings.cancel),
            ),
          ],
        ),
      );
    }

    return AuthScaffold(
      title: RegistrationStrings.title,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            RegistrationStrings.errorBody,
            style: Theme.of(context).textTheme.bodyLarge,
            textAlign: TextAlign.left,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _startRegistration,
            child: const Text(RegistrationStrings.retry),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => context.go('/'),
            child: const Text(RegistrationStrings.returnToLogin),
          ),
        ],
      ),
    );
  }
}
