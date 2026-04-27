import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

class SandboxTab extends StatefulWidget {
  const SandboxTab({super.key, required this.model});

  final AppModel model;

  @override
  State<SandboxTab> createState() => _SandboxTabState();
}

class _SandboxTabState extends State<SandboxTab> {
  double _marketReturn = 0.07;
  double _inflation = 0.03;
  double _spendChange = 0.00;

  String _impactLine = 'Adjust a lever to see impact';

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Row(
              children: [
                Text(
                  'Sandbox',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const Spacer(),
                FilledButton.icon(
                  onPressed: _openLevers,
                  icon: const Icon(Icons.tune),
                  label: const Text('Levers'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _ScenarioCard(title: 'Current plan', subtitle: 'Baseline', accent: widget.model.accent)),
                const SizedBox(width: 12),
                Expanded(
                  child: _ScenarioCard(
                    title: 'Move to Portugal',
                    subtitle: 'Lower spend, higher uncertainty',
                    accent: widget.model.accent,
                    variant: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('Lab notes', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    SizedBox(height: 6),
                    Text(
                      'Every tweak should propagate instantly through the app state (UI-first mock right now).',
                      style: TextStyle(color: AppTheme.slate600),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        Positioned(
          right: 16,
          top: 16,
          child: _ImpactHud(text: _impactLine, accent: widget.model.accent),
        ),
      ],
    );
  }

  void _openLevers() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Levers',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              _Lever(
                label: 'Market return (%)',
                value: _marketReturn,
                min: 0.02,
                max: 0.10,
                onChanged: (v) {
                  setState(() => _marketReturn = v);
                  _setImpact('Market return ${(v * 100).toStringAsFixed(1)}% → Retirement delayed by ${_yearsFromReturn(v)} years.');
                },
              ),
              _Lever(
                label: 'Inflation rate (%)',
                value: _inflation,
                min: 0.00,
                max: 0.08,
                onChanged: (v) {
                  setState(() => _inflation = v);
                  _setImpact('Inflation ${(v * 100).toStringAsFixed(1)}% → WealthScore -${_scoreHitFromInflation(v)}.');
                },
              ),
              _Lever(
                label: 'Annual spend change (+/- %)',
                value: _spendChange,
                min: -0.10,
                max: 0.10,
                onChanged: (v) {
                  setState(() => _spendChange = v);
                  final sign = v >= 0 ? '+' : '';
                  _setImpact('Spend $sign${(v * 100).toStringAsFixed(1)}% → Scenario preview updates.');
                },
              ),
              const SizedBox(height: 10),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Done'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _setImpact(String s) {
    setState(() => _impactLine = s);
  }

  int _yearsFromReturn(double r) {
    if (r >= 0.07) return 0;
    return ((0.07 - r) * 100).round();
  }

  int _scoreHitFromInflation(double i) {
    return ((i - 0.03).clamp(0.0, 0.08) * 180).round();
  }
}

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard({
    required this.title,
    required this.subtitle,
    required this.accent,
    this.variant = false,
  });

  final String title;
  final String subtitle;
  final Color accent;
  final bool variant;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: variant ? 0.08 : 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    variant ? Icons.science_outlined : Icons.check_circle_outline,
                    color: accent,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(subtitle, style: const TextStyle(color: AppTheme.slate600)),
            const SizedBox(height: 12),
            Container(
              height: 84,
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppTheme.slate50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.slate100),
              ),
              child: const Center(
                child: Text(
                  'Scenario preview',
                  style: TextStyle(color: AppTheme.slate600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Lever extends StatelessWidget {
  const _Lever({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800))),
              Text(value.isNegative ? value.toStringAsFixed(3) : value.toStringAsFixed(3)),
            ],
          ),
          Slider(min: min, max: max, value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

class _ImpactHud extends StatelessWidget {
  const _ImpactHud({required this.text, required this.accent});

  final String text;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 240),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.slate100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 10,
            height: 10,
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: AppTheme.slate600, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

