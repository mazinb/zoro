import '../state/financial_goals.dart';
import '../state/ledger_rows.dart';

bool assetCountsTowardRetirement(LedgerAssetRow asset, AssetsGoalsPolicy policy) {
  switch (asset.type.defaultGoalsBucket) {
    case AssetGoalsBucket.retirement:
      return true;
    case AssetGoalsBucket.property:
    case AssetGoalsBucket.both:
      return policy.retirementExtraAssetIds.contains(asset.id);
    case AssetGoalsBucket.savings:
      return policy.retirementExtraAssetIds.contains(asset.id);
  }
}

bool assetCountsTowardSavings(LedgerAssetRow asset, AssetsGoalsPolicy policy) {
  switch (asset.type.defaultGoalsBucket) {
    case AssetGoalsBucket.savings:
      return !policy.retirementExtraAssetIds.contains(asset.id);
    case AssetGoalsBucket.property:
    case AssetGoalsBucket.both:
    case AssetGoalsBucket.retirement:
      return false;
  }
}

double retirementBalanceFromAsset(
  LedgerAssetRow asset,
  double Function(LedgerAssetRow) displayValue,
  AssetsGoalsPolicy policy,
) {
  if (!assetCountsTowardRetirement(asset, policy)) return 0;
  return displayValue(asset);
}

double savingsBalanceFromAsset(
  LedgerAssetRow asset,
  double Function(LedgerAssetRow) displayValue,
  AssetsGoalsPolicy policy,
) {
  if (!assetCountsTowardSavings(asset, policy)) return 0;
  return displayValue(asset);
}

/// Assigns savings balances to targets in [sortOrder] without double counting.
Map<String, double> assignSavingsPoolToTargets({
  required List<FinancialGoal> targetsOrdered,
  required List<LedgerAssetRow> savingsAssets,
  required double Function(LedgerAssetRow) displayValue,
  required double Function(FinancialGoal) effectiveTarget,
  required AssetsGoalsPolicy policy,
}) {
  if (targetsOrdered.isEmpty) return {};

  final remainingByAsset = <String, double>{
    for (final a in savingsAssets) a.id: savingsBalanceFromAsset(a, displayValue, policy),
  };

  final assigned = <String, double>{for (final g in targetsOrdered) g.id: 0.0};

  for (final g in targetsOrdered) {
    final target = effectiveTarget(g);
    if (target <= 0) continue;
    var need = target;
    for (final e in remainingByAsset.entries.toList()) {
      if (need <= 0) break;
      final rem = e.value;
      if (rem <= 0) continue;
      final take = rem < need ? rem : need;
      assigned[g.id] = assigned[g.id]! + take;
      remainingByAsset[e.key] = rem - take;
      need -= take;
    }
  }

  return assigned;
}

double totalRetirementAssetBalance({
  required Iterable<LedgerAssetRow> assets,
  required double Function(LedgerAssetRow) displayValue,
  required AssetsGoalsPolicy policy,
}) {
  var sum = 0.0;
  for (final a in assets) {
    sum += retirementBalanceFromAsset(a, displayValue, policy);
  }
  return sum;
}

double totalSavingsPoolBalance({
  required Iterable<LedgerAssetRow> assets,
  required double Function(LedgerAssetRow) displayValue,
  required AssetsGoalsPolicy policy,
}) {
  var sum = 0.0;
  for (final a in assets) {
    sum += savingsBalanceFromAsset(a, displayValue, policy);
  }
  return sum;
}

List<LedgerAssetRow> savingsPoolAssets(Iterable<LedgerAssetRow> assets, AssetsGoalsPolicy policy) =>
    [for (final a in assets) if (assetCountsTowardSavings(a, policy)) a];
