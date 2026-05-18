import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/core/state/financial_goals.dart';
import 'package:zoro_flutter/core/state/ledger_rows.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('autoAllocateGoalSavingsWeights favors larger monthly gaps on targets only', () {
    final m = AppModel();
    for (final l in m.liabilities) {
      l.paydownMonthly = 0;
    }
    m.ensureRetirementGoal();
    m.allocSavingsMonthly = 1000;
    m.allocInvestmentsMonthly = 500;
    final ret = m.retirementGoal!;
    m.upsertFinancialGoal(
      ret.copyWith(
        targetAmount: 500_000,
        targetDate: DateTime.now().add(const Duration(days: 365 * 10)),
      ),
    );
    final target = FinancialGoal(
      id: 'g-target',
      kind: FinancialGoalKind.target,
      name: 'House',
      targetAmount: 60_000,
      targetDate: DateTime.now().add(const Duration(days: 365 * 2)),
      sortOrder: 0,
    );
    m.upsertFinancialGoal(target);
    m.autoAllocateGoalSavingsWeights();
    final house = m.financialGoalById('g-target')!;
    final retirement = m.retirementGoal!;
    expect(house.savingsWeight, greaterThan(0));
    expect(m.savingsMonthlyForGoal(house), greaterThan(0));
    expect(m.savingsMonthlyForGoal(retirement), m.investMonthlyForRetirement());
    expect(m.investMonthlyForRetirement(), greaterThanOrEqualTo(500));
  });

  test('target pool assignment respects sort order without double counting', () {
    final m = AppModel();
    final savings = m.assets.firstWhere(
      (a) => a.type == LedgerAssetType.savings,
      orElse: () => m.assets.first,
    );
    for (final a in m.assets) {
      if (a.type == LedgerAssetType.savings && a.id != savings.id) a.total = 0;
      if (a.type == LedgerAssetType.property || a.type == LedgerAssetType.other) {
        m.retirementExtraAssetIds.remove(a.id);
        a.total = 0;
      }
    }
    savings.total = 100_000;
    final g1 = FinancialGoal(
      id: 'g1',
      kind: FinancialGoalKind.target,
      name: 'First',
      targetAmount: 40_000,
      sortOrder: 0,
    );
    final g2 = FinancialGoal(
      id: 'g2',
      kind: FinancialGoalKind.target,
      name: 'Second',
      targetAmount: 80_000,
      sortOrder: 1,
    );
    m.upsertFinancialGoal(g1);
    m.upsertFinancialGoal(g2);
    final assigned = m.goalCurrentAmount(g1);
    final second = m.goalCurrentAmount(g2);
    expect(assigned, closeTo(40_000, 1));
    expect(second, closeTo(60_000, 1));
    expect(assigned + second, closeTo(100_000, 1));
  });
}
