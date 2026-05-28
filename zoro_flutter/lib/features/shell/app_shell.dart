import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../onboarding/onboarding_flow_page.dart';
import 'main_scaffold.dart';

/// Root shell: main tabs after onboarding, or first-run setup.
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.model});

  final AppModel model;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        if (!widget.model.bootstrapped) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (!widget.model.onboardingComplete) {
          return OnboardingFlowPage(
            model: widget.model,
            onComplete: () {
              if (mounted) setState(() {});
            },
          );
        }
        return MainScaffold(model: widget.model);
      },
    );
  }
}
