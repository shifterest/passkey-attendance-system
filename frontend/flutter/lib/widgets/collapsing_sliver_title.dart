import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:passkey_attendance_system/theme/app_theme.dart';

class CollapsingSliverTitle extends StatelessWidget {
  const CollapsingSliverTitle({
    super.key,
    required this.text,
    this.color,
    this.expandedWidth = 148,
    this.collapsedWidth = 112,
    this.expandedWeight = 700,
    this.collapsedWeight = 620,
  });

  final String text;
  final Color? color;
  final double expandedWidth;
  final double collapsedWidth;
  final double expandedWeight;
  final double collapsedWeight;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = context
        .dependOnInheritedWidgetOfExactType<FlexibleSpaceBarSettings>();
    final progress = _collapseProgress(settings);
    final resolvedColor = color ?? theme.colorScheme.onSurface;
    final expandedSize = (theme.textTheme.titleLarge?.fontSize ?? 22) * 1.24;
    final collapsedSize = theme.textTheme.titleLarge?.fontSize ?? 22;

    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppTheme.variable(
        theme.textTheme.titleLarge,
        weight:
            lerpDouble(expandedWeight, collapsedWeight, progress) ??
            collapsedWeight,
        width:
            lerpDouble(expandedWidth, collapsedWidth, progress) ??
            collapsedWidth,
        size: lerpDouble(expandedSize, collapsedSize, progress),
        color: resolvedColor,
        letterSpacing: lerpDouble(-0.55, -0.1, progress),
      ),
    );
  }

  double _collapseProgress(FlexibleSpaceBarSettings? settings) {
    if (settings == null) {
      return 1;
    }
    final delta = settings.maxExtent - settings.minExtent;
    if (delta <= 0) {
      return 1;
    }
    return ((settings.maxExtent - settings.currentExtent) / delta).clamp(
      0.0,
      1.0,
    );
  }
}
