/// Financial goals: one retirement goal and many target-amount goals.
class FinancialGoal {
  FinancialGoal({
    required this.id,
    required this.kind,
    required this.name,
    this.targetAmount = 0,
    this.targetDate,
    List<String>? linkedAssetIds,
    this.savingsWeight = 1,
    this.sortOrder = 0,
    this.corpusSurplus = 0,
    this.contextMarkdown = '',
    this.safeWithdrawalRatePct = 4,
    this.corpusBufferPct = 0,
    this.corpusAutoFromExpenses = true,
    this.timelineStart,
  }) : linkedAssetIds = linkedAssetIds ?? [];

  final String id;
  final FinancialGoalKind kind;
  String name;
  double targetAmount;
  DateTime? targetDate;
  /// Legacy — ignored in progress math; kept for import compatibility.
  final List<String> linkedAssetIds;
  /// Share of target savings flow (auto-normalized across active targets).
  double savingsWeight;
  /// Display order for savings waterfall (lower = filled first).
  int sortOrder;
  /// Cushion on top of base corpus (agent %, manual, years, overflow).
  double corpusSurplus;
  String contextMarkdown;

  /// Safe withdrawal rate for retirement corpus (1–10%).
  double safeWithdrawalRatePct;
  /// Agent buffer as % of base corpus → seeds [corpusSurplus].
  double corpusBufferPct;
  /// When true, [targetAmount] is derived from ledger recurring expenses.
  bool corpusAutoFromExpenses;
  /// Start of timeline for time-based progress notifications.
  DateTime? timelineStart;

  bool get isRetirement => kind == FinancialGoalKind.retirement;

  FinancialGoal clone() => FinancialGoal(
        id: id,
        kind: kind,
        name: name,
        targetAmount: targetAmount,
        targetDate: targetDate,
        linkedAssetIds: List<String>.from(linkedAssetIds),
        savingsWeight: savingsWeight,
        sortOrder: sortOrder,
        corpusSurplus: corpusSurplus,
        contextMarkdown: contextMarkdown,
        safeWithdrawalRatePct: safeWithdrawalRatePct,
        corpusBufferPct: corpusBufferPct,
        corpusAutoFromExpenses: corpusAutoFromExpenses,
        timelineStart: timelineStart,
      );

  FinancialGoal copyWith({
    String? name,
    double? targetAmount,
    DateTime? targetDate,
    bool clearTargetDate = false,
    List<String>? linkedAssetIds,
    double? savingsWeight,
    int? sortOrder,
    double? corpusSurplus,
    String? contextMarkdown,
    double? safeWithdrawalRatePct,
    double? corpusBufferPct,
    bool? corpusAutoFromExpenses,
    DateTime? timelineStart,
    bool clearTimelineStart = false,
  }) =>
      FinancialGoal(
        id: id,
        kind: kind,
        name: name ?? this.name,
        targetAmount: targetAmount ?? this.targetAmount,
        targetDate: clearTargetDate ? null : (targetDate ?? this.targetDate),
        linkedAssetIds: linkedAssetIds ?? List<String>.from(this.linkedAssetIds),
        savingsWeight: savingsWeight ?? this.savingsWeight,
        sortOrder: sortOrder ?? this.sortOrder,
        corpusSurplus: corpusSurplus ?? this.corpusSurplus,
        contextMarkdown: contextMarkdown ?? this.contextMarkdown,
        safeWithdrawalRatePct: safeWithdrawalRatePct ?? this.safeWithdrawalRatePct,
        corpusBufferPct: corpusBufferPct ?? this.corpusBufferPct,
        corpusAutoFromExpenses: corpusAutoFromExpenses ?? this.corpusAutoFromExpenses,
        timelineStart: clearTimelineStart ? null : (timelineStart ?? this.timelineStart),
      );
}

enum FinancialGoalKind {
  retirement,
  target;

  String get apiValue => switch (this) {
        FinancialGoalKind.retirement => 'retirement',
        FinancialGoalKind.target => 'target',
      };

  static FinancialGoalKind fromApi(String? raw) {
    if (raw == 'retirement') return FinancialGoalKind.retirement;
    return FinancialGoalKind.target;
  }
}
