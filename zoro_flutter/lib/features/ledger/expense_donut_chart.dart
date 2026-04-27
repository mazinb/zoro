import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';

class ExpenseDonutSegment {
  const ExpenseDonutSegment({required this.label, required this.value, required this.color});

  final String label;
  final double value;
  final Color color;
}

String _shortExpenseLabel(String key) {
  switch (key) {
    case 'housing':
      return 'Housing';
    case 'food':
      return 'Food';
    case 'transportation':
      return 'Transport';
    case 'healthcare':
      return 'Health';
    case 'entertainment':
      return 'Entertainment';
    case 'other':
      return 'Other';
    default:
      return key;
  }
}

/// Donut of estimated monthly spend by bucket (values should be ≥ 0).
class ExpenseDonutChart extends StatelessWidget {
  const ExpenseDonutChart({
    super.key,
    required this.segments,
    required this.centerTitle,
    required this.centerSubtitle,
    this.size = 200,
    this.strokeWidth = 36,
  });

  final List<ExpenseDonutSegment> segments;
  final String centerTitle;
  final String centerSubtitle;
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _DonutPainter(
          segments: segments,
          strokeWidth: strokeWidth,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                centerTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, height: 1.1),
              ),
              const SizedBox(height: 4),
              Text(
                centerSubtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.segments, required this.strokeWidth});

  final List<ExpenseDonutSegment> segments;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) - strokeWidth) / 2;
    final rect = Rect.fromCircle(center: c, radius: radius);

    final total = segments.fold<double>(0, (s, e) => s + e.value);
    if (total <= 0 || radius <= 0) {
      final bg = Paint()
        ..color = const Color(0xFFE2E8F0)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth;
      canvas.drawArc(rect, 0, 2 * math.pi, false, bg);
      return;
    }

    var start = -math.pi / 2;
    for (final seg in segments) {
      if (seg.value <= 0) continue;
      final sweep = (seg.value / total) * 2 * math.pi;
      final paint = Paint()
        ..color = seg.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, paint);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) {
    return oldDelegate.segments != segments || oldDelegate.strokeWidth != strokeWidth;
  }
}

List<ExpenseDonutSegment> expenseDonutSegmentsFromPreset(
  CountryPreset preset,
  Map<String, double> expenseBuckets,
) {
  final out = <ExpenseDonutSegment>[];
  for (final k in recurringExpenseBucketKeys) {
    final v = expenseBuckets[k] ?? 0;
    if (v <= 0) continue;
    final label = _shortExpenseLabel(k);
    out.add(ExpenseDonutSegment(label: label, value: v, color: bucketColor(k)));
  }
  return out;
}
