import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/goal_allocation.dart';
import 'package:zoro_flutter/core/finance/goals_calculator.dart';
import 'package:zoro_flutter/core/state/financial_goals.dart';

void main() {
  group('computeRetirementCorpus', () {
    test('uses annual spend, SWR, and buffer', () {
      // 5000/mo => 60k/yr; 4% SWR => 1.5M; +10% buffer => 1.65M
      final c = computeRetirementCorpus(
        recurringExpensesMonthly: 5000,
        safeWithdrawalRatePct: 4,
        corpusBufferPct: 10,
      );
      expect(c, closeTo(1650000, 1));
    });

    test('clamps SWR to 1-10%', () {
      final low = computeRetirementCorpus(
        recurringExpensesMonthly: 1000,
        safeWithdrawalRatePct: 0.5,
        corpusBufferPct: 0,
      );
      final high = computeRetirementCorpus(
        recurringExpensesMonthly: 1000,
        safeWithdrawalRatePct: 99,
        corpusBufferPct: 0,
      );
      expect(low, greaterThan(high));
    });
  });

  group('goalRequiredMonthlySavings', () {
    test('spreads gap over months remaining', () {
      final goal = FinancialGoal(
        id: 'g1',
        kind: FinancialGoalKind.target,
        name: 'House',
        targetAmount: 120000,
        targetDate: DateTime(2026, 5, 17).add(const Duration(days: 365 * 2)),
      );
      final req = goalRequiredMonthlySavings(
        goal: goal,
        currentAmount: 0,
        effectiveTarget: 120000,
        now: DateTime(2026, 5, 17),
      );
      expect(req, greaterThan(4000));
      expect(req, lessThan(5200));
    });
  });

  group('assessGoalFeasibility', () {
    test('broken when past target date with gap', () {
      final f = assessGoalFeasibility(
        requiredMonthly: 500,
        allocatedMonthly: 500,
        monthsRemaining: 0,
        totalSavingsMonthly: 1000,
        goalLabel: 'House',
      );
      expect(f.level, GoalFeasibilityLevel.broken);
    });

    test('ok when allocated covers required', () {
      final f = assessGoalFeasibility(
        requiredMonthly: 100,
        allocatedMonthly: 100,
        monthsRemaining: 24,
        totalSavingsMonthly: 1000,
      );
      expect(f.level, GoalFeasibilityLevel.ok);
    });
  });

  group('goalEffectiveTarget', () {
    test('keeps retirement corpus fixed (ignores corpusAdjustment)', () {
      final goal = FinancialGoal(
        id: 'r',
        kind: FinancialGoalKind.retirement,
        name: 'Retirement',
        corpusAutoFromExpenses: true,
        safeWithdrawalRatePct: 4,
        corpusBufferPct: 0,
        corpusAdjustment: 500_000,
      );
      final base = computeRetirementCorpus(
        recurringExpensesMonthly: 5000,
        safeWithdrawalRatePct: 4,
        corpusBufferPct: 0,
      );
      final effective = goalEffectiveTarget(
        goal: goal,
        recurringExpensesMonthly: 5000,
      );
      expect(effective, closeTo(base, 1));
    });
  });

  group('requiredMonthlyToReachTarget', () {
    test('more months until retire lowers required invest', () {
      const target = 1_000_000.0;
      const current = 100_000.0;
      const rate = 6.0;
      final soon = requiredMonthlyToReachTarget(
        current: current,
        target: target,
        months: 120,
        annualReturnPct: rate,
      );
      final later = requiredMonthlyToReachTarget(
        current: current,
        target: target,
        months: 240,
        annualReturnPct: rate,
      );
      expect(later, lessThan(soon));
    });
  });

  group('futureValueOfMonthlyContributions', () {
    test('12 months at 6% annual beats straight principal', () {
      final fv = futureValueOfMonthlyContributions(
        monthlyPayment: 10_000,
        annualReturnPct: 6,
        months: 12,
      );
      expect(fv, greaterThan(120_000));
      expect(fv, lessThan(125_000));
    });
  });

  group('shiftRetirementTargetDate', () {
    test('shifts calendar only', () {
      final base = DateTime(2035, 6, 1);
      final shifted = shiftRetirementTargetDate(baseDate: base, yearsDelta: 2);
      expect(shifted.year, 2037);
      expect(shifted.month, 6);
    });
  });

  group('computeDeficitSavingsWeights', () {
    test('weights follow required monthly deficits', () {
      final w = computeDeficitSavingsWeights(
        goals: const [
          GoalAllocationInput(id: 'a', requiredMonthly: 300),
          GoalAllocationInput(id: 'b', requiredMonthly: 700),
        ],
      );
      expect(w['a'], closeTo(0.3, 0.001));
      expect(w['b'], closeTo(0.7, 0.001));
    });
  });
}
