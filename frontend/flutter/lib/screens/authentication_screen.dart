import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/auth_api.dart';
import 'package:passkey_attendance_system/services/passkey.dart' as passkey;
import 'package:passkey_attendance_system/services/passkey.dart';
import 'package:passkey_attendance_system/services/play_integrity_service.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/bottom_heavy_state.dart';

class AuthenticationScreen extends StatefulWidget {
  const AuthenticationScreen({
    super.key,
    required this.userId,
    this.login = false,
    this.webLoginToken,
  });

  final String userId;
  final bool login;
  final String? webLoginToken;

  @override
  State<AuthenticationScreen> createState() => _AuthenticationScreenState();
}

class _AuthenticationScreenState extends State<AuthenticationScreen> {
  bool _isAuthenticating = false;
  String _status = '';
  String? _error;

  Future<void> _handleCancellation() async {
    if (!mounted) return;
    context.go('/');
  }

  @override
  void initState() {
    super.initState();
    _startAuthentication();
  }

  Future<void> _startAuthentication() async {
    setState(() {
      _isAuthenticating = true;
      _error = null;
    });

    try {
      setState(() {
        _status = AuthStrings.loggingIn;
      });

      await _authenticate();
      if (!mounted) return;

      context.go('/');
    } on PasskeyAuthCancelledException {
      await _handleCancellation();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isAuthenticating = false);
    }
  }

  Future<void> _authenticate() async {
    setState(() {
      _status = AuthStrings.initiatingLogin;
    });

    final optionsJson = await AuthApi.loginOptions(widget.userId);
    final credentialJson = await passkey.login(optionsJson, widget.userId);

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
    } else {
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
    }
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
            onPressed: () => context.go('/'),
            child: const Text(AuthStrings.returnToLogin),
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    return const Scaffold(body: SizedBox.shrink());
  }
}
