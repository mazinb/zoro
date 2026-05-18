import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/core/state/financial_goals.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('setLiabilityPaydownMonthly shifts from invest when over savings slice', () {
    final m = AppModel();
    for (final l in m.liabilities) {
      l.paydownMonthly = 0;
    }
    m.allocInvestmentsMonthly = 800;
    m.allocSavingsMonthly = 200;
    m.allocInvestFraction = 0.8;

    final id = m.liabilities.first.id;
    m.setLiabilityPaydownMonthly(id, 250);

    expect(m.liabilities.firstWhere((l) => l.id == id).paydownMonthly, closeTo(250, 1));
    expect(m.allocSavingsMonthly, closeTo(250, 1));
    expect(m.allocInvestmentsMonthly, closeTo(750, 1));
    expect(m.allocInvestmentsMonthly + m.allocSavingsMonthly, closeTo(1000, 1));
  });

  test('planFeasibility ignores legacy target goals', () {
    final m = AppModel();
    m.ensureRetirementGoal();
    m.allocInvestmentsMonthly = 5000;
    m.allocSavingsMonthly = 500;
    final huge = FinancialGoal(
      id: 'g-huge',
      kind: FinancialGoalKind.target,
      name: 'Legacy',
      targetAmount: 100_000_000,
      targetDate: DateTime.now().add(const Duration(days: 365)),
      sortOrder: 0,
    );
    m.upsertFinancialGoal(huge);
    final feas = m.planFeasibility();
    expect(feas.detail, isNot(contains('Legacy')));
    expect(feas.detail.toLowerCase(), anyOf(contains('retirement'), isEmpty));
  });
}
