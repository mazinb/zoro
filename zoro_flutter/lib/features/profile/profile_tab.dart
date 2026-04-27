import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Profile',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 16),
        ListTile(
          title: const Text('Account'),
          subtitle: const Text('Login disabled (UI pass)'),
        ),
        const SizedBox(height: 24),
        const Text(
          'Profile + account settings will land after the UI is stable.',
          style: TextStyle(color: AppTheme.slate600, fontSize: 13),
        ),
      ],
    );
  }
}
