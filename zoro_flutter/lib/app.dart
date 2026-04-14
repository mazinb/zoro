import 'package:flutter/material.dart';

import 'core/api/zoro_api.dart';
import 'core/session/session_controller.dart';
import 'features/onboarding/onboarding_page.dart';
import 'features/shell/main_scaffold.dart';
import 'shared/theme/app_theme.dart';

class ZoroApp extends StatefulWidget {
  const ZoroApp({super.key, required this.session});

  final SessionController session;

  @override
  State<ZoroApp> createState() => _ZoroAppState();
}

class _ZoroAppState extends State<ZoroApp> {
  @override
  void initState() {
    super.initState();
    widget.session.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Zoro',
      theme: AppTheme.light,
      home: ListenableBuilder(
        listenable: widget.session,
        builder: (context, _) {
          if (widget.session.loading) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          if (!widget.session.isSignedIn) {
            return OnboardingPage(session: widget.session);
          }
          return MainScaffold(session: widget.session);
        },
      ),
    );
  }
}

/// Root wiring for `main.dart` tests and app entry.
SessionController createDefaultSession() {
  return SessionController(api: ZoroApi());
}
