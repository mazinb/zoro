import '../../core/constants/web_expenses_income.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';

abstract final class GoalsExpenseEstimatorConfig {
  static GuidedMcqConfig forGoal({required AppModel model, required String goalId}) {
    final g = model.financialGoalById(goalId);
    final title = g == null
        ? 'Estimate expenses'
        : g.isRetirement
            ? 'Retirement expenses'
            : (g.name.trim().isEmpty ? 'Goal expenses' : '${g.name.trim()} expenses');

    return GuidedMcqConfig(
      internalAgentId: InternalAppAgentIds.goalsExpenseEstimator,
      title: title,
      isTargetMissing: (_) => model.financialGoalById(goalId) == null,
      missingTargetMessage: 'This goal was removed.',
      buildPayload: (m, qa) {
        final goal = m.financialGoalById(goalId);
        final buckets = <String, Object?>{};
        for (final k in recurringExpenseBucketKeys) {
          buckets[k] = m.expenseBuckets[k] ?? 0;
        }
        return {
          'focusGoalId': goalId,
          'goalKind': goal?.kind.apiValue,
          'goalName': goal?.name ?? '',
          'displayCurrency': m.displayCurrency.name,
          'privacyHideAmounts': m.privacyHideAmounts,
          'recurringExpensesMonthly': m.recurringExpensesMonthly,
          'expenseBuckets': buckets,
          'bucketKeys': recurringExpenseBucketKeys,
          'existingContextMarkdown': goal?.contextMarkdown.trim() ?? '',
          'qaHistory': qa,
        };
      },
    );
  }
}
