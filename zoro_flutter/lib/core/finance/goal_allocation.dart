import '../state/financial_goals.dart';
import 'goals_calculator.dart';

class GoalAllocationInput {
  const GoalAllocationInput({
    required this.id,
    required this.requiredMonthly,
  });

  final String id;
  final double requiredMonthly;
}

class LiabilityAllocationInput {
  const LiabilityAllocationInput({
    required this.id,
    required this.interestRatePct,
    required this.balance,
  });

  final String id;
  final double interestRatePct;
  final double balance;
}

/// Deficit-weighted savings weights for **target goals only** (not normalized).
Map<String, double> computeDeficitSavingsWeights({
  required List<GoalAllocationInput> goals,
}) {
  if (goals.isEmpty) return {};
  var sum = 0.0;
  for (final g in goals) {
    sum += g.requiredMonthly.clamp(0, double.infinity);
  }
  if (sum <= 0) {
    final even = 1.0 / goals.length;
    return {for (final g in goals) g.id: even};
  }
  return {
    for (final g in goals)
      g.id: g.requiredMonthly.clamp(0, double.infinity) / sum,
  };
}

/// Interest-weighted shares of savings flow for liability paydown.
Map<String, double> computeLiabilityPaydownShares({
  required List<LiabilityAllocationInput> liabilities,
}) {
  if (liabilities.isEmpty) return {};
  final active = liabilities.where((l) => l.balance > 0 && l.interestRatePct > 0).toList();
  if (active.isEmpty) {
    final withBalance = liabilities.where((l) => l.balance > 0).toList();
    if (withBalance.isEmpty) return {};
    final even = 1.0 / withBalance.length;
    return {for (final l in withBalance) l.id: even};
  }
  var sum = 0.0;
  for (final l in active) {
    sum += l.interestRatePct;
  }
  return {for (final l in active) l.id: l.interestRatePct / sum};
}

List<GoalAllocationInput> buildTargetAllocationInputs({
  required List<FinancialGoal> targets,
  required double Function(FinancialGoal goal) currentFor,
  required double Function(FinancialGoal goal) effectiveTargetFor,
  DateTime? now,
}) {
  return [
    for (final g in targets)
      GoalAllocationInput(
        id: g.id,
        requiredMonthly: goalRequiredMonthlySavings(
          goal: g,
          currentAmount: currentFor(g),
          effectiveTarget: effectiveTargetFor(g),
          now: now,
        ),
      ),
  ];
}

/// Monthly savings left for targets after high-interest debt gets its share.
double savingsForTargetsAfterLiabilities({
  required double allocSavingsMonthly,
  required List<LiabilityAllocationInput> liabilities,
  double liabilityPaydownCapFraction = 0.5,
}) {
  if (allocSavingsMonthly <= 0 || liabilities.isEmpty) return allocSavingsMonthly;
  final shares = computeLiabilityPaydownShares(liabilities: liabilities);
  if (shares.isEmpty) return allocSavingsMonthly;
  final cap = allocSavingsMonthly * liabilityPaydownCapFraction.clamp(0.0, 1.0);
  return (allocSavingsMonthly - cap).clamp(0, allocSavingsMonthly);
}

/// Unallocated savings monthly after active targets are funded (can supplement retirement).
double savingsOverflowToRetirement({
  required double allocSavingsMonthly,
  required double totalTargetRequiredMonthly,
}) {
  return (allocSavingsMonthly - totalTargetRequiredMonthly).clamp(0, double.infinity);
}
