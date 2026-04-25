import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

class PlanTab extends StatelessWidget {
  const PlanTab({super.key});

  @override
  Widget build(BuildContext context) {
    const areas = [
      ('Save more', 'Match web /save — coming next.'),
      ('Big purchase', 'Match web /home — coming next.'),
      ('Invest', 'Match web /invest — coming next.'),
      ('Insurance', 'Match web /insurance — coming next.'),
      ('Tax', 'Match web /tax — coming next.'),
    ];

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Plan',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Each area will reuse the same /api/user-data flows as the web app.',
          style: TextStyle(color: AppTheme.slate600),
        ),
        const SizedBox(height: 20),
        ...areas.map(
          (a) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: ListTile(
                title: Text(a.$1),
                subtitle: Text(a.$2),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('${a.$1} — scaffold only in v1')),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}
