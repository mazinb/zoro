import 'package:flutter/material.dart';

import '../../core/app_env.dart';
import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key, required this.session});

  final SessionController session;

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
        if (session.userData?['email'] != null)
          ListTile(
            title: const Text('Signed in as'),
            subtitle: Text(session.userData!['email'].toString()),
          ),
        ListTile(
          title: const Text('API'),
          subtitle: Text(AppEnv.apiBaseUrl),
        ),
        ListTile(
          title: const Text('Refresh from server'),
          trailing: const Icon(Icons.refresh),
          onTap: () async {
            await session.refreshUser();
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Profile refreshed')),
              );
            }
          },
        ),
        ListTile(
          title: const Text('Sign out'),
          trailing: const Icon(Icons.logout),
          onTap: () => session.signOut(),
        ),
        const SizedBox(height: 24),
        const Text(
          'Session is stored securely on this device. Sign out clears the session; your email may stay filled in on the sign-in screen for convenience.',
          style: TextStyle(color: AppTheme.slate600, fontSize: 13),
        ),
      ],
    );
  }
}
