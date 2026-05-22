import '../state/app_model.dart';
import '../state/ledger_rows.dart';
import 'currency.dart';
import 'row_review_result.dart';

/// Primary savings/cash row: complete without a context note (balance from Cash tab).
const primaryCashLinkedReviewResult = RowReviewResult(
  level: RowReviewLevel.ok,
  title: 'Linked to Cash',
  detail: 'Balance follows your latest month closing on the Cash tab.',
);

/// FX map for helpers: ISO code → USD per 1 unit of that currency.
Map<String, double> fxUsdPerUnitPayload(AppModel model) => {
      for (final c in CurrencyCode.values) c.code: model.usdPerUnitResolved(c),
    };

/// Authoritative ledger balance for review (native account currency, not Home display).
double ledgerAssetTotalNative(AppModel model, LedgerAssetRow row) {
  if (model.primaryCashBalanceIsMirrored(row)) {
    final closing = model.latestCashClosingBalanceDisplay;
    if (closing == null) return row.total;
    final native = currencyCodeForPresetCountry(row.currencyCountry);
    return convertCurrency(
      value: closing,
      from: model.displayCurrency,
      to: native,
      usdPerUnitOverrides: model.fxUsdPerUnitResolved,
    );
  }
  return row.total;
}

Map<String, Object?> assetReviewLedgerPayload(AppModel model, LedgerAssetRow row) {
  final accountCurrency = currencyCodeForPresetCountry(row.currencyCountry);
  final ledgerTotal = ledgerAssetTotalNative(model, row);
  final approxDisplay = model.moneyInDisplayCurrency(ledgerTotal, accountCurrency);

  return {
    'id': row.id,
    'type': row.type.apiValue,
    'name': row.name,
    'comment': row.comment,
    'currencyCountry': row.currencyCountry,
    'accountCurrency': accountCurrency.code,
    'ledgerTotal': ledgerTotal,
    'ledgerTotalFormatted': formatCurrencyDisplay(ledgerTotal, currency: accountCurrency),
    'approxDisplayCurrency': model.displayCurrency.code,
    'approxDisplayTotal': approxDisplay,
    'approxDisplayFormatted': formatCurrencyDisplay(approxDisplay, currency: model.displayCurrency),
    'balanceSource': model.primaryCashBalanceIsMirrored(row)
        ? 'latest_cashflow_closing_in_account_currency'
        : 'ledger_row_total',
    'fxUsdPerUnit': fxUsdPerUnitPayload(model),
  };
}

Map<String, Object?> liabilityReviewLedgerPayload(AppModel model, LedgerLiabilityRow row) {
  final accountCurrency = currencyCodeForPresetCountry(row.currencyCountry);
  final ledgerTotal = row.total;
  final approxDisplay = model.moneyInDisplayCurrency(ledgerTotal, accountCurrency);

  return {
    'id': row.id,
    'type': row.type.apiValue,
    'name': row.name,
    'comment': row.comment,
    'currencyCountry': row.currencyCountry,
    'accountCurrency': accountCurrency.code,
    'ledgerTotal': ledgerTotal,
    'ledgerTotalFormatted': formatCurrencyDisplay(ledgerTotal, currency: accountCurrency),
    'interestRatePct': row.interestRatePct,
    'approxDisplayCurrency': model.displayCurrency.code,
    'approxDisplayTotal': approxDisplay,
    'approxDisplayFormatted': formatCurrencyDisplay(approxDisplay, currency: model.displayCurrency),
    'fxUsdPerUnit': fxUsdPerUnitPayload(model),
  };
}

/// Shared rules appended to ledger/context asset review system prompts.
const String assetReviewAmountRules = '''
Amount reconciliation rules:
- **ledgerTotal** + **accountCurrency** are authoritative (native ledger balance).
- **approxDisplayTotal** is only the same balance converted to the user's Home display currency — do NOT treat it as the account currency.
- Compare amounts in contextMarkdown to ledgerTotal in accountCurrency. If context uses another currency, convert using **fxUsdPerUnit** before judging a mismatch.
- Do not flag a mismatch when holdings in context sum to ledgerTotal within ~15% after correct currency conversion.
''';

const String liabilityReviewAmountRules = '''
Amount reconciliation rules:
- **ledgerTotal** + **accountCurrency** are authoritative (native ledger balance).
- **approxDisplayTotal** is Home display currency only — not the loan's currency.
- Compare context amounts to ledgerTotal in accountCurrency; convert using **fxUsdPerUnit** when needed.
''';
