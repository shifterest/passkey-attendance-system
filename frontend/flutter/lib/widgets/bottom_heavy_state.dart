import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';

class BottomHeavyState extends StatelessWidget {
  const BottomHeavyState({
    super.key,
    required this.title,
    this.message,
    this.detail,
    this.icon,
    this.primaryAction,
    this.secondaryAction,
    this.topAction,
    this.safeAreaTop = true,
    this.textAlign = TextAlign.left,
  });

  final String title;
  final String? message;
  final String? detail;
  final Widget? icon;
  final Widget? primaryAction;
  final Widget? secondaryAction;
  final Widget? topAction;
  final bool safeAreaTop;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      top: safeAreaTop,
      bottom: true,
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
                const Spacer(flex: 4),
                if (icon != null) ...[
                  Align(alignment: Alignment.center, child: icon),
                  const SizedBox(height: 20),
                ],
                Text(
                  title,
                  style: AppTheme.authTitle(theme.textTheme, theme.colorScheme),
                  textAlign: textAlign,
                ),
                if (message != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    message!,
                    style: theme.textTheme.bodyLarge,
                    textAlign: textAlign,
                  ),
                ],
                if (detail != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    detail!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    textAlign: textAlign,
                  ),
                ],
                const Spacer(flex: 2),
                if (primaryAction != null) primaryAction!,
                if (primaryAction != null && secondaryAction != null)
                  const SizedBox(height: 12),
                if (secondaryAction != null) secondaryAction!,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
