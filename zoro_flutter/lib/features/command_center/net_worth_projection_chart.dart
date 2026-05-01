import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

/// Horizontal bar chart for 10-year net worth projection (year 0 = now).
/// Bars animate in staggered order left to right (0 → last). No x-axis; year is in the caption above.
class NetWorthProjectionBarChart extends StatefulWidget {
  const NetWorthProjectionBarChart({
    super.key,
    required this.series,
    required this.selectedYearIndex,
    required this.onTapYear,
  });

  final List<double> series;
  final int? selectedYearIndex;
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
    required this.fillProgress,
  });

  final List<double> series;
  final double maxVal;
  final int? selectedYearIndex;
  final double fillProgress;

  /// Stagger left to right (year 0 → last).
  double _barFillFactor(int i, int n, double t) {
    if (n <= 0) return 0;
    final slot = 1.0 / n;
    final begin = i * slot;
    return Curves.easeOutCubic.transform(((t - begin) / slot).clamp(0.0, 1.0));
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
      final y = baseY - h;
      final isSel = selectedYearIndex == i;
      final fill = Paint()
        ..color = (isSel ? AppTheme.primaryBlue : AppTheme.blue).withValues(alpha: i == 0 ? 0.45 : 0.88);
      final rrect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x + 1, y, barW - 2, h.clamp(0, chartH)),
        const Radius.circular(4),
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
        oldDelegate.fillProgress != fillProgress;
  }
}
