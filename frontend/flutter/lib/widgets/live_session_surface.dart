import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';

enum LiveSessionPhase { idle, preparing, active, reviewing, completed, error }

class LiveSessionMetricItem {
  const LiveSessionMetricItem({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;
}

class LiveSessionHeroCard extends StatelessWidget {
  const LiveSessionHeroCard({
    super.key,
    required this.phase,
    required this.phaseLabel,
    required this.title,
    required this.body,
    required this.metrics,
    required this.backgroundColor,
    required this.foregroundColor,
    this.visual,
  });

  final LiveSessionPhase phase;
  final String phaseLabel;
  final String title;
  final String body;
  final List<LiveSessionMetricItem> metrics;
  final Color backgroundColor;
  final Color foregroundColor;
  final Widget? visual;

  Color _phaseColor() {
    return switch (phase) {
      LiveSessionPhase.idle => const Color(0xFF8A94A6),
      LiveSessionPhase.preparing => const Color(0xFF4E8DFF),
      LiveSessionPhase.active => const Color(0xFF35C66B),
      LiveSessionPhase.reviewing => const Color(0xFFF5A623),
      LiveSessionPhase.completed => const Color(0xFF35C66B),
      LiveSessionPhase.error => const Color(0xFFFF5B57),
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final phaseColor = _phaseColor();

    return Card(
      color: backgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: phaseColor.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                phaseLabel,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: phaseColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: AppTheme.variable(
                theme.textTheme.headlineSmall,
                weight: 700,
                width: 134,
                color: foregroundColor,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: foregroundColor.withValues(alpha: 0.84),
                height: 1.35,
              ),
            ),
            if (visual != null) ...[const SizedBox(height: 18), visual!],
            if (metrics.isNotEmpty) ...[
              const SizedBox(height: 18),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: metrics
                    .map(
                      (metric) => _LiveSessionMetricCard(
                        metric: metric,
                        backgroundColor: foregroundColor.withValues(
                          alpha: 0.08,
                        ),
                        foregroundColor: foregroundColor,
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class LiveSessionSectionCard extends StatelessWidget {
  const LiveSessionSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.backgroundColor,
    this.foregroundColor,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final resolvedForeground = foregroundColor ?? theme.colorScheme.onSurface;

    return Card(
      color: backgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                color: resolvedForeground,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: resolvedForeground.withValues(alpha: 0.78),
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class LiveSessionCapabilityTile extends StatelessWidget {
  const LiveSessionCapabilityTile({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.statusLabel,
    required this.statusColor,
    this.foregroundColor,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String body;
  final String statusLabel;
  final Color statusColor;
  final Color? foregroundColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final resolvedForeground = foregroundColor ?? theme.colorScheme.onSurface;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: statusColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: resolvedForeground,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _LiveSessionStatusPill(
                    label: statusLabel,
                    color: statusColor,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                body,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: resolvedForeground.withValues(alpha: 0.76),
                  height: 1.3,
                ),
              ),
              if (trailing != null) ...[const SizedBox(height: 10), trailing!],
            ],
          ),
        ),
      ],
    );
  }
}

class _LiveSessionMetricCard extends StatelessWidget {
  const _LiveSessionMetricCard({
    required this.metric,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final LiveSessionMetricItem metric;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: 144,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(metric.icon, size: 18, color: foregroundColor),
          const SizedBox(height: 10),
          Text(
            metric.value,
            style: theme.textTheme.titleMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            metric.label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: foregroundColor.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveSessionStatusPill extends StatelessWidget {
  const _LiveSessionStatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
