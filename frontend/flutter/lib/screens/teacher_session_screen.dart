import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/nfc_hce_service.dart';
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
  String? _nfcToken;
  bool _nfcEnabled = false;
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
    NfcHceService.stop();
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

  Future<void> _fetchNfcToken() async {
    try {
      final data = await SessionApi.getNfcToken(widget.sessionId);
      final token = data['nfc_token'];
      if (token is String && mounted) {
        setState(() => _nfcToken = token);
        if (_nfcEnabled) {
          await NfcHceService.start(token);
        }
      }
    } catch (_) {}
  }

  Future<void> _toggleNfc(bool enabled) async {
    if (!NfcHceService.isSupported) return;
    setState(() => _nfcEnabled = enabled);
    if (enabled) {
      if (_nfcToken == null) {
        await _fetchNfcToken();
      } else {
        await NfcHceService.start(_nfcToken!);
      }
    } else {
      await NfcHceService.stop();
    }
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
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontFamily: 'monospace'),
            ),
            const SizedBox(height: 24),
            if (NfcHceService.isSupported) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    TeacherStrings.nfcEnabled,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  Switch(
                    value: _nfcEnabled,
                    onChanged: _isClosed ? null : _toggleNfc,
                  ),
                ],
              ),
              if (_nfcEnabled) ...[
                const SizedBox(height: 4),
                Text(
                  TeacherStrings.nfcToken,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  _nfcToken ?? TeacherStrings.loadingToken,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontFamily: 'monospace'),
                ),
              ],
              const SizedBox(height: 24),
            ],
            const SizedBox(height: 24),
            Text(
              '${TeacherStrings.checkedIn}: $_checkInCount',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  context.push('/teacher/session/${widget.sessionId}/roster');
                },
                icon: const Icon(Icons.list_alt),
                label: const Text('View Roster'),
              ),
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
