import '../state/financial_goals.dart';

enum GoalFeasibilityLevel { ok, caution, broken }

class GoalFeasibility {
  const GoalFeasibility({
    required this.level,
    required this.title,
    required this.detail,
    this.needsDateAdjust = false,
  });

  final GoalFeasibilityLevel level;
  final String title;
  final String detail;

  /// True when raising the invest slider cannot close the gap (adjust date/corpus).
  final bool needsDateAdjust;

  bool get isOk => level == GoalFeasibilityLevel.ok;
}

int? goalMonthsRemaining(DateTime? target, {DateTime? now}) {
  if (target == null) return null;
  final n = now ?? DateTime.now();
  return (target.year - n.year) * 12 + (target.month - n.month);
}

double clampWithdrawalRatePct(double pct) => pct.clamp(1.0, 10.0);

double clampCorpusBufferPct(double pct) => pct.clamp(0.0, 100.0);

/// Retirement corpus from recurring monthly expenses, SWR, and buffer.
double computeRetirementCorpus({
  required double recurringExpensesMonthly,
  required double safeWithdrawalRatePct,
  required double corpusBufferPct,
}) {
  final swr = clampWithdrawalRatePct(safeWithdrawalRatePct);
  final buffer = clampCorpusBufferPct(corpusBufferPct);
  final annualSpend = recurringExpensesMonthly * 12;
  if (annualSpend <= 0 || swr <= 0) return 0;
  final base = annualSpend / (swr / 100);
  return base * (1 + buffer / 100);
}

double goalEffectiveTarget({
  required FinancialGoal goal,
  required double recurringExpensesMonthly,
}) {
  if (goal.isRetirement && goal.corpusAutoFromExpenses) {
    return computeRetirementCorpus(
      recurringExpensesMonthly: recurringExpensesMonthly,
      safeWithdrawalRatePct: goal.safeWithdrawalRatePct,
      corpusBufferPct: goal.corpusBufferPct,
    );
  }
  return goal.targetAmount;
}

double goalRequiredMonthlySavings({
  required FinancialGoal goal,
  required double currentAmount,
  required double effectiveTarget,
  DateTime? now,
}) {
  final gap = (effectiveTarget - currentAmount).clamp(0, double.infinity);
  if (gap <= 0) return 0;
  final months = goalMonthsRemaining(goal.targetDate, now: now);
  if (months == null) return 0;
  final denom = months <= 0 ? 1 : months;
  return gap / denom;
}

GoalFeasibility assessGoalFeasibility({
  required double requiredMonthly,
  required double allocatedMonthly,
  required int? monthsRemaining,
  required double totalSavingsMonthly,
  String goalLabel = 'Goal',
  String Function(double amount)? formatAmount,
}) {
  String fmt(double v) => formatAmount?.call(v) ?? v.toStringAsFixed(0);
  final gap = requiredMonthly - allocatedMonthly;

  if (monthsRemaining != null && monthsRemaining <= 0 && requiredMonthly > 0) {
    return GoalFeasibility(
      level: GoalFeasibilityLevel.broken,
      title: 'Past due',
      detail: 'Move the date or add more per month.',
    );
  }

  if (totalSavingsMonthly <= 0 && requiredMonthly > 0.5) {
    return GoalFeasibility(
      level: GoalFeasibilityLevel.broken,
      title: 'No monthly flow',
      detail: 'Adjust the split slider above.',
    );
  }

  if (requiredMonthly <= 0.5) {
    return const GoalFeasibility(
      level: GoalFeasibilityLevel.ok,
      title: 'On track',
      detail: '',
    );
  }

  if (requiredMonthly > totalSavingsMonthly * 1.02) {
    return GoalFeasibility(
      level: GoalFeasibilityLevel.broken,
      title: 'Short',
      detail: 'Need ${fmt(requiredMonthly)}/mo · have ${fmt(totalSavingsMonthly)}/mo',
    );
  }

  final ratio = allocatedMonthly / requiredMonthly;
  if (ratio >= 0.95) {
    return const GoalFeasibility(
      level: GoalFeasibilityLevel.ok,
      title: 'On track',
      detail: '',
    );
  }
  if (ratio >= 0.70) {
    return GoalFeasibility(
      level: GoalFeasibilityLevel.caution,
      title: 'Tight',
      detail: gap > 0 ? 'Short ${fmt(gap)}/mo' : 'Raise this goal’s share',
    );
  }

  return GoalFeasibility(
    level: GoalFeasibilityLevel.broken,
    title: 'Short',
    detail: '${fmt(allocatedMonthly)}/mo of ${fmt(requiredMonthly)}/mo',
  );
}

GoalFeasibility mergePlanFeasibility(Iterable<GoalFeasibility> items) {
  GoalFeasibility? worst;
  for (final f in items) {
    if (worst == null) {
      worst = f;
      continue;
    }
    final rank = switch (f.level) {
      GoalFeasibilityLevel.broken => 2,
      GoalFeasibilityLevel.caution => 1,
      GoalFeasibilityLevel.ok => 0,
    };
    final worstRank = switch (worst.level) {
      GoalFeasibilityLevel.broken => 2,
      GoalFeasibilityLevel.caution => 1,
      GoalFeasibilityLevel.ok => 0,
    };
    if (rank > worstRank) worst = f;
  }
  return worst ??
      const GoalFeasibility(
        level: GoalFeasibilityLevel.ok,
        title: 'On track',
        detail: '',
      );
}

/// Elapsed fraction of timeline from [timelineStart] to [targetDate] (0–1).
double? goalTimeProgressFraction({
  required DateTime? timelineStart,
  required DateTime? targetDate,
  DateTime? now,
}) {
  if (timelineStart == null || targetDate == null) return null;
  final n = now ?? DateTime.now();
  final start = DateTime(timelineStart.year, timelineStart.month, timelineStart.day);
  final end = DateTime(targetDate.year, targetDate.month, targetDate.day);
  final today = DateTime(n.year, n.month, n.day);
  if (!end.isAfter(start)) return null;
  if (!today.isAfter(start)) return 0;
  if (!today.isBefore(end)) return 1;
  final total = end.difference(start).inDays;
  final elapsed = today.difference(start).inDays;
  if (total <= 0) return null;
  return (elapsed / total).clamp(0.0, 1.0);
}
