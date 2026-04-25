import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

class RetireTab extends StatelessWidget {
  const RetireTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Retire',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Retirement answers and expense buckets sync from the same user_data row as the web app.',
          style: TextStyle(color: AppTheme.slate600),
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: const Text(
              'Placeholder for retirement UI. Data wiring will come later (token → DB).',
              style: TextStyle(color: AppTheme.slate600),
            ),
          ),
        ),
      ],
    );
  }
}
