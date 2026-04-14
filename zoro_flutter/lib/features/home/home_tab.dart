import 'package:flutter/material.dart';

import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    final name = session.userData?['name']?.toString();
    final email = session.userData?['email']?.toString();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          name != null && name.isNotEmpty ? 'Hi, $name' : 'Welcome back',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppTheme.slate900,
              ),
        ),
        if (email != null) ...[
          const SizedBox(height: 4),
          Text(email, style: const TextStyle(color: AppTheme.slate600)),
        ],
        const SizedBox(height: 24),
        Text(
          'Your snapshot',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        _DashCard(
          title: 'Goals & plan',
          subtitle: 'Use Plan to update Save, Invest, Insurance, and Tax.',
          onTap: () {},
        ),
        const SizedBox(height: 12),
        _DashCard(
          title: 'Cash flow',
          subtitle: 'Income and expenses live under Money.',
          onTap: () {},
        ),
        const SizedBox(height: 12),
        _DashCard(
          title: 'Retirement',
          subtitle: 'Long-term picture and buckets — Retire tab.',
          onTap: () {},
        ),
      ],
    );
  }
}

class _DashCard extends StatelessWidget {
  const _DashCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                  color: AppTheme.slate900,
                ),
              ),
              const SizedBox(height: 6),
              Text(subtitle, style: const TextStyle(color: AppTheme.slate600)),
            ],
          ),
        ),
      ),
    );
  }
}
