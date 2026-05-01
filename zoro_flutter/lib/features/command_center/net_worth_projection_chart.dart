import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

/// Horizontal bar chart for 10-year net worth projection (year 0 = now).
/// Bars animate in staggered order left to right (0 → last). No x-axis; year is in the caption above.
/// Selected bar: light = today’s NW (fixed chart height for y &gt; 0), blue = new money, green = all returns.
class NetWorthProjectionBarChart extends StatefulWidget {
  const NetWorthProjectionBarChart({
    super.key,
    required this.series,
    required this.selectedYearIndex,
    required this.selectionBreakdown,
    required this.onTapYear,
  });

  final List<double> series;
  final int? selectedYearIndex;
  final NetWorthProjectionYearBreakdown? selectionBreakdown;
  final ValueChanged<int> onTapYear;

  @override
  State<NetWorthProjectionBarChart> createState() => _NetWorthProjectionBarChartState();
}

class _NetWorthProjectionBarChartState extends State<NetWorthProjectionBarChart>
    with SingleTickerProviderStateMixin {
  late AnimationController _fill;

  @override
  void initState() {
    super.initState();
    _fill = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1150),
    );
    _fill.forward();
  }

  @override
  void didUpdateWidget(NetWorthProjectionBarChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!listEquals(oldWidget.series, widget.series)) {
      _fill.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _fill.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final w = c.maxWidth.isFinite && c.maxWidth > 0 ? c.maxWidth : MediaQuery.sizeOf(context).width;
        const h = 300.0;
        final maxVal = widget.series.isEmpty
            ? 1.0
            : widget.series.map((e) => e.clamp(0, double.infinity)).reduce(math.max).toDouble();
        return AnimatedBuilder(
          animation: _fill,
          builder: (context, _) {
            return SizedBox(
              height: h,
              width: w,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapDown: (d) {
                  final n = widget.series.length;
                  if (n == 0) return;
                  const pad = 8.0;
                  final innerW = ((w - 2 * pad).clamp(1.0, double.infinity)).toDouble();
                  final barW = innerW / n;
                  final i = ((d.localPosition.dx - pad) / barW).floor().clamp(0, n - 1);
                  widget.onTapYear(i);
                },
                child: CustomPaint(
                  size: Size(w, h),
                  painter: _ProjectionBarPainter(
                    series: widget.series,
                    maxVal: maxVal,
                    selectedYearIndex: widget.selectedYearIndex,
                    selectionBreakdown: widget.selectionBreakdown,
                    fillProgress: _fill.value,
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ProjectionBarPainter extends CustomPainter {
  _ProjectionBarPainter({
    required this.series,
    required this.maxVal,
    required this.selectedYearIndex,
    required this.selectionBreakdown,
    required this.fillProgress,
  });

  final List<double> series;
  final double maxVal;
  final int? selectedYearIndex;
  final NetWorthProjectionYearBreakdown? selectionBreakdown;
  final double fillProgress;

  static const Radius _r = Radius.circular(4);
  static const Radius _z = Radius.zero;

  /// Stagger left to right (year 0 → last).
  double _barFillFactor(int i, int n, double t) {
    if (n <= 0) return 0;
    final slot = 1.0 / n;
    final begin = i * slot;
    return Curves.easeOutCubic.transform(((t - begin) / slot).clamp(0.0, 1.0));
  }

  void _paintThreeStack(
    Canvas canvas,
    double x,
    double barInnerW,
    double baseY,
    double totalH,
    double hLight,
    double hBlue,
    double hGreen,
  ) {
    if (totalH <= 1e-9) return;

    final cLight = AppTheme.blue.withValues(alpha: 0.45);
    final cBlue = AppTheme.blue.withValues(alpha: 0.88);
    final cGreen = const Color(0xFF10B981).withValues(alpha: 0.9);

    var yBottom = baseY;

    if (hLight > 1e-6) {
      final y = yBottom - hLight;
      final solo = hBlue < 1e-6 && hGreen < 1e-6;
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barInnerW, hLight),
          topLeft: solo ? _r : _z,
          topRight: solo ? _r : _z,
          bottomLeft: _r,
          bottomRight: _r,
        ),
        Paint()..color = cLight,
      );
      yBottom = y;
    }
    if (hBlue > 1e-6) {
      final y = yBottom - hBlue;
      final topRound = hGreen < 1e-6;
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barInnerW, hBlue),
          topLeft: topRound ? _r : _z,
          topRight: topRound ? _r : _z,
          bottomLeft: _z,
          bottomRight: _z,
        ),
        Paint()..color = cBlue,
      );
      yBottom = y;
    }
    if (hGreen > 1e-6) {
      final y = yBottom - hGreen;
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barInnerW, hGreen),
          topLeft: _r,
          topRight: _r,
          bottomLeft: _z,
          bottomRight: _z,
        ),
        Paint()..color = cGreen,
      );
    }

    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(x, baseY - totalH, barInnerW, totalH), _r),
      Paint()
        ..color = AppTheme.slate900
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (series.isEmpty) return;
    final n = series.length;
    const pad = 8.0;
    final baseY = size.height - pad;
    final chartH = baseY - pad;
    final innerW = (size.width - 2 * pad).toDouble();
    final barW = innerW / n;
    final maxV = maxVal <= 0 ? 1.0 : maxVal;

    for (var i = 0; i < n; i++) {
      final x = pad + i * barW;
      final v = series[i].clamp(0, double.infinity);
      final fullH = chartH * (v / maxV);
      final f = _barFillFactor(i, n, fillProgress);
      final h = fullH * f;
      final yTop = baseY - h;
      final isSel = selectedYearIndex == i;
      final barInnerX = x + 1;
      final barInnerW = barW - 2;

      if (isSel && selectionBreakdown != null && h > 1e-6) {
        final b = selectionBreakdown!;
        final nw0 = series.isNotEmpty ? series[0].clamp(0, double.infinity) : 0.0;
        late final double hLight;
        late final double hBlue;
        late final double hGreen;
        if (i == 0) {
          hLight = h;
          hBlue = 0;
          hGreen = 0;
        } else {
          final hLightCap = chartH * (nw0 / maxV) * f;
          hLight = math.min(hLightCap, h);
          final hRem = (h - hLight).clamp(0.0, double.infinity);
          final rSum = b.surplusPrincipal + b.surplusReturns;
          if (hRem > 1e-6 && rSum > 1e-9) {
            hBlue = hRem * (b.surplusPrincipal / rSum);
            hGreen = hRem - hBlue;
          } else {
            hBlue = 0;
            hGreen = hRem;
          }
        }
        _paintThreeStack(canvas, barInnerX, barInnerW, baseY, h, hLight, hBlue, hGreen);
        continue;
      }

      final fill = Paint()
        ..color = (isSel ? AppTheme.primaryBlue : AppTheme.blue).withValues(alpha: i == 0 ? 0.45 : 0.88);
      final rrect = RRect.fromRectAndRadius(
        Rect.fromLTWH(barInnerX, yTop, barInnerW, h.clamp(0, chartH)),
        _r,
      );
      canvas.drawRRect(rrect, fill);
      if (isSel) {
        canvas.drawRRect(
          rrect,
          Paint()
            ..color = AppTheme.slate900
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ProjectionBarPainter oldDelegate) {
    return oldDelegate.series != series ||
        oldDelegate.maxVal != maxVal ||
        oldDelegate.selectedYearIndex != selectedYearIndex ||
        oldDelegate.selectionBreakdown != selectionBreakdown ||
        oldDelegate.fillProgress != fillProgress;
  }
}
