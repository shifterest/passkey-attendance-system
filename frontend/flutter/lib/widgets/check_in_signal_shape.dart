import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:material_shapes/material_shapes.dart';

enum CheckInSignalVisualState { idle, ready, detected, checkingIn, success }

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
  static final _shapeSequence = <RoundedPolygon>[
    MaterialShapes.flower,
    MaterialShapes.sunny,
    MaterialShapes.puffy,
    MaterialShapes.diamond,
    MaterialShapes.gem,
    MaterialShapes.cookie7Sided,
  ];

  final Random _random = Random();
  late final AnimationController _rotationController;
  Timer? _shapeTimer;
  RoundedPolygon _currentShape = MaterialShapes.circle;

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
      case CheckInSignalVisualState.success:
        _currentShape = MaterialShapes.circle;
        _rotationController
          ..stop()
          ..value = 0;
      case CheckInSignalVisualState.ready:
        if (forceReset) {
          _currentShape =
              _shapeSequence[_random.nextInt(_shapeSequence.length)];
        }
        _rotationController
          ..duration = const Duration(seconds: 22)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1800), (_) {
          if (!mounted) return;
          setState(() {
            _currentShape =
                _shapeSequence[_random.nextInt(_shapeSequence.length)];
          });
        });
      case CheckInSignalVisualState.detected:
        if (forceReset) {
          _currentShape =
              _shapeSequence[_random.nextInt(_shapeSequence.length)];
        }
        _rotationController
          ..duration = const Duration(seconds: 14)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
          if (!mounted) return;
          setState(() {
            _currentShape =
                _shapeSequence[_random.nextInt(_shapeSequence.length)];
          });
        });
      case CheckInSignalVisualState.checkingIn:
        if (forceReset) {
          _currentShape =
              _shapeSequence[_random.nextInt(_shapeSequence.length)];
        }
        _rotationController
          ..duration = const Duration(seconds: 8)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 800), (_) {
          if (!mounted) return;
          setState(() {
            _currentShape =
                _shapeSequence[_random.nextInt(_shapeSequence.length)];
          });
        });
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
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

    final shapeWidget = AnimatedContainer(
      duration: const Duration(milliseconds: 520),
      curve: Curves.easeOutCubic,
      width: size,
      height: size,
      decoration: ShapeDecoration(
        gradient: gradient,
        shadows: [shadow],
        shape: MaterialShapeBorder(shape: _currentShape),
      ),
    );

    final child = RotationTransition(
      turns: _rotationController,
      child: shapeWidget,
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
