import 'ledger_rows.dart';

/// One transfer into an investment asset for a calendar month (display-currency amount).
class MonthlyInvestmentLine {
  MonthlyInvestmentLine({
    required this.id,
    this.assetId,
    this.amount = 0,
    this.contextMarkdown,
    this.amountAppliedToAssets = 0,
  });

  String id;
  String? assetId;
  double amount;
  String? contextMarkdown;

  /// Display-currency amount already added to [LedgerAssetRow.total] for this line.
  double amountAppliedToAssets;

  MonthlyInvestmentLine clone() => MonthlyInvestmentLine(
        id: id,
        assetId: assetId,
        amount: amount,
        contextMarkdown: contextMarkdown,
        amountAppliedToAssets: amountAppliedToAssets,
      );

  factory MonthlyInvestmentLine.blank() => MonthlyInvestmentLine(
        id: newLedgerRowId('mi'),
      );
}

double sumMonthlyInvestmentAmounts(Iterable<MonthlyInvestmentLine> lines) =>
    lines.fold<double>(0, (a, b) => a + b.amount);

/// One transfer into a savings asset or loan paydown for a calendar month.
class MonthlySavingsLine {
  MonthlySavingsLine({
    required this.id,
    this.assetId,
    this.liabilityId,
    this.amount = 0,
    this.contextMarkdown,
    this.amountApplied = 0,
  });

  String id;
  String? assetId;
  String? liabilityId;
  double amount;
  String? contextMarkdown;

  /// Display-currency amount already applied to [assetId] / [liabilityId].
  double amountApplied;

  MonthlySavingsLine clone() => MonthlySavingsLine(
        id: id,
        assetId: assetId,
        liabilityId: liabilityId,
        amount: amount,
        contextMarkdown: contextMarkdown,
        amountApplied: amountApplied,
      );

  factory MonthlySavingsLine.blank() => MonthlySavingsLine(
        id: newLedgerRowId('ms'),
      );
}

double sumMonthlySavingsAmounts(Iterable<MonthlySavingsLine> lines) =>
    lines.fold<double>(0, (a, b) => a + b.amount);

bool monthlySavingsLinkingComplete(
  MonthlyCashflowEntry e, {
  double tol = 0.51,
}) {
  if (e.outflowToCashFd <= 0.005) return true;
  if (e.savingsLines.isEmpty) return false;
  final sum = sumMonthlySavingsAmounts(e.savingsLines);
  if ((sum - e.outflowToCashFd).abs() > tol) return false;
  for (final l in e.savingsLines) {
    if (l.amount <= 0.005) continue;
    final hasAsset = (l.assetId ?? '').isNotEmpty;
    final hasLiab = (l.liabilityId ?? '').isNotEmpty;
    if (!hasAsset && !hasLiab) return false;
    if (hasAsset && hasLiab) return false;
  }
  return true;
}

List<MonthlySavingsLine> reconcileSavingsLinesForMonthlySave({
  required double newSaved,
  required List<MonthlySavingsLine> previous,
}) {
  if (newSaved < 0.005) return [];
  if (previous.isEmpty) {
    return [MonthlySavingsLine.blank()..amount = newSaved];
  }
  final lines = previous.map((e) => e.clone()).toList();
  final sum = sumMonthlySavingsAmounts(lines);
  if (sum < 0.005) {
    return [MonthlySavingsLine.blank()..amount = newSaved];
  }
  if ((sum - newSaved).abs() > 0.51) {
    final f = newSaved / sum;
    for (final l in lines) {
      l.amount *= f;
      l.amountApplied = 0;
    }
  }
  return lines;
}

/// [tol] — display-currency; allow rounding drift.
bool monthlyInvestmentLinkingComplete(
  MonthlyCashflowEntry e, {
  double tol = 0.51,
}) {
  if (e.outflowToInvested <= 0.005) return true;
  if (e.investmentLines.isEmpty) return false;
  final sum = sumMonthlyInvestmentAmounts(e.investmentLines);
  if ((sum - e.outflowToInvested).abs() > tol) return false;
  for (final l in e.investmentLines) {
    if (l.amount <= 0.005) continue;
    if ((l.assetId ?? '').isEmpty) return false;
  }
  return true;
}

/// Keeps per-asset splits when possible; scales amounts when month “Invested” changes.
List<MonthlyInvestmentLine> reconcileInvestmentLinesForMonthlySave({
  required double newInvested,
  required List<MonthlyInvestmentLine> previous,
}) {
  if (newInvested < 0.005) return [];
  if (previous.isEmpty) {
    return [MonthlyInvestmentLine.blank()..amount = newInvested];
  }
  final lines = previous.map((e) => e.clone()).toList();
  final sum = sumMonthlyInvestmentAmounts(lines);
  if (sum < 0.005) {
    return [MonthlyInvestmentLine.blank()..amount = newInvested];
  }
  if ((sum - newInvested).abs() > 0.51) {
    final f = newInvested / sum;
    for (final l in lines) {
      l.amount *= f;
      l.amountAppliedToAssets = 0;
    }
  }
  return lines;
}

/// One row per calendar month for the cash flow section (display-currency amounts).
class MonthlyCashflowEntry {
  MonthlyCashflowEntry({
    required this.monthKey,
    this.openingBalance = 0,
    this.closingBalance = 0,
    this.monthlyEarned = 0,
    required this.outflowToCashFd,
    required this.outflowToInvested,
    this.monthlySpending = 0,
    this.comment = '',
    this.contextMarkdown,
    List<MonthlyInvestmentLine>? investmentLines,
    List<MonthlySavingsLine>? savingsLines,
  })  : investmentLines = investmentLines != null
            ? investmentLines.map((e) => e.clone()).toList()
            : [],
        savingsLines = savingsLines != null
            ? savingsLines.map((e) => e.clone()).toList()
            : [];

  final String monthKey;

  /// Starting balance for the month (display-currency).
  double openingBalance;

  /// Ending balance for the month (display-currency).
  double closingBalance;

  /// Take-home or other income for the month (display-currency). When > 0, spending is derived with this term.
  double monthlyEarned;

  /// Saved (maps to “Savings” allocation target).
  double outflowToCashFd;

  /// Invested (maps to “Investments” allocation target).
  double outflowToInvested;

  /// Total spending for the month (vs budget / donut estimate).
  double monthlySpending;

  String comment;

  /// Optional context that agents can build up over time for this month.
  String? contextMarkdown;

  /// Per-month investment transfers; each line links to an asset (sums to [outflowToInvested] when complete).
  final List<MonthlyInvestmentLine> investmentLines;

  /// Per-month savings transfers; each line links to an asset or liability (sums to [outflowToCashFd] when complete).
  final List<MonthlySavingsLine> savingsLines;
}
