import '../state/app_model.dart';
import '../state/ledger_rows.dart';
import 'cashflow_row_credits.dart';
import 'currency.dart';
import 'row_review_result.dart';

/// Cashflow savings/invest amounts **applied** to this asset (Cash tab linking only).
RowReviewResult? cashflowLinkedCautionForAsset(AppModel model, LedgerAssetRow row) {
  final credits = cashflowCreditsForAsset(model, row.id);
  if (!credits.hasCredits) return null;
  final amt = formatCurrencyDisplay(
    credits.totalAppliedDisplay,
    currency: model.displayCurrency,
  );
  return RowReviewResult(
    level: RowReviewLevel.caution,
    title: 'Cashflow linked',
    detail:
        '$amt from Cash tab was applied to this balance — confirm it matches your account.',
    bannerNote: '$amt added from Cash tab',
    cashflowAmountAdded: credits.totalAppliedDisplay,
  );
}

RowReviewResult? cashflowLinkedCautionForLiability(AppModel model, LedgerLiabilityRow row) {
  var total = 0.0;
  for (final mk in model.monthKeysWithCashflowData()) {
    final e = model.monthlyEntryFor(mk);
    if (e == null) continue;
    for (final sl in e.savingsLines) {
      if (sl.liabilityId == row.id && sl.amountApplied > 0.005) {
        total += sl.amountApplied;
      }
    }
  }
  if (total <= 0.005) return null;
  final amt = formatCurrencyDisplay(total, currency: model.displayCurrency);
  return RowReviewResult(
    level: RowReviewLevel.caution,
    title: 'Cashflow paydown',
    detail: '$amt from Cash tab was applied to this loan balance.',
    bannerNote: '$amt paydown from Cash tab',
    cashflowAmountAdded: total,
  );
}

int _rank(RowReviewLevel l) => switch (l) {
      RowReviewLevel.ok => 0,
      RowReviewLevel.caution => 1,
      RowReviewLevel.broken => 2,
    };

/// Prefer the stricter of two statuses (for icon + subtitle).
RowReviewResult? mergeRowReviewResults(RowReviewResult? a, RowReviewResult? b) {
  if (a == null) return b;
  if (b == null) return a;
  if (_rank(b.level) > _rank(a.level)) return b;
  if (_rank(a.level) > _rank(b.level)) return a;
  if (a.detail.trim().isNotEmpty) return a;
  return b;
}

RowReviewResult? effectiveLedgerAssetStatus(
  AppModel model,
  LedgerAssetRow row,
  RowReviewSlot? slot,
) {
  final local = cashflowLinkedCautionForAsset(model, row);
  if (slot == null || slot.reviewing) return local;
  return mergeRowReviewResults(slot.result, local);
}

RowReviewResult? effectiveLedgerLiabilityStatus(
  AppModel model,
  LedgerLiabilityRow row,
  RowReviewSlot? slot,
) {
  final local = cashflowLinkedCautionForLiability(model, row);
  if (slot == null || slot.reviewing) return local;
  return mergeRowReviewResults(slot.result, local);
}
