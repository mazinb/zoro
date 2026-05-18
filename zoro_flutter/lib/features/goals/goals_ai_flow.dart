import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';
import '../../shared/guided_mcq/guided_mcq_page.dart';
import 'goals_expense_estimator_flow.dart';
import 'goals_guide_flow.dart';
import 'goals_planner_config.dart';
import 'goals_retirement_corpus_flow.dart';

/// Routes the Goals AI button: expenses → corpus → monthly split / retirement date.
Future<void> openGoalsAiAssistant({
  required BuildContext context,
  required AppModel model,
  VoidCallback? onOpenSettings,
}) async {
  final ready = await model.prepareLlmForAssistant();
  if (!context.mounted) return;
  if (!ready) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(model.llmAssistantUnavailableMessage),
        behavior: SnackBarBehavior.floating,
        action: onOpenSettings == null
            ? null
            : SnackBarAction(label: 'Settings', onPressed: onOpenSettings),
      ),
    );
    return;
  }

  model.ensureRetirementGoal();
  final retirement = model.retirementGoal;
  if (retirement == null) return;

  if (_needsExpenseSetup(model)) {
    await openGoalExpenseEstimator(context: context, model: model, goalId: retirement.id);
    return;
  }

  model.syncRetirementCorpusTarget(notify: false);
  if (_needsCorpusSetup(model, retirement.id)) {
    await openRetirementCorpusGuide(context: context, model: model);
    return;
  }

  final res = await Navigator.of(context).push<GuidedMcqResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => GuidedMcqPage(
        model: model,
        config: GoalsPlannerConfig.forRetirementPlan(model),
      ),
    ),
  );
  if (!context.mounted || res == null) return;
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => GoalsGuideReviewPage(
        model: model,
        result: res,
        focusGoalId: retirement.id,
      ),
    ),
  );
}

bool _needsExpenseSetup(AppModel model) =>
    !model.userTouchedExpenses || model.recurringExpensesMonthly <= 0;

bool _needsCorpusSetup(AppModel model, String retirementId) {
  final r = model.financialGoalById(retirementId);
  if (r == null) return true;
  return model.goalEffectiveTargetAmount(r) <= 0;
}
