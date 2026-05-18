import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';
import '../../shared/guided_mcq/guided_mcq_page.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goals_apply_updates.dart';
import 'goals_expense_estimator_config.dart';

Future<void> openGoalExpenseEstimator({
  required BuildContext context,
  required AppModel model,
  required String goalId,
}) async {
  final res = await Navigator.of(context).push<GuidedMcqResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => GuidedMcqPage(
        model: model,
        config: GoalsExpenseEstimatorConfig.forGoal(model: model, goalId: goalId),
      ),
    ),
  );
  if (!context.mounted || res == null) return;
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => GoalsExpenseEstimatorReviewPage(
        model: model,
        goalId: goalId,
        result: res,
      ),
    ),
  );
}

class GoalsExpenseEstimatorReviewPage extends StatelessWidget {
  const GoalsExpenseEstimatorReviewPage({
    super.key,
    required this.model,
    required this.goalId,
    required this.result,
  });

  final AppModel model;
  final String goalId;
  final GuidedMcqResult result;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hide = model.privacyHideAmounts;
    final summary = result.structured['summary']?.toString().trim() ?? '';
    final bucketsRaw = result.structured['expenseBuckets'];
    final proposed = <String, double>{};
    if (bucketsRaw is Map) {
      for (final k in recurringExpenseBucketKeys) {
        final v = bucketsRaw[k];
        if (v is num) proposed[k] = v.toDouble();
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review expenses', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (summary.isNotEmpty)
            Text(summary, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
          const SizedBox(height: 16),
          Text('Bucket updates', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
          const SizedBox(height: 8),
          if (proposed.isEmpty)
            Text('No bucket changes proposed.', style: TextStyle(color: cs.onSurfaceVariant))
          else
            LiquidGlassPanel(
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  for (final e in proposed.entries)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              expenseBucketLabel(e.key),
                              style: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                          ),
                          Text(
                            _fmt(model, e.value, hide),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'was ${_fmt(model, model.expenseBuckets[e.key] ?? 0, hide)}',
                            style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: proposed.isEmpty
                ? null
                : () {
                    applyGoalExpenseEstimatorStructured(
                      model,
                      structured: result.structured,
                      contextMarkdown: result.contextMarkdown,
                      goalId: goalId,
                    );
                    model.recordInternalAgentRun(InternalAppAgentIds.goalsExpenseEstimator, result.structured);
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Expense estimates updated'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
            child: const Text('Apply to ledger'),
          ),
        ],
      ),
    );
  }

  String _fmt(AppModel m, double v, bool hide) {
    final s = formatCurrencyDisplay(v, currency: m.displayCurrency);
    return hide ? maskSensitiveNumberString(s) : s;
  }
}

String expenseBucketLabel(String key) {
  final preset = presetForCountry(AppModel.expensePresetCountry);
  return preset.buckets[key]?.label ?? key;
}
