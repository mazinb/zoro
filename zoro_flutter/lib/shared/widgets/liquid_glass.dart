import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

class _GlassConstants {
  static const double blurSigma = 18;
  static const double barBlurSigma = 22;
  static const double panelBlurSigma = 10;
  static const double sheetTopRadius = 20;
}

/// Light frosted inset (Home chrome: reminders header, Sankey hint, selection card).
/// Softer blur than [LiquidGlassBar]. Do not wrap long scrollable lists.
class LiquidGlassPanel extends StatelessWidget {
  const LiquidGlassPanel({
    super.key,
    required this.child,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
    this.padding,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: _GlassConstants.panelBlurSigma,
          sigmaY: _GlassConstants.panelBlurSigma,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: borderRadius,
            border: Border.all(
              color: cs.primary.withValues(alpha: isDark ? 0.35 : 0.22),
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                cs.surface.withValues(alpha: isDark ? 0.42 : 0.65),
                cs.surface.withValues(alpha: isDark ? 0.30 : 0.50),
              ],
            ),
          ),
          child: padding != null ? Padding(padding: padding!, child: child) : child,
        ),
      ),
    );
  }
}

/// Floating frosted pill for bottom [NavigationBar]. Flat frost + blur + primary
/// border (no gradient). Use with [NavigationBarThemeData.backgroundColor]
/// transparent. [margin] insets the pill from screen edges and home indicator.
class LiquidGlassBar extends StatelessWidget {
  const LiquidGlassBar({
    super.key,
    required this.child,
    this.margin = const EdgeInsets.fromLTRB(14, 4, 14, 10),
    this.borderRadius = 28,
  });

  final Widget child;
  final EdgeInsetsGeometry margin;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = BorderRadius.circular(borderRadius);
    final borderA = isDark ? 0.45 : 0.28;
    // Flat tint only — blur does the glass; no gradient so the bar sits visually on the page.
    final frost = isDark
        ? Colors.white.withValues(alpha: 0.055)
        : Colors.white.withValues(alpha: 0.12);

    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: r,
          boxShadow: [
            BoxShadow(
              color: cs.shadow.withValues(alpha: isDark ? 0.35 : 0.08),
              blurRadius: isDark ? 20 : 16,
              offset: const Offset(0, 8),
              spreadRadius: -4,
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: r,
          child: BackdropFilter(
            filter: ImageFilter.blur(
              sigmaX: _GlassConstants.barBlurSigma,
              sigmaY: _GlassConstants.barBlurSigma,
            ),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: r,
                border: Border.all(
                  color: cs.primary.withValues(alpha: borderA),
                  width: 1,
                ),
                color: frost,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

/// Rounded-top frosted panel for modal bottom sheets.
class LiquidGlassModalSurface extends StatelessWidget {
  const LiquidGlassModalSurface({
    super.key,
    required this.child,
    this.showDragHandle = true,
    /// When true, the panel sizes to the child’s intrinsic height (better for short pickers).
    this.sizesToContent = false,
  });

  final Widget child;
  final bool showDragHandle;
  final bool sizesToContent;

  Widget _dragPill(Color onSurfaceVariant) {
    return IgnorePointer(
      child: Center(
        child: Container(
          width: 40,
          height: 4,
          decoration: BoxDecoration(
            color: onSurfaceVariant.withValues(alpha: 0.40),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final r = _GlassConstants.sheetTopRadius;

    final body = sizesToContent
        ? Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (showDragHandle) ...[
                const SizedBox(height: 10),
                _dragPill(cs.onSurfaceVariant),
                const SizedBox(height: 10),
              ] else
                const SizedBox(height: 10),
              child,
            ],
          )
        : Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned.fill(
                child: Padding(
                  padding: EdgeInsets.only(top: showDragHandle ? 24 : 10),
                  child: child,
                ),
              ),
              if (showDragHandle)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 10,
                  child: _dragPill(cs.onSurfaceVariant),
                ),
            ],
          );

    return ClipRRect(
      borderRadius: BorderRadius.vertical(top: Radius.circular(r)),
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: _GlassConstants.blurSigma,
          sigmaY: _GlassConstants.blurSigma,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.vertical(top: Radius.circular(r)),
            border: Border.all(
              color: cs.primary.withValues(alpha: isDark ? 0.38 : 0.28),
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                cs.surface.withValues(alpha: isDark ? 0.50 : 0.78),
                cs.surface.withValues(alpha: isDark ? 0.38 : 0.62),
              ],
            ),
          ),
          child: body,
        ),
      ),
    );
  }
}

/// Modal bottom sheet with transparent route and a liquid-glass surface.
Future<T?> showLiquidGlassModalBottomSheet<T extends Object?>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = false,
  bool showDragHandle = true,
  bool enableDrag = true,
  bool isDismissible = true,
  bool useSafeArea = true,
  bool sizesToContent = false,
}) {
  final cs = Theme.of(context).colorScheme;
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: cs.scrim.withValues(alpha: 0.52),
    isScrollControlled: isScrollControlled,
    showDragHandle: false,
    enableDrag: enableDrag,
    isDismissible: isDismissible,
    useSafeArea: useSafeArea,
    builder: (ctx) => LiquidGlassModalSurface(
      showDragHandle: showDragHandle,
      sizesToContent: sizesToContent,
      child: builder(ctx),
    ),
  );
}
