import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:passkey_attendance_system/services/session_api.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';

class TeacherOfflineScannerScreen extends StatefulWidget {
  const TeacherOfflineScannerScreen({
    super.key,
    required this.sessionId,
    required this.nonce,
    required this.classId,
  });

  final String sessionId;
  final String nonce;
  final String classId;

  @override
  State<TeacherOfflineScannerScreen> createState() =>
      _TeacherOfflineScannerScreenState();
}

class _TeacherOfflineScannerScreenState
    extends State<TeacherOfflineScannerScreen> {
  final List<Map<String, dynamic>> _scannedRecords = [];
  final Set<String> _seenUsers = {};
  bool _submitting = false;
  bool _scannerActive = true;

  void _onDetect(BarcodeCapture capture) {
    if (!_scannerActive) return;

    for (final barcode in capture.barcodes) {
      final rawValue = barcode.rawValue;
      if (rawValue == null) continue;

      try {
        final data = jsonDecode(rawValue) as Map<String, dynamic>;

        final userId = data['user_id'] as String?;
        final challenge = data['challenge'] as String?;
        final issuedAtMs = data['issued_at_ms'] as int?;

        if (userId == null || challenge == null || issuedAtMs == null) continue;

        if (challenge != widget.nonce) continue;

        final issuedAt = DateTime.fromMillisecondsSinceEpoch(issuedAtMs);
        final age = DateTime.now().difference(issuedAt).inSeconds;
        if (age > 60 || age < -5) continue;

        if (_seenUsers.contains(userId)) continue;

        _seenUsers.add(userId);
        setState(() => _scannedRecords.add(data));

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${OfflineStrings.scanned}: $userId'),
            duration: const Duration(seconds: 1),
          ),
        );
      } catch (_) {}
    }
  }

  Future<void> _submit() async {
    if (_scannedRecords.isEmpty || _submitting) return;

    setState(() {
      _submitting = true;
      _scannerActive = false;
    });

    try {
      await SessionApi.offlineSync(
        classId: widget.classId,
        sessionId: widget.sessionId,
        nonceSet: [widget.nonce],
        records: _scannedRecords,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${OfflineStrings.syncSuccess} (${_scannedRecords.length})',
          ),
        ),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _scannerActive = true);
      await showErrorDialog(
        context,
        e.toString(),
        body: OfflineStrings.errorSyncing,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(OfflineStrings.scannerTitle),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '${_scannedRecords.length}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 3,
            child: _scannerActive
                ? MobileScanner(onDetect: _onDetect)
                : const Center(
                    child: Icon(
                      Icons.pause_circle,
                      size: 48,
                      color: Colors.grey,
                    ),
                  ),
          ),
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${OfflineStrings.scannedStudents}: ${_scannedRecords.length}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: ListView.builder(
                      itemCount: _scannedRecords.length,
                      itemBuilder: (context, index) {
                        final record = _scannedRecords[index];
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.person, size: 20),
                          title: Text(
                            record['user_id'] as String? ?? 'Unknown',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _scannedRecords.isEmpty || _submitting
                          ? null
                          : _submit,
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.cloud_upload),
                      label: Text(
                        _submitting
                            ? OfflineStrings.syncing
                            : OfflineStrings.submitSync,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
