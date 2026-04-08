import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32.0),
          child: SizedBox(
            width: min(MediaQuery.of(context).size.width, 300),
            child: FutureBuilder<String?>(
              future: SessionStore.getUserId(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const CircularProgressIndicator();
                }

                final userId = snapshot.data;
                final bool isRegistered = userId != null;

                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Text(
                      LoginStrings.appTitle,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      LoginStrings.selectOptions,
                      style: Theme.of(context).textTheme.bodyLarge,
                      textAlign: TextAlign.left,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (isRegistered) ...[
                            FilledButton.icon(
                              onPressed: () {
                                context.push(
                                  '/authenticate?user_id=${Uri.encodeComponent(userId)}&login=true',
                                );
                              },
                              icon: const Icon(Icons.key),
                              label: const Text(
                                LoginStrings.buttonLoginPasskey,
                              ),
                            ),
                            ElevatedButton.icon(
                              onPressed: () {
                                context.push('/web-login-scan');
                              },
                              icon: const Icon(Icons.qr_code_scanner),
                              label: const Text(
                                LoginStrings.buttonLoginWebQr,
                              ),
                            ),
                          ] else ...[
                            FilledButton.icon(
                              onPressed: () {
                                context.push('/scan');
                              },
                              icon: const Icon(Icons.key),
                              label: const Text(
                                LoginStrings.buttonRegisterPasskey,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
