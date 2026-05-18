import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';

abstract final class GoalsRetirementCorpusConfig {
  static GuidedMcqConfig forRetirement(AppModel model) {
    final r = model.retirementGoal;
    final goalId = r?.id ?? '';
    return GuidedMcqConfig(
      internalAgentId: InternalAppAgentIds.goalsRetirementCorpus,
      title: 'Retirement corpus',
      isTargetMissing: (_) => model.retirementGoal == null,
      missingTargetMessage: 'Retirement goal not found.',
      buildPayload: (m, qa) {
        final ret = m.retirementGoal;
        final preview = ret != null
            ? computeRetirementCorpus(
                recurringExpensesMonthly: m.recurringExpensesMonthly,
                safeWithdrawalRatePct: ret.safeWithdrawalRatePct,
                corpusBufferPct: ret.corpusBufferPct,
              )
            : 0.0;
        return {
          'displayCurrency': m.displayCurrency.name,
          'privacyHideAmounts': m.privacyHideAmounts,
          'recurringExpensesMonthly': m.recurringExpensesMonthly,
          'focusGoalId': goalId,
          'safeWithdrawalRatePct': ret?.safeWithdrawalRatePct ?? 4,
          'corpusBufferPct': ret?.corpusBufferPct ?? 0,
          'corpusAutoFromExpenses': ret?.corpusAutoFromExpenses ?? true,
          'computedCorpusPreview': preview,
          'existingContextMarkdown': ret?.contextMarkdown.trim() ?? '',
          'qaHistory': qa,
        };
      },
    );
  }
}
