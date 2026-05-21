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

  test('repairDuplicateAssetIds assigns unique ids', () {
    final m = AppModel();
    m.assets.clear();
    m.assets.addAll([
      LedgerAssetRow(
        id: 'dup',
        type: LedgerAssetType.investments,
        currencyCountry: 'US',
        name: 'US Brokerage',
        total: 1,
        label: '',
        comment: '',
        contextMarkdown: 'US note',
      ),
      LedgerAssetRow(
        id: 'dup',
        type: LedgerAssetType.investments,
        currencyCountry: 'India',
        name: 'India Index Fund',
        total: 2,
        label: '',
        comment: '',
        contextMarkdown: 'India note',
      ),
    ]);
    m.repairDuplicateAssetIds(notify: false);
    expect(m.assets[0].id, isNot(equals(m.assets[1].id)));
    expect(m.assetById('dup')?.contextMarkdown, 'US note');
    final india = m.assets.firstWhere((a) => a.name == 'India Index Fund');
    expect(india.contextMarkdown, 'India note');
    m.setAssetContextMarkdown(assetId: india.id, markdown: 'Updated India only');
    expect(m.assetById('dup')?.contextMarkdown, 'US note');
    expect(india.contextMarkdown, 'Updated India only');
  });

  test('seed assets have distinct ids', () {
    final m = AppModel();
    final ids = m.assets.map((a) => a.id).toSet();
    expect(ids.length, m.assets.length);
    expect(m.assetById(SeedLedgerIds.assetUsBrokerage)?.name, 'US Brokerage');
    expect(m.assetById(SeedLedgerIds.assetIndiaIndex)?.name, 'India Index Fund');
  });

  test('newLedgerRowId is unique in a tight loop', () {
    final ids = <String>{};
    for (var i = 0; i < 32; i++) {
      ids.add(newLedgerRowId('a'));
    }
    expect(ids.length, 32);
  });
}
