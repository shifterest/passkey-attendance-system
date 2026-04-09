import 'package:flutter/material.dart';

class AppTheme {
  static const String fontFamily = 'GoogleSansFlex';
  static const Color _seedColor = Color(0xFF3B5B8A);

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: _seedColor,
      brightness: brightness,
    );
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
    );
    final textTheme = base.textTheme.apply(
      fontFamily: fontFamily,
      bodyColor: colorScheme.onSurface,
      displayColor: colorScheme.onSurface,
    );

    return base.copyWith(
      textTheme: textTheme,
      scaffoldBackgroundColor: colorScheme.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: sliverTitle(textTheme, colorScheme),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: variable(textTheme.labelLarge, weight: 620, width: 112),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          side: BorderSide(color: colorScheme.outlineVariant),
          textStyle: variable(textTheme.labelLarge, weight: 560, width: 110),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: variable(textTheme.labelLarge, weight: 540, width: 110),
        ),
      ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        color: colorScheme.surfaceContainerLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainerHigh,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.25),
        ),
      ),
    );
  }

  static TextStyle variable(
    TextStyle? base, {
    double weight = 500,
    double width = 110,
    double? size,
    Color? color,
    double? letterSpacing,
  }) {
    return (base ?? const TextStyle()).copyWith(
      fontFamily: fontFamily,
      fontSize: size,
      color: color,
      letterSpacing: letterSpacing,
      fontVariations: [
        FontVariation('wght', weight),
        FontVariation('wdth', width),
      ],
    );
  }

  static TextStyle authTitle(TextTheme textTheme, ColorScheme colorScheme) {
    final base = textTheme.headlineMedium;
    return variable(
      base,
      weight: 700,
      width: 148,
      size: (base?.fontSize ?? 30) * 1.08,
      color: colorScheme.onSurface,
      letterSpacing: -0.6,
    );
  }

  static TextStyle sliverTitle(TextTheme textTheme, ColorScheme colorScheme) {
    final base = textTheme.titleLarge;
    return variable(
      base,
      weight: 620,
      width: 112,
      size: base?.fontSize,
      color: colorScheme.onSurface,
      letterSpacing: -0.1,
    );
  }

  static TextStyle heroMetric(TextTheme textTheme, ColorScheme colorScheme) {
    return variable(
      textTheme.headlineSmall,
      weight: 680,
      width: 132,
      color: colorScheme.onSurface,
      letterSpacing: -0.3,
    );
  }

  static TextStyle sectionLabel(TextTheme textTheme, ColorScheme colorScheme) {
    return variable(
      textTheme.labelLarge,
      weight: 620,
      width: 110,
      color: colorScheme.onSurfaceVariant,
      letterSpacing: 0.2,
    );
  }
}
