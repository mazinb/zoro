import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

class HorizonTab extends StatefulWidget {
  const HorizonTab({super.key, required this.model});

  final AppModel model;

  @override
  State<HorizonTab> createState() => _HorizonTabState();
}

class _HorizonTabState extends State<HorizonTab> {
  double _age = 37;

  final _pins = <_EventPin>[
    _EventPin('Retire', 65, const Color(0xFF10B981)),
    _EventPin('Son → University', 52, const Color(0xFF3B82F6)),
  ];

  @override
  Widget build(BuildContext context) {
    final yrs = (_age - 37).round();
    final netWorth = 120000 + yrs * 38000;
    final score = (72 + yrs * 0.25).clamp(0.0, 100.0).toDouble();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              'Horizon',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: widget.model.accentSoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'Editable timeline',
                style: TextStyle(color: widget.model.accent, fontWeight: FontWeight.w800, fontSize: 12),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Time machine',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
                const SizedBox(height: 6),
                Text(
                  'Scrub through time — pins are draggable.',
                  style: TextStyle(color: AppTheme.slate600.withValues(alpha: 0.9)),
                ),
                const SizedBox(height: 14),
                _OverlayStats(
                  age: _age.round(),
                  netWorth: netWorth,
                  score: score,
                  accent: widget.model.accent,
                ),
                const SizedBox(height: 12),
                Container(
                  height: 220,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.slate100),
                  ),
                  child: CustomPaint(
                    painter: _FanChartPainter(accent: widget.model.accent),
                  ),
                ),
                const SizedBox(height: 16),
                _ScrubBar(
                  age: _age,
                  onChanged: (v) => setState(() => _age = v),
                  pins: _pins,
                  onMovedPin: (pin, nextAge) {
                    setState(() => pin.age = nextAge);
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _OverlayStats extends StatelessWidget {
  const _OverlayStats({
    required this.age,
    required this.netWorth,
    required this.score,
    required this.accent,
  });

  final int age;
  final int netWorth;
  final double score;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            label: 'Age',
            value: '$age',
            accent: accent,
            icon: Icons.timeline,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            label: 'Net worth',
            value: '\$${netWorth ~/ 1000}k',
            accent: accent,
            icon: Icons.account_balance,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatCard(
            label: 'WealthScore',
            value: score.round().toString(),
            accent: accent,
            icon: Icons.speed,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.accent,
    required this.icon,
  });

  final String label;
  final String value;
  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.slate50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.slate100),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: accent, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: AppTheme.slate600, fontSize: 12)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EventPin {
  _EventPin(this.label, this.age, this.color);

  final String label;
  double age;
  final Color color;
}

class _ScrubBar extends StatelessWidget {
  const _ScrubBar({
    required this.age,
    required this.onChanged,
    required this.pins,
    required this.onMovedPin,
  });

  final double age;
  final ValueChanged<double> onChanged;
  final List<_EventPin> pins;
  final void Function(_EventPin pin, double nextAge) onMovedPin;

  static const _minAge = 37.0;
  static const _maxAge = 90.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final w = c.maxWidth;
        double xForAge(double a) => ((a - _minAge) / (_maxAge - _minAge)).clamp(0.0, 1.0) * w;
        double ageForX(double x) => (_minAge + (x / w) * (_maxAge - _minAge)).clamp(_minAge, _maxAge);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  height: 54,
                  decoration: BoxDecoration(
                    color: AppTheme.slate50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.slate100),
                  ),
                ),
                Positioned(
                  left: xForAge(age).clamp(0.0, w - 28),
                  top: 10,
                  child: Container(
                    width: 28,
                    height: 34,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.slate100),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.drag_handle, color: AppTheme.slate600),
                  ),
                ),
                ...pins.map((p) {
                  final left = (xForAge(p.age) - 34).clamp(0.0, w - 68);
                  return Positioned(
                    left: left,
                    top: 6,
                    child: GestureDetector(
                      onPanUpdate: (d) {
                        final next = ageForX(xForAge(p.age) + d.delta.dx);
                        onMovedPin(p, next);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: p.color.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: p.color.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(color: p.color, shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              p.label,
                              style: TextStyle(color: p.color, fontWeight: FontWeight.w800, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
            const SizedBox(height: 10),
            Slider(
              min: _minAge,
              max: _maxAge,
              value: age,
              onChanged: onChanged,
              divisions: (_maxAge - _minAge).round(),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Text('37', style: TextStyle(color: AppTheme.slate600, fontSize: 12)),
                Text('90', style: TextStyle(color: AppTheme.slate600, fontSize: 12)),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _FanChartPainter extends CustomPainter {
  _FanChartPainter({required this.accent});

  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final bg = Paint()..color = AppTheme.slate50;
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(12)),
      bg,
    );

    // Fan “cloud”
    final cloud = Paint()
      ..shader = LinearGradient(
        begin: Alignment.bottomLeft,
        end: Alignment.topRight,
        colors: [
          accent.withValues(alpha: 0.20),
          accent.withValues(alpha: 0.03),
        ],
      ).createShader(rect);

    final baseY = size.height * 0.78;
    final path = Path()..moveTo(0, baseY);
    for (var i = 0; i <= 40; i++) {
      final t = i / 40.0;
      final x = t * size.width;
      final y = baseY - math.sin(t * math.pi) * (size.height * 0.45) - t * 14;
      path.lineTo(x, y);
    }
    for (var i = 40; i >= 0; i--) {
      final t = i / 40.0;
      final x = t * size.width;
      final y = baseY - math.sin(t * math.pi) * (size.height * 0.22) - t * 6;
      path.lineTo(x, y);
    }
    path.close();
    canvas.drawPath(path, cloud);

    // Median line
    final line = Paint()
      ..color = accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    final median = Path();
    for (var i = 0; i <= 40; i++) {
      final t = i / 40.0;
      final x = t * size.width;
      final y = baseY - math.sin(t * math.pi) * (size.height * 0.34) - t * 10;
      if (i == 0) {
        median.moveTo(x, y);
      } else {
        median.lineTo(x, y);
      }
    }
    canvas.drawPath(median, line);
  }

  @override
  bool shouldRepaint(covariant _FanChartPainter oldDelegate) => oldDelegate.accent != accent;
}

