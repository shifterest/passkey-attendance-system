import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/session_actions.dart';
import 'package:passkey_attendance_system/services/session_store.dart';
import 'package:passkey_attendance_system/strings.dart';

class StudentAccountActionButton extends StatefulWidget {
  const StudentAccountActionButton({super.key});

  @override
  State<StudentAccountActionButton> createState() =>
      _StudentAccountActionButtonState();
}

class _StudentAccountActionButtonState
    extends State<StudentAccountActionButton> {
  bool _isSigningOut = false;

  Future<void> _showAccountSheet() async {
    final userId = await SessionStore.getUserId();
    final deviceId = await SessionStore.getDeviceId();

    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  HomeStrings.accountSheetTitle,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  HomeStrings.accountSheetBody,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          HomeStrings.accountLabel,
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(HomeStrings.userId(userId ?? '—')),
                        const SizedBox(height: 4),
                        Text(
                          '${HomeStrings.deviceIdLabel}: ${deviceId.substring(0, 8)}...',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text(HomeStrings.settingsAction),
                  onTap: () {
                    context.pop();
                    this.context.push('/settings');
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.logout_rounded),
                  title: const Text(HomeStrings.signOutAction),
                  onTap: _isSigningOut
                      ? null
                      : () async {
                          Navigator.of(context).pop();
                          await _signOut();
                        },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _signOut() async {
    if (_isSigningOut) return;
    setState(() => _isSigningOut = true);
    try {
      await SessionActions.signOutCurrentUser();
      if (!mounted) return;
      GoRouter.of(context).go('/');
    } finally {
      if (mounted) {
        setState(() => _isSigningOut = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: _isSigningOut ? null : _showAccountSheet,
      icon: _isSigningOut
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.account_circle_outlined),
    );
  }
}
