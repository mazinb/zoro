/// One row per calendar month for the cash flow section (display-currency amounts).
class MonthlyCashflowEntry {
  MonthlyCashflowEntry({
    required this.monthKey,
    this.openingBalance = 0,
    this.closingBalance = 0,
    required this.outflowToCashFd,
    required this.outflowToInvested,
    this.monthlySpending = 0,
    this.comment = '',
    this.contextMarkdown,
  });

  final String monthKey;

  /// Starting balance for the month (display-currency).
  double openingBalance;

  /// Ending balance for the month (display-currency).
  double closingBalance;

  /// Saved (maps to “Savings” allocation target).
  double outflowToCashFd;

  /// Invested (maps to “Investments” allocation target).
  double outflowToInvested;

  /// Total spending for the month (vs budget / donut estimate).
  double monthlySpending;

  String comment;

  /// Optional context that agents can build up over time for this month.
  String? contextMarkdown;
}
