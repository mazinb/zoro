import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/core/state/ledger_rows.dart';

void main() {
  test('repairDuplicateLiabilityIds assigns unique ids', () {
    final m = AppModel();
    m.liabilities.clear();
    m.liabilities.addAll([
      LedgerLiabilityRow(
        id: 'dup',
        type: LedgerLiabilityType.mortgage,
        name: 'Condo',
        currencyCountry: 'Thailand',
        total: 1,
        comment: '',
        paydownMonthly: 100,
      ),
      LedgerLiabilityRow(
        id: 'dup',
        type: LedgerLiabilityType.carLoan,
        name: 'Car',
        currencyCountry: 'Thailand',
        total: 2,
        comment: '',
        paydownMonthly: 50,
      ),
    ]);
    m.repairDuplicateLiabilityIds(notify: false);
    expect(m.liabilities[0].id, isNot(equals(m.liabilities[1].id)));
    expect(m.liabilityById('dup')?.name, 'Condo');
    final car = m.liabilities.firstWhere((l) => l.name == 'Car');
    expect(m.liabilityPaydownMonthly(car), 50);
  });

  test('seed liabilities have distinct ids', () {
    final m = AppModel();
    final ids = m.liabilities.map((l) => l.id).toSet();
    expect(ids.length, m.liabilities.length);
  });
}
