import 'goals_calculator.dart';

enum RowReviewLevel { ok, caution, broken }

/// Per-row review UI state (session only).
class RowReviewSlot {
  bool reviewing = false;
  RowReviewResult? result;
  bool bannerDismissed = false;
}

/// Result of a single ledger/context row review (LLM + local rules).
class RowReviewResult {
  const RowReviewResult({
    required this.level,
    required this.title,
    required this.detail,
    this.bannerNote = '',
    this.suggestedComment = '',
    this.suggestedContextMarkdown = '',
    this.cashflowAmountAdded,
  });

  final RowReviewLevel level;
  final String title;
  final String detail;

  /// One-line note shown on the card (dismissable).
  final String bannerNote;

  /// Ledger helper: optional comment to save on the row.
  final String suggestedComment;

  /// Context helper: optional full context markdown to apply.
  final String suggestedContextMarkdown;

  /// When cashflow linking bumped this balance (display currency).
  final double? cashflowAmountAdded;

  bool get isOk => level == RowReviewLevel.ok;

  GoalFeasibility toGoalFeasibility() => GoalFeasibility(
        level: switch (level) {
          RowReviewLevel.ok => GoalFeasibilityLevel.ok,
          RowReviewLevel.caution => GoalFeasibilityLevel.caution,
          RowReviewLevel.broken => GoalFeasibilityLevel.broken,
        },
        title: title,
        detail: detail,
      );

  static RowReviewLevel levelFromJson(String? raw) {
    switch (raw?.trim().toLowerCase()) {
      case 'caution':
      case 'warn':
      case 'warning':
        return RowReviewLevel.caution;
      case 'broken':
      case 'error':
      case 'bad':
        return RowReviewLevel.broken;
      case 'ok':
      case 'good':
      default:
        return RowReviewLevel.ok;
    }
  }

  static RowReviewResult fromJson(Map<String, dynamic> obj) {
    final level = levelFromJson(obj['level']?.toString());
    final title = obj['title']?.toString().trim() ?? '';
    final detail = obj['detail']?.toString().trim() ?? '';
    final banner = obj['bannerNote']?.toString().trim() ?? '';
    final comment = obj['suggestedComment']?.toString().trim() ?? '';
    final ctx = obj['suggestedContextMarkdown']?.toString().trim() ?? '';
    final cash = obj['cashflowAmountAdded'];
    final cashNum = cash is num ? cash.toDouble() : double.tryParse(cash?.toString() ?? '');
    return RowReviewResult(
      level: level,
      title: title.isEmpty ? _defaultTitle(level) : title,
      detail: detail,
      bannerNote: banner,
      suggestedComment: comment,
      suggestedContextMarkdown: ctx,
      cashflowAmountAdded: cashNum,
    );
  }

  static String _defaultTitle(RowReviewLevel level) => switch (level) {
        RowReviewLevel.ok => 'Looks good',
        RowReviewLevel.caution => 'Needs a look',
        RowReviewLevel.broken => "Doesn't add up",
      };

  /// Merge with a stricter floor (e.g. cashflow credit → at least caution).
  RowReviewResult atLeast(RowReviewLevel floor) {
    if (_rank(level) >= _rank(floor)) return this;
    return RowReviewResult(
      level: floor,
      title: title.isEmpty ? _defaultTitle(floor) : title,
      detail: detail,
      bannerNote: bannerNote,
      suggestedComment: suggestedComment,
      suggestedContextMarkdown: suggestedContextMarkdown,
      cashflowAmountAdded: cashflowAmountAdded,
    );
  }

  static int _rank(RowReviewLevel l) => switch (l) {
        RowReviewLevel.ok => 0,
        RowReviewLevel.caution => 1,
        RowReviewLevel.broken => 2,
      };
}
