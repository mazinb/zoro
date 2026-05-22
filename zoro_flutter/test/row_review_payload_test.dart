import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/currency.dart';
import 'package:zoro_flutter/core/finance/row_review_payload.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/core/state/ledger_rows.dart';

void main() {
  test('assetReviewLedgerPayload uses native total not display', () {
    final model = AppModel();
    model.displayCurrency = CurrencyCode.thb;
    model.setFxUsdPerUnitOverride(CurrencyCode.thb, 0.028);
    model.setFxUsdPerUnitOverride(CurrencyCode.inr, 0.012);

    final row = LedgerAssetRow(
      id: 'a-us',
      type: LedgerAssetType.investments,
      name: 'US Brokerage',
      currencyCountry: 'US',
      total: 350000,
      label: 'US Brokerage',
      comment: '',
    );

    final payload = assetReviewLedgerPayload(model, row);
    expect(payload['ledgerTotal'], 350000);
    expect(payload['accountCurrency'], 'USD');
    expect(payload['ledgerTotalFormatted'], contains(r'$'));
    final approx = payload['approxDisplayTotal'] as double;
    expect(approx, greaterThan(1_000_000));
    expect(approx, isNot(equals(350000)));
  });

  test('ledgerAssetTotalNative uses row.total for investments', () {
    final model = AppModel();
    final row = LedgerAssetRow(
      id: 'a-in',
      type: LedgerAssetType.investments,
      name: 'India Index Fund',
      currencyCountry: 'India',
      total: 2_000_000,
      label: 'India Index Fund',
      comment: '',
    );
    expect(ledgerAssetTotalNative(model, row), 2_000_000);
  });
}
