import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../help/how_it_works_page.dart';
import '../help/tab_help_content.dart';
import 'liquid_glass.dart';

/// Title row actions: optional ✨ assistant + optional ? how-it-works (Home has neither).
class TabHeaderActions extends StatelessWidget {
  const TabHeaderActions({
    super.key,
    required this.model,
    this.help,
    this.onAssistant,
    this.assistantRunning = false,
    this.assistantTooltip = 'Assistant',
  });

  final AppModel model;
  final HowItWorksContent? help;
  final VoidCallback? onAssistant;
  final bool assistantRunning;
  final String assistantTooltip;

  @override
  Widget build(BuildContext context) {
    final accent = model.accent;
    final showHelp = help != null;
    final showAssistant = onAssistant != null;
    final showDummy = showAssistant && model.dummyDataActive && model.dummyDataPristine;

    if (!showHelp && !showAssistant) return const SizedBox.shrink();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showHelp)
          IconButton.filledTonal(
            onPressed: () => openHowItWorksPage(context, help!),
            icon: const Icon(Icons.help_outline),
            tooltip: 'How it works',
            style: IconButton.styleFrom(
              backgroundColor: model.accentSoft,
              foregroundColor: accent,
            ),
          ),
        if (showHelp && showAssistant) const SizedBox(width: 10),
        if (showAssistant)
          IconButton.filledTonal(
            onPressed: assistantRunning
                ? null
                : (showDummy
                    ? () => _openDummyDataSheet(context, model: model)
                    : onAssistant),
            icon: assistantRunning
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2, color: accent),
                  )
                : Icon(showDummy ? Icons.bolt_outlined : Icons.auto_awesome),
            tooltip: showDummy ? 'Demo data' : assistantTooltip,
            style: IconButton.styleFrom(
              backgroundColor: model.accentSoft,
              foregroundColor: accent,
            ),
          ),
      ],
    );
  }
}

Future<void> _openDummyDataSheet(BuildContext context, {required AppModel model}) async {
  await showLiquidGlassModalBottomSheet<void>(
    context: context,
    sizesToContent: true,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Demo data', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 6),
          Text(
            'You have seeded demo cash-flow months. You can clear them anytime as long as you haven’t edited them.',
            style: TextStyle(color: Theme.of(ctx).colorScheme.onSurfaceVariant, height: 1.35),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () {
              model.clearDummyDataIfUntouched();
              Navigator.of(ctx).pop();
            },
            child: const Text('Clear demo data'),
          ),
        ],
      ),
    ),
  );
}
