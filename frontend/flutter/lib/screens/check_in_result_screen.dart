import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/strings.dart';

class CheckInResultScreen extends StatelessWidget {
  const CheckInResultScreen({super.key, required this.record});

  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context) {
    final status =
        record['status'] as String? ?? CheckInResultStrings.unknownStatus;
    final score = record['assurance_score'] as int? ?? 0;
    final band = record['assurance_band_recorded'] as String?;
    final standardThreshold =
        record['standard_threshold_recorded'] as int? ?? 5;
    final highThreshold = record['high_threshold_recorded'] as int? ?? 9;

    final statusLabel = switch (status) {
      'present' => CheckInResultStrings.present,
      'late' => CheckInResultStrings.late,
      'absent' => CheckInResultStrings.absent,
      _ => status,
    };

    final bandLabel = switch (band) {
      'high' => CheckInResultStrings.bandHigh,
      'standard' => CheckInResultStrings.bandStandard,
      _ =>
        score < standardThreshold
            ? CheckInResultStrings.bandLow
            : score >= highThreshold
            ? CheckInResultStrings.bandHigh
            : CheckInResultStrings.bandStandard,
    };

    final isLow = band == 'low' || (band == null && score < standardThreshold);

    final Color statusColor = switch (status) {
      'present' => Colors.green,
      'late' => Colors.orange,
      _ => Colors.red,
    };

    return Scaffold(
      appBar: AppBar(title: const Text(CheckInResultStrings.appBarTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.circle, color: statusColor, size: 14),
                const SizedBox(width: 8),
                Text(
                  statusLabel,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(bandLabel, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 8),
            Text(
              '${CheckInResultStrings.proximityScore}: $score',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            _buildSignalBreakdown(context),
            if (isLow) ...[
              const SizedBox(height: 24),
              const Icon(Icons.info_outline, size: 20),
            ],
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/');
                  }
                },
                child: const Text(CheckInResultStrings.done),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignalBreakdown(BuildContext context) {
    final methods = record['verification_methods'] as Map<String, dynamic>?;
    if (methods == null || methods.isEmpty) return const SizedBox.shrink();

    final signals = ['bluetooth', 'gps', 'nfc', 'network', 'qr_proximity'];

    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: signals.map((signal) {
        final present = methods.containsKey(signal);
        final label = signal.split('_').first.toUpperCase();
        return Chip(
          avatar: Icon(
            present ? Icons.check_circle : Icons.cancel,
            size: 16,
            color: present ? Colors.green : Colors.grey,
          ),
          label: Text(label, style: const TextStyle(fontSize: 11)),
          backgroundColor: present
              ? Colors.green.shade50
              : Colors.grey.shade100,
          side: BorderSide(
            color: present ? Colors.green.shade200 : Colors.grey.shade300,
          ),
          visualDensity: VisualDensity.compact,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        );
      }).toList(),
    );
  }
}
