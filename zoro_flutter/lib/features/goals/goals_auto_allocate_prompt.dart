import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';

/// Offers to run deficit-weighted savings allocation after adding a target.
Future<void> maybePromptAutoAllocateGoals({
  required BuildContext context,
  required AppModel model,
}) async {
  if (!model.promptAutoAllocateOnNewGoal) return;
  final run = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Auto-allocate savings?', style: TextStyle(fontWeight: FontWeight.w900)),
      content: const Text(
        'Split your monthly savings across goals based on how much each target still needs per month.',
        style: TextStyle(height: 1.35),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Skip')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Allocate')),
      ],
    ),
  );
  if (run == true) model.autoAllocateGoalSavingsWeights();
}
