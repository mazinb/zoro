import 'package:flutter/material.dart';

import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';

class RetireTab extends StatelessWidget {
  const RetireTab({super.key, required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    final buckets = session.userData?['retirement_expense_buckets'];

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
            child: buckets == null
                ? const Text(
                    'No retirement bucket data loaded yet. Complete the flow on web or add forms here next.',
                    style: TextStyle(color: AppTheme.slate600),
                  )
                : Text(
                    buckets.toString(),
                    style: const TextStyle(fontSize: 12, color: AppTheme.slate600),
                  ),
          ),
        ),
      ],
    );
  }
}
