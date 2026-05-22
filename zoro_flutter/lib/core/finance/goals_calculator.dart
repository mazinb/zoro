import 'dart:math' as math;

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

/// Half-point steps (1.0, 1.5, … 10.0) — slider and year shifts use this ladder.
double quantizeWithdrawalRatePct(double pct) =>
    (clampWithdrawalRatePct(pct) * 2).round() / 2;

int withdrawalRateStepIndex(double pct) =>
    ((quantizeWithdrawalRatePct(pct) - 1) * 2).round().clamp(0, 18);

double withdrawalRateFromStep(int step) =>
    quantizeWithdrawalRatePct(1 + step * 0.5);

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
  var base = goal.targetAmount;
  if (goal.isRetirement && goal.corpusAutoFromExpenses) {
    return computeRetirementCorpus(
      recurringExpensesMonthly: recurringExpensesMonthly,
      safeWithdrawalRatePct: goal.safeWithdrawalRatePct,
      corpusBufferPct: goal.corpusBufferPct,
    );
  }
  return base;
}

double monthlyRateFromAnnualPct(double annualReturnPct) => annualReturnPct / 100 / 12;

/// Future value of [months] monthly invest contributions at [annualReturnPct].
double futureValueOfMonthlyContributions({
  required double monthlyPayment,
  required double annualReturnPct,
  required int months,
}) {
  if (months <= 0 || monthlyPayment <= 0) return 0;
  final r = monthlyRateFromAnnualPct(annualReturnPct);
  if (r.abs() < 1e-12) return monthlyPayment * months;
  final factor = math.pow(1 + r, months);
  return monthlyPayment * (factor - 1) / r;
}

/// Months until [target] from [current] with monthly [monthlyPayment] and [annualReturnPct].
int? monthsToReachTargetWithContributions({
  required double current,
  required double target,
  required double monthlyPayment,
  required double annualReturnPct,
  int maxMonths = 6000,
}) {
  if (target <= current + 0.5) return 0;
  if (monthlyPayment <= 0.5) return null;
  final r = monthlyRateFromAnnualPct(annualReturnPct);
  var balance = current;
  for (var m = 0; m < maxMonths; m++) {
    if (balance >= target - 0.5) return m;
    balance = balance * (1 + r) + monthlyPayment;
  }
  return null;
}

/// Monthly invest needed to reach [target] from [current] in [months] at [annualReturnPct].
double requiredMonthlyToReachTarget({
  required double current,
  required double target,
  required int months,
  required double annualReturnPct,
}) {
  if (target <= current + 0.5) return 0;
  if (months <= 0) return (target - current).clamp(0, double.infinity);
  final r = monthlyRateFromAnnualPct(annualReturnPct);
  final factor = math.pow(1 + r, months);
  final futureCurrent = current * factor;
  if (target <= futureCurrent + 0.5) return 0;
  if (r.abs() < 1e-12) return (target - futureCurrent) / months;
  return (target - futureCurrent) * r / (factor - 1);
}

/// Shifts retire-by calendar date only (corpus stays fixed).
DateTime shiftRetirementTargetDate({
  required DateTime baseDate,
  required int yearsDelta,
}) =>
    DateTime(baseDate.year + yearsDelta, baseDate.month, baseDate.day);

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
