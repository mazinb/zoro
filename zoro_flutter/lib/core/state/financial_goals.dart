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
    this.corpusAdjustment = 0,
    this.fundsProjects = false,
    this.contextMarkdown = '',
  }) : linkedAssetIds = linkedAssetIds ?? [];

  final String id;
  final FinancialGoalKind kind;
  String name;
  double targetAmount;
  DateTime? targetDate;
  final List<String> linkedAssetIds;
  /// Share of [AppModel.allocSavingsMonthly] (auto-normalized across active goals).
  double savingsWeight;
  /// Retirement corpus offset on top of linked asset balances (contributions / withdrawals).
  double corpusAdjustment;
  /// When true, this target goal is treated as funding near-term projects from savings.
  bool fundsProjects;
  String contextMarkdown;

  bool get isRetirement => kind == FinancialGoalKind.retirement;

  FinancialGoal clone() => FinancialGoal(
        id: id,
        kind: kind,
        name: name,
        targetAmount: targetAmount,
        targetDate: targetDate,
        linkedAssetIds: List<String>.from(linkedAssetIds),
        savingsWeight: savingsWeight,
        corpusAdjustment: corpusAdjustment,
        fundsProjects: fundsProjects,
        contextMarkdown: contextMarkdown,
      );

  FinancialGoal copyWith({
    String? name,
    double? targetAmount,
    DateTime? targetDate,
    bool clearTargetDate = false,
    List<String>? linkedAssetIds,
    double? savingsWeight,
    double? corpusAdjustment,
    bool? fundsProjects,
    String? contextMarkdown,
  }) =>
      FinancialGoal(
        id: id,
        kind: kind,
        name: name ?? this.name,
        targetAmount: targetAmount ?? this.targetAmount,
        targetDate: clearTargetDate ? null : (targetDate ?? this.targetDate),
        linkedAssetIds: linkedAssetIds ?? List<String>.from(this.linkedAssetIds),
        savingsWeight: savingsWeight ?? this.savingsWeight,
        corpusAdjustment: corpusAdjustment ?? this.corpusAdjustment,
        fundsProjects: fundsProjects ?? this.fundsProjects,
        contextMarkdown: contextMarkdown ?? this.contextMarkdown,
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
