import '../state/app_model.dart';
/// Cashflow months that increased an asset balance via savings / invest linking.
class AssetCashflowCredits {
  const AssetCashflowCredits({
    required this.totalAppliedDisplay,
    required this.lines,
  });

  final double totalAppliedDisplay;
  final List<AssetCashflowCreditLine> lines;

  bool get hasCredits => totalAppliedDisplay > 0.005;
}

class AssetCashflowCreditLine {
  const AssetCashflowCreditLine({
    required this.monthKey,
    required this.amountDisplay,
    required this.kind,
  });

  final String monthKey;
  final double amountDisplay;

  /// `savings` or `invest`.
  final String kind;
}

AssetCashflowCredits cashflowCreditsForAsset(AppModel model, String assetId) {
  final lines = <AssetCashflowCreditLine>[];
  var total = 0.0;
  for (final mk in model.monthKeysWithCashflowData()) {
    final e = model.monthlyEntryFor(mk);
    if (e == null) continue;
    for (final il in e.investmentLines) {
      if (il.assetId != assetId || il.amountAppliedToAssets <= 0.005) continue;
      lines.add(AssetCashflowCreditLine(
        monthKey: mk,
        amountDisplay: il.amountAppliedToAssets,
        kind: 'invest',
      ));
      total += il.amountAppliedToAssets;
    }
    for (final sl in e.savingsLines) {
      if (sl.assetId != assetId || sl.amountApplied <= 0.005) continue;
      lines.add(AssetCashflowCreditLine(
        monthKey: mk,
        amountDisplay: sl.amountApplied,
        kind: 'savings',
      ));
      total += sl.amountApplied;
    }
  }
  return AssetCashflowCredits(totalAppliedDisplay: total, lines: lines);
}
