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
    with TickerProviderStateMixin {
  static final _shapePool = <RoundedPolygon>[
    for (final shape in MaterialShapes.all)
      if (!identical(shape, MaterialShapes.circle)) shape,
  ];

  static const _recentHistorySize = 5;

  final Random _random = Random();
  final List<int> _recentIndices = [];
  late final AnimationController _rotationController;
  late final AnimationController _morphController;
  Timer? _shapeTimer;
  RoundedPolygon _fromShape = MaterialShapes.circle;
  RoundedPolygon _toShape = MaterialShapes.circle;
  Morph? _currentMorph;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(vsync: this);
    _morphController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _morphController.addListener(_onMorphTick);
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
    _morphController.removeListener(_onMorphTick);
    _morphController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  void _onMorphTick() {
    setState(() {});
  }

  RoundedPolygon _pickNextShape() {
    final available = <int>[];
    for (var i = 0; i < _shapePool.length; i++) {
      if (!_recentIndices.contains(i)) {
        available.add(i);
      }
    }
    if (available.isEmpty) {
      available.addAll(List.generate(_shapePool.length, (i) => i));
    }
    final chosen = available[_random.nextInt(available.length)];
    _recentIndices.add(chosen);
    if (_recentIndices.length > _recentHistorySize) {
      _recentIndices.removeAt(0);
    }
    return _shapePool[chosen];
  }

  void _changeShape(RoundedPolygon newShape) {
    _fromShape = _toShape;
    _toShape = newShape;
    _currentMorph = Morph(_fromShape, _toShape);
    _morphController.forward(from: 0);
  }

  void _syncState({required bool forceReset}) {
    _shapeTimer?.cancel();
    switch (widget.visualState) {
      case CheckInSignalVisualState.idle:
      case CheckInSignalVisualState.success:
        _changeShape(MaterialShapes.circle);
        _rotationController
          ..stop()
          ..value = 0;
      case CheckInSignalVisualState.ready:
        if (forceReset) {
          _changeShape(_pickNextShape());
        }
        _rotationController
          ..duration = const Duration(seconds: 22)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1800), (_) {
          if (!mounted) return;
          _changeShape(_pickNextShape());
        });
      case CheckInSignalVisualState.detected:
        if (forceReset) {
          _changeShape(_pickNextShape());
        }
        _rotationController
          ..duration = const Duration(seconds: 14)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
          if (!mounted) return;
          _changeShape(_pickNextShape());
        });
      case CheckInSignalVisualState.checkingIn:
        if (forceReset) {
          _changeShape(_pickNextShape());
        }
        _rotationController
          ..duration = const Duration(seconds: 8)
          ..repeat();
        _shapeTimer = Timer.periodic(const Duration(milliseconds: 800), (_) {
          if (!mounted) return;
          _changeShape(_pickNextShape());
        });
    }
  }

  Path _currentPath() {
    final morph = _currentMorph;
    if (morph == null) {
      return _toShape.toPath();
    }
    final t = Curves.easeOutCubic.transform(_morphController.value);
    return morph.toPath(progress: t, rotationPivotX: 0.5, rotationPivotY: 0.5);
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
    final shadowColor = color.withValues(alpha: 0.26);
    final path = _currentPath();

    final shapeWidget = AnimatedContainer(
      duration: const Duration(milliseconds: 520),
      curve: Curves.easeOutCubic,
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MorphShapePainter(
          path: path,
          gradient: gradient,
          shadowColor: shadowColor,
        ),
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

class _MorphShapePainter extends CustomPainter {
  _MorphShapePainter({
    required this.path,
    required this.gradient,
    required this.shadowColor,
  });

  final Path path;
  final LinearGradient gradient;
  final Color shadowColor;

  @override
  void paint(Canvas canvas, Size size) {
    final matrix = Matrix4.diagonal3Values(size.width, size.height, 1);
    final scaled = path.transform(matrix.storage);

    final shadowPaint = Paint()
      ..color = shadowColor
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16);
    canvas.save();
    canvas.translate(0, 16);
    canvas.drawPath(scaled, shadowPaint);
    canvas.restore();

    final rect = Offset.zero & size;
    final fillPaint = Paint()..shader = gradient.createShader(rect);
    canvas.drawPath(scaled, fillPaint);
  }

  @override
  bool shouldRepaint(_MorphShapePainter oldDelegate) =>
      !identical(path, oldDelegate.path) ||
      gradient != oldDelegate.gradient ||
      shadowColor != oldDelegate.shadowColor;
}
