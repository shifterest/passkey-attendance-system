import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/auth_scaffold.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: LoginStrings.appTitle,
      body: SizedBox(
        width: min(MediaQuery.of(context).size.width, 360),
        child: FutureBuilder<String?>(
          future: SessionStore.getUserId(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final userId = snapshot.data;
            final isRegistered = userId != null && userId.isNotEmpty;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  isRegistered
                      ? LoginStrings.subtitleRegistered
                      : LoginStrings.subtitleUnregistered,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                if (isRegistered) ...[
                  FilledButton.icon(
                    onPressed: () {
                      context.push(
                        '/authenticate?user_id=${Uri.encodeComponent(userId)}&login=true',
                      );
                    },
                    icon: const Icon(Icons.key_rounded),
                    label: const Text(LoginStrings.buttonLoginPasskey),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      context.push('/web-login-scan');
                    },
                    icon: const Icon(Icons.qr_code_scanner_rounded),
                    label: const Text(LoginStrings.buttonLoginWebQr),
                  ),
                ] else ...[
                  FilledButton.icon(
                    onPressed: () {
                      context.push('/scan');
                    },
                    icon: const Icon(Icons.app_registration_rounded),
                    label: const Text(LoginStrings.buttonRegisterPasskey),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
