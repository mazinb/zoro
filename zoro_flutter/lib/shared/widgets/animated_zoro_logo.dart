import 'package:flutter/material.dart';

import 'package:flutter_svg/flutter_svg.dart';

/// Timing mirrors zoro-app `src/constants/index.ts` → `ANIMATION_DELAYS`.
class AnimationDelays {
  static const int blueLineMs = 800;
  static const int greyLineMs = 1600;
  static const int fadeOutMs = 3200;
  static const int fadeOutDurationMs = 500;
  static const int lineDrawMs = 800;
}

/// Same geometry as `src/components/logo/SharedLogoPaths.tsx`.
class LogoGeometry {
  static const topBar = Rect.fromLTWH(6, 8, 32, 5);
  static const bottomBar = Rect.fromLTWH(6, 37, 32, 5);
  static const barRadius = 2.5;
}

Path _blueLinePath() {
  return Path()
    ..moveTo(10, 28)
    ..lineTo(19, 20)
    ..lineTo(25, 25)
    ..lineTo(34, 15);
}

Path _greyLinePath() {
  return Path()
    ..moveTo(10, 35)
    ..lineTo(19, 27)
    ..lineTo(25, 32)
    ..lineTo(34, 23);
}

/// Staged Z “graph” logo: bars + trimmed polylines + optional fade (web parity).
/// Uses [CustomPainter] for stroke trim; static mark uses [flutter_svg] asset.
class AnimatedZoroLogo extends StatefulWidget {
  const AnimatedZoroLogo({
    super.key,
    this.height = 56,
    this.isDark = false,
    this.runIntro = true,
    this.onIntroComplete,
  });

  final double height;
  final bool isDark;
  final bool runIntro;
  final VoidCallback? onIntroComplete;

  @override
  State<AnimatedZoroLogo> createState() => _AnimatedZoroLogoState();
}

class _AnimatedZoroLogoState extends State<AnimatedZoroLogo>
    with TickerProviderStateMixin {
  late final AnimationController _blueDraw;
  late final AnimationController _greyDraw;
  late final AnimationController _fade;

  double _barOpacity = 0;
  bool _showBlue = false;
  bool _showGrey = false;

  @override
  void initState() {
    super.initState();
    _blueDraw = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: AnimationDelays.lineDrawMs),
    );
    _greyDraw = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: AnimationDelays.lineDrawMs),
    );
    _fade = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: AnimationDelays.fadeOutDurationMs),
    );

    if (!widget.runIntro) {
      _barOpacity = 1;
      _showBlue = true;
      _showGrey = true;
      _blueDraw.value = 1;
      _greyDraw.value = 1;
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _barOpacity = 1);
    });

    Future<void>.delayed(
      const Duration(milliseconds: AnimationDelays.blueLineMs),
      () {
        if (!mounted) return;
        setState(() => _showBlue = true);
        _blueDraw.forward();
      },
    );

    Future<void>.delayed(
      const Duration(milliseconds: AnimationDelays.greyLineMs),
      () {
        if (!mounted) return;
        setState(() => _showGrey = true);
        _greyDraw.forward();
      },
    );

    Future<void>.delayed(
      const Duration(milliseconds: AnimationDelays.fadeOutMs),
      () {
        if (!mounted) return;
        _fade.forward().then((_) {
          widget.onIntroComplete?.call();
        });
      },
    );
  }

  @override
  void dispose() {
    _blueDraw.dispose();
    _greyDraw.dispose();
    _fade.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final barFill = widget.isDark ? Colors.white : LogoPalette.darkText;
    final greyStroke = widget.isDark ? const Color(0xFF94A3B8) : LogoPalette.grey;

    return AnimatedBuilder(
      animation: Listenable.merge([_blueDraw, _greyDraw, _fade]),
      builder: (context, _) {
        final fadeT = 1.0 - _fade.value;
        return Opacity(
          opacity: fadeT,
          child: SizedBox(
            height: widget.height,
            child: AspectRatio(
              aspectRatio: 40 / 50,
              child: CustomPaint(
                painter: _ZoroMarkPainter(
                  barOpacity: _barOpacity,
                  barFill: barFill,
                  blueProgress: _showBlue ? _blueDraw.value : 0,
                  greyProgress: _showGrey ? _greyDraw.value : 0,
                  greyStroke: greyStroke,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class LogoPalette {
  static const blue = Color(0xFF3B82F6);
  static const grey = Color(0xFF64748B);
  static const darkText = Color(0xFF0F172A);
}

class _ZoroMarkPainter extends CustomPainter {
  _ZoroMarkPainter({
    required this.barOpacity,
    required this.barFill,
    required this.blueProgress,
    required this.greyProgress,
    required this.greyStroke,
  });

  final double barOpacity;
  final Color barFill;
  final double blueProgress;
  final double greyProgress;
  final Color greyStroke;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 50;
    canvas.save();
    canvas.scale(scale);

    final barPaint = Paint()
      ..color = barFill.withValues(alpha: barOpacity.clamp(0.0, 1.0))
      ..style = PaintingStyle.fill;

    final rrect = RRect.fromRectAndRadius(
      LogoGeometry.topBar,
      const Radius.circular(LogoGeometry.barRadius),
    );
    canvas.drawRRect(rrect, barPaint);

    final rrect2 = RRect.fromRectAndRadius(
      LogoGeometry.bottomBar,
      const Radius.circular(LogoGeometry.barRadius),
    );
    canvas.drawRRect(rrect2, barPaint);

    _strokePolyline(canvas, _blueLinePath(), blueProgress, LogoPalette.blue);
    _strokePolyline(canvas, _greyLinePath(), greyProgress, greyStroke);

    canvas.restore();
  }

  void _strokePolyline(Canvas canvas, Path path, double t, Color color) {
    if (t <= 0) return;
    final metric = path.computeMetrics().first;
    final len = metric.length;
    final drawLen = len * t.clamp(0.0, 1.0);
    final extract = metric.extractPath(0, drawLen);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(extract, paint);
  }

  @override
  bool shouldRepaint(covariant _ZoroMarkPainter oldDelegate) {
    return oldDelegate.barOpacity != barOpacity ||
        oldDelegate.blueProgress != blueProgress ||
        oldDelegate.greyProgress != greyProgress ||
        oldDelegate.barFill != barFill ||
        oldDelegate.greyStroke != greyStroke;
  }
}

/// Small static mark for app bars (Option A — SVG asset).
class ZoroSvgMark extends StatelessWidget {
  const ZoroSvgMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/branding/zoro_z_static.svg',
      width: size,
      height: size * 50 / 40,
      fit: BoxFit.contain,
    );
  }
}
