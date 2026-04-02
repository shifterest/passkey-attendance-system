import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

class TeacherSessionScreen extends StatefulWidget {
  const TeacherSessionScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<TeacherSessionScreen> createState() => _TeacherSessionScreenState();
}

class _TeacherSessionScreenState extends State<TeacherSessionScreen> {
  String? _bleToken;
  int _checkInCount = 0;
  bool _isClosed = false;
  bool _isClosing = false;
  Timer? _bleRefreshTimer;
  Timer? _recordRefreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchBleToken();
    _fetchRecords();
    _bleRefreshTimer = Timer.periodic(
      const Duration(seconds: 25),
      (_) => _fetchBleToken(),
    );
    _recordRefreshTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _fetchRecords(),
    );
  }

  @override
  void dispose() {
    _bleRefreshTimer?.cancel();
    _recordRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchBleToken() async {
    try {
      final data = await SessionApi.getBleToken(widget.sessionId);
      final token = data['ble_token'];
      if (token is String && mounted) {
        setState(() => _bleToken = token);
      }
    } catch (_) {}
  }

  Future<void> _fetchRecords() async {
    try {
      final records = await SessionApi.getSessionRecords(widget.sessionId);
      if (mounted) {
        setState(() => _checkInCount = records.length);
      }
    } catch (_) {}
  }

  Future<void> _closeSession() async {
    if (_isClosing) return;
    setState(() => _isClosing = true);
    try {
      await SessionApi.closeSession(widget.sessionId);
      if (!mounted) return;
      setState(() => _isClosed = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(TeacherStrings.sessionClosed)),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: TeacherStrings.errorClosingSession,
      );
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(TeacherStrings.sessionScreen)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.circle,
                  color: _isClosed ? Colors.grey : Colors.green,
                  size: 12,
                ),
                const SizedBox(width: 8),
                Text(
                  _isClosed ? 'Closed' : TeacherStrings.sessionActive,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              TeacherStrings.bleToken,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 4),
            Text(
              _bleToken ?? TeacherStrings.loadingToken,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontFamily: 'monospace',
                  ),
            ),
            const SizedBox(height: 24),
            Text(
              '${TeacherStrings.checkedIn}: $_checkInCount',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const Spacer(),
            if (!_isClosed)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _isClosing ? null : _closeSession,
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.error,
                  ),
                  icon: _isClosing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.stop),
                  label: const Text(TeacherStrings.closeSession),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
