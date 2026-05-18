import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/features/goals/goals_apply_updates.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('applyRetirementCorpusStructured updates SWR and corpus', () {
    final m = AppModel();
    m.ensureRetirementGoal();
    final id = m.retirementGoal!.id;
    applyRetirementCorpusStructured(m, {
      'safeWithdrawalRatePct': 5,
      'corpusBufferPct': 20,
      'corpusAutoFromExpenses': true,
      'targetAmount': 2_000_000,
    });
    final g = m.financialGoalById(id)!;
    expect(g.safeWithdrawalRatePct, 5);
    expect(g.corpusBufferPct, 20);
    expect(g.corpusAutoFromExpenses, isTrue);
  });

  test('applyGoalExpenseEstimatorStructured updates buckets', () {
    final m = AppModel();
    m.ensureRetirementGoal();
    final id = m.retirementGoal!.id;
    applyGoalExpenseEstimatorStructured(
      m,
      structured: {
        'expenseBuckets': {'housing': 3500, 'food': 900},
      },
      goalId: id,
    );
    expect(m.expenseBuckets['housing'], 3500);
    expect(m.expenseBuckets['food'], 900);
  });
}
