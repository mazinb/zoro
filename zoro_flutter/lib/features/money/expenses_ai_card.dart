import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

class ExpensesAiCard extends StatelessWidget {
  const ExpensesAiCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'AI statement import',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Disabled for UI-first build. We’ll re-enable this once token auth + DB wiring is back.',
              style: TextStyle(color: AppTheme.slate600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: null,
              icon: const Icon(Icons.upload_file),
              label: const Text('Coming soon'),
            ),
          ],
        ),
      ),
    );
  }
}
