import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

class PlanTab extends StatelessWidget {
  const PlanTab({super.key});

  @override
  Widget build(BuildContext context) {
    const areas = [
      ('Save more', 'Coming soon'),
      ('Big purchase', 'Coming soon'),
      ('Invest', 'Coming soon'),
      ('Insurance', 'Coming soon'),
      ('Tax', 'Coming soon'),
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
          'These will reuse the same flows as the web app.',
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
                    SnackBar(content: Text('${a.$1}: coming soon')),
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
