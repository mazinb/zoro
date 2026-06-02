import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/goal_asset_buckets.dart';
import 'package:zoro_flutter/core/state/ledger_rows.dart';

void main() {
  test('savings in retirement extras count toward corpus not savings pool', () {
    const policy = AssetsGoalsPolicy(retirementExtraAssetIds: {'s1'});
    LedgerAssetRow savingsRow({
      required String id,
      required String name,
      required double total,
    }) =>
        LedgerAssetRow(
          id: id,
          type: LedgerAssetType.savings,
          currencyCountry: 'US',
          name: name,
          total: total,
          label: '',
          comment: '',
        );

    final savings = savingsRow(id: 's1', name: 'Term', total: 50_000);
    final other = savingsRow(id: 's2', name: 'Cash', total: 10_000);

    expect(assetCountsTowardRetirement(savings, policy), isTrue);
    expect(assetCountsTowardSavings(savings, policy), isFalse);
    expect(assetCountsTowardRetirement(other, policy), isFalse);
    expect(assetCountsTowardSavings(other, policy), isTrue);

    expect(
      totalRetirementAssetBalance(
        assets: [savings, other],
        displayValue: (a) => a.total,
        policy: policy,
      ),
      50_000,
    );
    expect(
      totalSavingsPoolBalance(
        assets: [savings, other],
        displayValue: (a) => a.total,
        policy: policy,
      ),
      10_000,
    );
  });
}
