import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';
import '../../shared/guided_mcq/guided_mcq_page.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_context_page.dart';
import 'goals_apply_updates.dart';
import 'goals_expense_estimator_flow.dart';
import 'goals_planner_config.dart';
import 'goals_retirement_corpus_flow.dart';

/// Entry: pick a goal (or all) → MCQ → review → apply.
Future<void> openGoalsGuideLauncher({
  required BuildContext context,
  required AppModel model,
  VoidCallback? onGoToSettingsGoals,
}) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    sizesToContent: true,
    builder: (ctx) => _GoalsGuideLauncherSheet(model: model, onGoToSettingsGoals: onGoToSettingsGoals),
  );
}

class _GoalsGuideLauncherSheet extends StatelessWidget {
  const _GoalsGuideLauncherSheet({required this.model, this.onGoToSettingsGoals});

  final AppModel model;
  final VoidCallback? onGoToSettingsGoals;

  Future<void> _run(BuildContext context, GuidedMcqConfig config, {String? focusGoalId}) async {
    Navigator.of(context).pop();
    final res = await Navigator.of(context).push<GuidedMcqResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => GuidedMcqPage(model: model, config: config),
      ),
    );
    if (!context.mounted || res == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (ctx) => GoalsGuideReviewPage(
          model: model,
          result: res,
          focusGoalId: focusGoalId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final retirement = model.retirementGoal;
    final targets = model.targetGoals;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Guide', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(
              'Short questions → review → update goals',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
            ),
            const SizedBox(height: 12),
            ListTile(
              leading: Icon(Icons.hub_outlined, color: model.accent),
              title: const Text('All goals', style: TextStyle(fontWeight: FontWeight.w800)),
              subtitle: const Text('Retirement + targets'),
              onTap: () => _run(context, GoalsPlannerConfig.forAllGoals(model)),
            ),
            if (retirement != null) ...[
              ListTile(
                leading: Icon(Icons.calculate_outlined, color: model.accent),
                title: const Text('Retirement corpus', style: TextStyle(fontWeight: FontWeight.w800)),
                subtitle: const Text('SWR, buffer, expenses'),
                onTap: () {
                  Navigator.of(context).pop();
                  openRetirementCorpusGuide(context: context, model: model);
                },
              ),
              ListTile(
                leading: Icon(Icons.beach_access_outlined, color: model.accent),
                title: const Text('Retirement guide', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () => _run(
                  context,
                  GoalsPlannerConfig.forGoal(model: model, goalId: retirement.id),
                  focusGoalId: retirement.id,
                ),
              ),
            ],
            for (final g in targets) ...[
              ListTile(
                leading: Icon(Icons.flag_outlined, color: model.accent),
                title: Text(
                  g.name.trim().isEmpty ? 'Target' : g.name.trim(),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: const Text('Goals guide'),
                onTap: () => _run(
                  context,
                  GoalsPlannerConfig.forGoal(model: model, goalId: g.id),
                  focusGoalId: g.id,
                ),
              ),
              ListTile(
                leading: Icon(Icons.receipt_long_outlined, color: model.accent),
                title: Text(
                  'Estimate expenses — ${g.name.trim().isEmpty ? 'Target' : g.name.trim()}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                onTap: () {
                  Navigator.of(context).pop();
                  openGoalExpenseEstimator(context: context, model: model, goalId: g.id);
                },
              ),
            ],
            if (retirement != null)
              ListTile(
                leading: Icon(Icons.receipt_long_outlined, color: model.accent),
                title: const Text('Estimate expenses — Retirement', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.of(context).pop();
                  openGoalExpenseEstimator(context: context, model: model, goalId: retirement.id);
                },
              ),
            if (onGoToSettingsGoals != null)
              TextButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  onGoToSettingsGoals!();
                },
                icon: const Icon(Icons.tune, size: 18),
                label: const Text('Edit guide prompts', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
          ],
        ),
      ),
    );
  }
}

class GoalsGuideReviewPage extends StatelessWidget {
  const GoalsGuideReviewPage({
    super.key,
    required this.model,
    required this.result,
    this.focusGoalId,
  });

  final AppModel model;
  final GuidedMcqResult result;
  final String? focusGoalId;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final summary = result.structured['summary']?.toString().trim() ?? '';
    final md = result.contextMarkdown.trim();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (summary.isNotEmpty) ...[
            Text(summary, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
            const SizedBox(height: 16),
          ],
          Text('Context note', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
          const SizedBox(height: 8),
          LiquidGlassPanel(
            padding: const EdgeInsets.all(14),
            child: Text(
              md.isEmpty ? '—' : md,
              style: TextStyle(color: cs.onSurfaceVariant, height: 1.35, fontSize: 13),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              applyGoalsGuideContext(
                model,
                contextMarkdown: md,
                structured: result.structured,
                focusGoalId: focusGoalId,
              );
              model.recordInternalAgentRun(
                InternalAppAgentIds.goalsGuide,
                result.structured,
              );
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Goals updated'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            child: const Text('Apply'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () {
              final id = focusGoalId ?? result.structured['contextGoalId']?.toString();
              if (id == null || id.isEmpty) return;
              applyGoalsGuideContext(
                model,
                contextMarkdown: md,
                structured: result.structured,
                focusGoalId: id,
              );
              Navigator.of(context).push<void>(
                MaterialPageRoute(builder: (ctx) => GoalContextPage(model: model, goalId: id)),
              );
            },
            child: const Text('Apply & edit note'),
          ),
        ],
      ),
    );
  }
}
