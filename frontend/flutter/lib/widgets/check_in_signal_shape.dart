import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:material_shapes/material_shapes.dart';

enum CheckInSignalVisualState { idle, ready, detected, success }

class CheckInSignalShape extends StatefulWidget {
  const CheckInSignalShape({
    super.key,
    required this.visualState,
    required this.color,
    required this.size,
    required this.enabled,
    this.onTap,
  });

  final CheckInSignalVisualState visualState;
  final Color color;
  final double size;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  State<CheckInSignalShape> createState() => _CheckInSignalShapeState();
}

class _CheckInSignalShapeState extends State<CheckInSignalShape>
    with SingleTickerProviderStateMixin {
  static const _shapeSequence = <String>[
    'softBloom',
    'bloom',
    'puffy',
    'diamond',
    'gem',
    'sevenSidedCookie',
  ];

  final Random _random = Random();
  late final AnimationController _rotationController;
  Timer? _shapeTimer;
  String _shapeName = 'circle';

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(vsync: this);
    _syncState(forceReset: true);
  }

  @override
  void didUpdateWidget(CheckInSignalShape oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.visualState != widget.visualState ||
        oldWidget.enabled != widget.enabled) {
      _syncState(forceReset: oldWidget.visualState != widget.visualState);
    }
  }

  @override
  void dispose() {
    _shapeTimer?.cancel();
    _rotationController.dispose();
    super.dispose();
  }

  void _syncState({required bool forceReset}) {
    _shapeTimer?.cancel();
    switch (widget.visualState) {
      case CheckInSignalVisualState.idle:
        _shapeName = 'circle';
        _rotationController
          ..stop()
          ..value = 0;
      case CheckInSignalVisualState.success:
        _shapeName = 'circle';
        _rotationController
          ..stop()
          ..value = 0;
      case CheckInSignalVisualState.ready:
        if (forceReset) {
          _shapeName = _shapeSequence[_random.nextInt(_shapeSequence.length)];
        }
        _rotationController
          ..duration = const Duration(seconds: 22)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1800), (_) {
          if (!mounted) return;
          setState(() {
            _shapeName = _shapeSequence[_random.nextInt(_shapeSequence.length)];
          });
        });
      case CheckInSignalVisualState.detected:
        if (forceReset) {
          _shapeName = _shapeSequence[_random.nextInt(_shapeSequence.length)];
        }
        _rotationController
          ..duration = const Duration(seconds: 14)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
          if (!mounted) return;
          setState(() {
            _shapeName = _shapeSequence[_random.nextInt(_shapeSequence.length)];
          });
        });
    }
    if (mounted) {
      setState(() {});
    }
  }

  Widget _buildShape() {
    final color = widget.color;
    final size = widget.size;
    final gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        color.withValues(alpha: 0.92),
        Color.lerp(color, Colors.white, 0.18) ?? color,
      ],
    );
    final shadow = BoxShadow(
      color: color.withValues(alpha: 0.26),
      blurRadius: 32,
      offset: const Offset(0, 16),
    );

    return switch (_shapeName) {
      'softBloom' => MaterialShapes.softBloom(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      'bloom' => MaterialShapes.bloom(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      'puffy' => MaterialShapes.puffy(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      'diamond' => MaterialShapes.diamond(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      'gem' => MaterialShapes.gem(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      'sevenSidedCookie' => MaterialShapes.sevenSidedCookie(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
      _ => MaterialShapes.circle(
        size: size,
        color: color,
        gradient: gradient,
        shadow: shadow,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final child = RotationTransition(
      turns: _rotationController,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 520),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: ScaleTransition(scale: animation, child: child),
          );
        },
        child: KeyedSubtree(
          key: ValueKey(
            '${widget.visualState.name}:$_shapeName:${widget.size.round()}',
          ),
          child: _buildShape(),
        ),
      ),
    );

    return AnimatedScale(
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
      scale: widget.enabled ? 1 : 0.96,
      child: GestureDetector(
        onTap: widget.enabled ? widget.onTap : null,
        behavior: HitTestBehavior.opaque,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 260),
          opacity: widget.enabled ? 1 : 0.7,
          child: child,
        ),
      ),
    );
  }
}
