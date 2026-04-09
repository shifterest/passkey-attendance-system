import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';

class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    required this.body,
    this.topAction,
  });

  final String title;
  final Widget body;
  final Widget? topAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: SizedBox(height: 40, child: topAction),
                  ),
                  const Spacer(flex: 3),
                  Text(
                    title,
                    style: AppTheme.authTitle(
                      theme.textTheme,
                      theme.colorScheme,
                    ),
                  ),
                  const SizedBox(height: 16),
                  body,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
