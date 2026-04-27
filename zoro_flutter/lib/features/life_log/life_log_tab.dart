import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

class LifeLogTab extends StatelessWidget {
  const LifeLogTab({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    final past = const [
      _Milestone('MBA completed', '2016', done: true),
      _Milestone('First \$100k saved', '2019', done: true),
      _Milestone('First \$1M saved', '2025', done: true),
    ];
    final future = const [
      _Milestone('Coast FIRE', '2033'),
      _Milestone('House paid off', '2038'),
      _Milestone('Retire', '2054'),
    ];

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Life Log',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w900,
              ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Roadmap', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 10),
                ...past.map((m) => _QuestRow(m: m, accent: model.accent)),
                ...future.map((m) => _QuestRow(m: m, accent: model.accent)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Stress tests', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Tap a button to run a scenario (UI-first mock).',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 14),
                GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _StressButton(
                      title: 'The Black Swan',
                      subtitle: '40% crash',
                      icon: Icons.warning_amber,
                      accent: model.accent,
                      onTap: () {},
                    ),
                    _StressButton(
                      title: 'The Long Life',
                      subtitle: 'Live to 110',
                      icon: Icons.favorite,
                      accent: model.accent,
                      onTap: () {},
                    ),
                    _StressButton(
                      title: 'Career Pivot',
                      subtitle: '0% income (2y)',
                      icon: Icons.work_off,
                      accent: model.accent,
                      onTap: () {},
                    ),
                    _StressButton(
                      title: 'Recovery',
                      subtitle: 'Back to plan',
                      icon: Icons.restart_alt,
                      accent: model.accent,
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Share graphic (placeholder)')),
                    );
                  },
                  icon: const Icon(Icons.ios_share),
                  label: const Text('Share my trajectory'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Milestone {
  const _Milestone(this.title, this.when, {this.done = false});

  final String title;
  final String when;
  final bool done;
}

class _QuestRow extends StatelessWidget {
  const _QuestRow({required this.m, required this.accent});

  final _Milestone m;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final dotColor = m.done ? AppTheme.slate500.withValues(alpha: 0.55) : accent;
    final textColor = m.done ? AppTheme.slate600.withValues(alpha: 0.8) : AppTheme.slate900;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              Container(
                width: 2,
                height: 34,
                margin: const EdgeInsets.only(top: 6),
                color: AppTheme.slate100,
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.slate100),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.title, style: TextStyle(fontWeight: FontWeight.w900, color: textColor)),
                        const SizedBox(height: 4),
                        Text(m.when, style: const TextStyle(color: AppTheme.slate600)),
                      ],
                    ),
                  ),
                  Icon(
                    m.done ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: dotColor,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StressButton extends StatelessWidget {
  const _StressButton({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: accent),
              ),
              const Spacer(),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(color: AppTheme.slate600)),
            ],
          ),
        ),
      ),
    );
  }
}

