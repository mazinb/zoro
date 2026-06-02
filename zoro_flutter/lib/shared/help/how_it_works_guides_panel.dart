import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../widgets/liquid_glass.dart';

/// Per-tab ? visibility toggles, shown inside the how-it-works sheet.
class HowItWorksGuidesPanel extends StatelessWidget {
  const HowItWorksGuidesPanel({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return LiquidGlassPanel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'How-to guides',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            'Turn off to hide ? on that tab. Settings always keeps ? so you can change these.',
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
          ),
          const SizedBox(height: 4),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Ledger', style: TextStyle(fontWeight: FontWeight.w800)),
            value: model.guideEnabledLedger,
            onChanged: model.setGuideEnabledLedger,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Context', style: TextStyle(fontWeight: FontWeight.w800)),
            value: model.guideEnabledContext,
            onChanged: model.setGuideEnabledContext,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Goals', style: TextStyle(fontWeight: FontWeight.w800)),
            value: model.guideEnabledGoals,
            onChanged: model.setGuideEnabledGoals,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.w800)),
            value: model.guideEnabledSettings,
            onChanged: model.setGuideEnabledSettings,
          ),
        ],
      ),
    );
  }
}
