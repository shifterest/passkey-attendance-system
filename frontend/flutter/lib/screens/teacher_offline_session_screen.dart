import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/ble_advertiser_service.dart';
import 'package:passkey_attendance_system/services/class_cache_service.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';
import 'package:uuid/uuid.dart';

class TeacherOfflineSessionScreen extends StatefulWidget {
  const TeacherOfflineSessionScreen({super.key});

  @override
  State<TeacherOfflineSessionScreen> createState() =>
      _TeacherOfflineSessionScreenState();
}

class _TeacherOfflineSessionScreenState
    extends State<TeacherOfflineSessionScreen> {
  List<String> _cachedClasses = [];
  String? _selectedClass;
  String? _sessionId;
  String? _nonce;
  bool _advertising = false;

  @override
  void initState() {
    super.initState();
    _loadCachedClasses();
  }

  @override
  void dispose() {
    if (_advertising) {
      BleAdvertiserService.stop();
    }
    super.dispose();
  }

  void _loadCachedClasses() {
    final classes = ClassCacheService.getCachedClasses();
    if (mounted) {
      setState(() => _cachedClasses = classes);
    }
  }

  Future<void> _startSession() async {
    if (_selectedClass == null) return;

    final sessionId = const Uuid().v4();
    final nonce = const Uuid().v4().replaceAll('-', '').substring(0, 16);

    try {
      await BleAdvertiserService.start(sessionId, nonce);
      if (mounted) {
        setState(() {
          _sessionId = sessionId;
          _nonce = nonce;
          _advertising = true;
        });
      }
    } catch (e) {
      if (!mounted) return;
      await showErrorDialog(
        context,
        e.toString(),
        body: OfflineStrings.errorStartingBle,
      );
    }
  }

  Future<void> _stopAdvertising() async {
    await BleAdvertiserService.stop();
    if (mounted) {
      setState(() => _advertising = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(OfflineStrings.teacherSessionTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              OfflineStrings.selectClass,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (_cachedClasses.isEmpty)
              const Text(OfflineStrings.noClassesCached)
            else
              DropdownButton<String>(
                isExpanded: true,
                value: _selectedClass,
                hint: const Text(OfflineStrings.chooseClass),
                items: _cachedClasses.map((c) {
                  return DropdownMenuItem<String>(value: c, child: Text(c));
                }).toList(),
                onChanged: _advertising
                    ? null
                    : (value) {
                        setState(() {
                          _selectedClass = value;
                        });
                      },
              ),
            const SizedBox(height: 24),
            if (!_advertising && _selectedClass != null)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _startSession,
                  icon: const Icon(Icons.bluetooth),
                  label: const Text(OfflineStrings.startOfflineSession),
                ),
              ),
            if (_advertising) ...[
              Row(
                children: [
                  const Icon(
                    Icons.bluetooth_connected,
                    color: Colors.blue,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    OfflineStrings.advertising,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '${OfflineStrings.sessionId}: ${_sessionId!.substring(0, 8)}...',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    context.push(
                      '/teacher/offline/scan',
                      extra: {
                        'session_id': _sessionId,
                        'nonce': _nonce,
                        'class_id': _selectedClass!,
                      },
                    );
                  },
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text(OfflineStrings.scanStudents),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _stopAdvertising,
                  icon: const Icon(Icons.stop),
                  label: const Text(OfflineStrings.stopAdvertising),
                ),
              ),
            ],
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/');
                  }
                },
                child: const Text(OfflineStrings.back),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
