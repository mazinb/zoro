import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';

/// Builds [GuidedMcqConfig] payloads for goal setup / review flows.
abstract final class GoalsPlannerConfig {
  static Map<String, Object?> _assetsGoalsPolicyPayload(AppModel m) => {
        'retirementExtraAssetIds': m.retirementExtraAssetIds.toList(),
        'investmentsToRetirement': true,
        'savingsToTargets': true,
      };

  static List<Map<String, Object?>> _assetsPayload(AppModel m) => [
        for (final a in m.assets)
          {
            'id': a.id,
            'type': a.type.apiValue,
            'name': a.name.trim().isEmpty ? a.type.label : a.name.trim(),
            'value': m.assetDisplayValue(a),
            'isPrimaryCash': m.isPrimaryCashAsset(a),
          },
      ];

  static List<Map<String, Object?>> _goalsPayload(AppModel m) => [
        for (final g in m.financialGoals)
          {
            'id': g.id,
            'kind': g.kind.apiValue,
            'name': g.name,
            'targetAmount': g.targetAmount,
            'targetDate': g.targetDate?.toUtc().toIso8601String(),
            'currentAmount': m.goalCurrentAmount(g),
            'savingsMonthly': m.savingsMonthlyForGoal(g),
            if (g.isRetirement) 'corpusAdjustment': g.corpusAdjustment,
            'contextMarkdown': g.contextMarkdown.trim(),
          },
      ];

  static GuidedMcqConfig forGoal({required AppModel model, required String goalId}) {
    final g = model.financialGoalById(goalId);
    final title = g == null
        ? 'Goal'
        : g.isRetirement
            ? 'Retirement'
            : (g.name.trim().isEmpty ? 'Target goal' : g.name.trim());

    return GuidedMcqConfig(
      internalAgentId: InternalAppAgentIds.goalsGuide,
      title: title,
      isTargetMissing: (_) => model.financialGoalById(goalId) == null,
      missingTargetMessage: 'This goal was removed.',
      buildPayload: (m, qa) {
        final goal = m.financialGoalById(goalId);
        return {
          'mode': 'single',
          'focusGoalId': goalId,
          'displayCurrency': m.displayCurrency.name,
          'privacyHideAmounts': m.privacyHideAmounts,
          'allocSavingsMonthly': m.allocSavingsMonthly,
          'assetsGoalsPolicy': _assetsGoalsPolicyPayload(m),
          'assets': _assetsPayload(m),
          'goals': _goalsPayload(m),
          if (goal != null) 'focusGoal': {
            'id': goal.id,
            'kind': goal.kind.apiValue,
            'name': goal.name,
            'targetAmount': goal.targetAmount,
            'targetDate': goal.targetDate?.toUtc().toIso8601String(),
            'contextMarkdown': goal.contextMarkdown.trim(),
          },
          'existingContextMarkdown': goal?.contextMarkdown.trim() ?? '',
          'qaHistory': qa,
        };
      },
    );
  }

  /// Split + retirement date when corpus and expenses are already set.
  static GuidedMcqConfig forRetirementPlan(AppModel model) {
    return GuidedMcqConfig(
      internalAgentId: InternalAppAgentIds.goalsGuide,
      title: 'Retirement plan',
      isTargetMissing: (_) => model.retirementGoal == null,
      missingTargetMessage: 'Retirement goal was removed.',
      buildPayload: (m, qa) {
        final r = m.retirementGoal!;
        return {
          'mode': 'retirement_plan',
          'focusGoalId': r.id,
          'displayCurrency': m.displayCurrency.name,
          'privacyHideAmounts': m.privacyHideAmounts,
          'availableAfterExpensesMonthly': m.availableAfterExpensesMonthly,
          'allocInvestFraction': m.allocInvestFraction,
          'allocInvestmentsMonthly': m.allocInvestmentsMonthly,
          'allocSavingsMonthly': m.allocSavingsMonthly,
          'assetsGoalsPolicy': _assetsGoalsPolicyPayload(m),
          'assets': _assetsPayload(m),
          'goals': _goalsPayload(m),
          'focusGoal': {
            'id': r.id,
            'kind': r.kind.apiValue,
            'targetAmount': r.targetAmount,
            'targetDate': r.targetDate?.toUtc().toIso8601String(),
            'safeWithdrawalRatePct': r.safeWithdrawalRatePct,
            'corpusBufferPct': r.corpusBufferPct,
          },
          'existingContextMarkdown': r.contextMarkdown.trim(),
          'qaHistory': qa,
        };
      },
    );
  }

  static GuidedMcqConfig forAllGoals(AppModel model) {
    return GuidedMcqConfig(
      internalAgentId: InternalAppAgentIds.goalsGuide,
      title: 'Set up goals',
      buildPayload: (m, qa) => {
        'mode': 'all',
        'displayCurrency': m.displayCurrency.name,
        'privacyHideAmounts': m.privacyHideAmounts,
        'allocSavingsMonthly': m.allocSavingsMonthly,
        'netWorthDisplay': m.netWorthDisplay,
        'assetsGoalsPolicy': _assetsGoalsPolicyPayload(m),
        'assets': _assetsPayload(m),
        'goals': _goalsPayload(m),
        'qaHistory': qa,
      },
    );
  }
}
