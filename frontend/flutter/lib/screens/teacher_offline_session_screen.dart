import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/services/ble_advertiser_service.dart';
import 'package:passkey_attendance_system/services/class_cache_service.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/error_dialog.dart';
import 'package:passkey_attendance_system/widgets/live_session_surface.dart';
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

  LiveSessionPhase get _livePhase {
    if (_advertising) {
      return LiveSessionPhase.active;
    }
    if (_cachedClasses.isEmpty) {
      return LiveSessionPhase.error;
    }
    if (_selectedClass != null) {
      return LiveSessionPhase.preparing;
    }
    return LiveSessionPhase.idle;
  }

  String get _phaseLabel {
    return switch (_livePhase) {
      LiveSessionPhase.idle => 'Idle',
      LiveSessionPhase.preparing => 'Ready',
      LiveSessionPhase.active => 'Broadcasting',
      LiveSessionPhase.reviewing => 'Reviewing',
      LiveSessionPhase.completed => 'Done',
      LiveSessionPhase.error => 'Needs cache',
    };
  }

  String get _selectedClassLabel => _selectedClass ?? 'Not selected';

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

  Future<void> _loadCachedClasses() async {
    final classes = await ClassCacheService.getCachedClasses();
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
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text(OfflineStrings.teacherSessionTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          LiveSessionHeroCard(
            phase: _livePhase,
            phaseLabel: _phaseLabel,
            title: OfflineStrings.hostTitle,
            body: _advertising
                ? OfflineStrings.hostActiveBody
                : (_selectedClass == null
                      ? OfflineStrings.hostWaiting
                      : OfflineStrings.hostBody),
            backgroundColor: colorScheme.primaryContainer,
            foregroundColor: colorScheme.onPrimaryContainer,
            metrics: [
              LiveSessionMetricItem(
                label: 'Cached classes',
                value: '${_cachedClasses.length}',
                icon: Icons.class_outlined,
              ),
              LiveSessionMetricItem(
                label: 'Selected',
                value: _selectedClass == null ? 'None' : 'Ready',
                icon: Icons.checklist_rounded,
              ),
              LiveSessionMetricItem(
                label: 'Broadcast',
                value: _advertising ? 'Live' : 'Stopped',
                icon: Icons.bluetooth_searching_rounded,
              ),
            ],
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: 'Class selection',
            subtitle: OfflineStrings.selectClass,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LiveSessionCapabilityTile(
                  icon: Icons.class_outlined,
                  title: 'Cached schedule',
                  body: _cachedClasses.isEmpty
                      ? OfflineStrings.noClassesCached
                      : 'Select the cached class that should own this offline attendance window.',
                  statusLabel: _cachedClasses.isEmpty
                      ? 'Empty'
                      : '${_cachedClasses.length}',
                  statusColor: _cachedClasses.isEmpty
                      ? const Color(0xFFF5A623)
                      : colorScheme.primary,
                ),
                const SizedBox(height: 14),
                if (_cachedClasses.isEmpty)
                  const Text(OfflineStrings.noClassesCached)
                else
                  DropdownButtonFormField<String>(
                    initialValue: _selectedClass,
                    hint: const Text(OfflineStrings.chooseClass),
                    items: _cachedClasses
                        .map((c) {
                          return DropdownMenuItem<String>(
                            value: c,
                            child: Text(c),
                          );
                        })
                        .toList(growable: false),
                    onChanged: _advertising
                        ? null
                        : (value) {
                            setState(() {
                              _selectedClass = value;
                            });
                          },
                  ),
                const SizedBox(height: 12),
                Text(
                  'Current selection: $_selectedClassLabel',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LiveSessionSectionCard(
            title: 'Offline host actions',
            subtitle: OfflineStrings.hostBody,
            child: Column(
              children: [
                LiveSessionCapabilityTile(
                  icon: Icons.bluetooth_connected_rounded,
                  title: 'Teacher broadcast',
                  body: _advertising
                      ? '${OfflineStrings.advertising} ${OfflineStrings.sessionId}: ${_sessionId!.substring(0, 8)}...'
                      : OfflineStrings.hostWaiting,
                  statusLabel: _advertising ? 'Live' : 'Stopped',
                  statusColor: _advertising
                      ? const Color(0xFF35C66B)
                      : const Color(0xFFF5A623),
                ),
                const SizedBox(height: 14),
                LiveSessionCapabilityTile(
                  icon: Icons.qr_code_scanner_rounded,
                  title: 'Teacher scanner handoff',
                  body: _advertising
                      ? 'Once broadcasting is live, switch to the scanner to collect student QR payloads.'
                      : 'The scanner becomes useful after you start broadcasting a nonce.',
                  statusLabel: _advertising ? 'Ready' : 'Waiting',
                  statusColor: _advertising
                      ? colorScheme.primary
                      : colorScheme.outline,
                ),
                const SizedBox(height: 16),
                if (!_advertising)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _selectedClass == null ? null : _startSession,
                      icon: const Icon(Icons.bluetooth),
                      label: const Text(OfflineStrings.startOfflineSession),
                    ),
                  )
                else ...[
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
              ],
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
            child: const Text(OfflineStrings.back),
          ),
        ],
      ),
    );
  }
}
