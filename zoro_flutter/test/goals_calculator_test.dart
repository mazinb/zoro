import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/goal_allocation.dart';
import 'package:zoro_flutter/core/finance/goals_calculator.dart';
import 'package:zoro_flutter/core/state/financial_goals.dart';

void main() {
  group('computeRetirementCorpus', () {
    test('uses annual spend and SWR (base corpus)', () {
      final c = computeRetirementCorpusBase(
        recurringExpensesMonthly: 5000,
        safeWithdrawalRatePct: 4,
      );
      expect(c, closeTo(1500000, 1));
    });

    test('surplus from buffer % is separate', () {
      final base = computeRetirementCorpusBase(
        recurringExpensesMonthly: 5000,
        safeWithdrawalRatePct: 4,
      );
      expect(surplusFromCorpusBufferPct(base, 10), closeTo(150000, 1));
    });

    test('clamps SWR to 1-10%', () {
      final low = computeRetirementCorpusBase(
        recurringExpensesMonthly: 1000,
        safeWithdrawalRatePct: 0.5,
      );
      final high = computeRetirementCorpusBase(
        recurringExpensesMonthly: 1000,
        safeWithdrawalRatePct: 99,
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
    test('corpus base excludes surplus', () {
      final goal = FinancialGoal(
        id: 'r',
        kind: FinancialGoalKind.retirement,
        name: 'Retirement',
        corpusAutoFromExpenses: true,
        safeWithdrawalRatePct: 4,
        corpusBufferPct: 10,
        corpusSurplus: 500_000,
      );
      final base = computeRetirementCorpusBase(
        recurringExpensesMonthly: 5000,
        safeWithdrawalRatePct: 4,
      );
      final effective = goalEffectiveTarget(
        goal: goal,
        recurringExpensesMonthly: 5000,
      );
      expect(effective, closeTo(base, 1));
      expect(goal.corpusSurplus, 500_000);
    });
  });

  group('surplusAfterCorpusIncrease', () {
    test('corpus rise eats surplus first', () {
      expect(
        surplusAfterCorpusIncrease(surplus: 5_000_000, oldBase: 100_000_000, newBase: 103_000_000),
        closeTo(2_000_000, 1),
      );
      expect(
        surplusAfterCorpusIncrease(surplus: 1_000_000, oldBase: 100_000_000, newBase: 90_000_000),
        closeTo(1_000_000, 1),
      );
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
