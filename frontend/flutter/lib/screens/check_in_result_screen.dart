import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:passkey_attendance_system/strings.dart';
import 'package:passkey_attendance_system/widgets/attendance_record_surface.dart';

class CheckInResultScreen extends StatelessWidget {
  const CheckInResultScreen({super.key, required this.record});

  final Map<String, dynamic> record;

  @override
  Widget build(BuildContext context) {
    final status = record['status'] as String?;
    final score = record['assurance_score'] as int? ?? 0;
    final band = record['assurance_band_recorded'] as String?;
    final isLow =
        band == 'low' ||
        (band == null &&
            score < (record['standard_threshold_recorded'] as int? ?? 5));
    final signals = recordSignalLabels(record['verification_methods']);

    return Scaffold(
      appBar: AppBar(title: const Text(CheckInResultStrings.appBarTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.circle, color: recordStatusColor(status), size: 14),
                const SizedBox(width: 8),
                Text(
                  recordStatusLabel(status),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              recordBandLabel(band),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 8),
            Text(
              '${CheckInResultStrings.proximityScore}: $score',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (signals.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: signals
                    .map(
                      (label) => Chip(
                        label: Text(
                          label,
                          style: const TextStyle(fontSize: 11),
                        ),
                        visualDensity: VisualDensity.compact,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: EdgeInsets.zero,
                        labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
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
}
