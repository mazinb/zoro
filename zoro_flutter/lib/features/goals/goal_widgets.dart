import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';

String goalMoney(AppModel model, double v, {bool hide = false}) {
  final s = formatCurrencyDisplay(v, currency: model.displayCurrency);
  return hide ? maskSensitiveNumberString(s) : s;
}

/// Grouped integer string for goal amount fields (matches Ledger editors).
String goalFormatGrouped(AppModel model, double v, {bool hide = false}) {
  final s = formatGroupedInteger(v.round(), currency: model.displayCurrency);
  return hide ? maskSensitiveNumberString(s) : s;
}

double goalParseGroupedAmount(String raw) {
  final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return 0;
  return double.tryParse(digits) ?? 0;
}

String goalDateLabel(DateTime? d) {
  if (d == null) return 'No date';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.year}';
}

int? goalMonthsRemaining(DateTime? target) {
  if (target == null) return null;
  final now = DateTime.now();
  return (target.year - now.year) * 12 + (target.month - now.month);
}

/// e.g. `8 mo`, `3 yr`, `2 yr 4 mo`, `Past due`.
/// One-line shortfall vs corpus (invest /mo toward target).
String retirementMonthlyNeedLine(AppModel model, FinancialGoal goal, {bool hide = false}) {
  final required = model.goalRequiredMonthlySavingsFor(goal);
  final invest = model.allocInvestmentsMonthly;
  if (goal.targetDate == null && required <= 0.5) return '';
  if (required <= 0.5) return 'On track';
  if (invest >= required * 0.95) {
    return 'On track · ${goalMoney(model, invest, hide: hide)}/mo';
  }
  return 'Need ${goalMoney(model, required, hide: hide)}/mo';
}

/// Retire-by label from saved date or plan-implied date.
String retirementTimeToTargetLabel(AppModel model, FinancialGoal goal) {
  final d = goal.targetDate ?? model.retirementTargetDateFromPlan(goal);
  return goalTimeToTargetLabel(d);
}

String goalTimeToTargetLabel(DateTime? target) {
  final months = goalMonthsRemaining(target);
  if (months == null) return '';
  if (months <= 0) return 'Past due';
  if (months < 12) return '$months mo';
  final years = months ~/ 12;
  final rem = months % 12;
  if (rem == 0) return '$years yr';
  return '$years yr $rem mo';
}

String? goalLiabilityPayoffDateLabel(AppModel model, LedgerLiabilityRow liability) {
  final pay = model.liabilityPaydownMonthly(liability);
  if (pay <= 0) return null;
  final balance = model.liabilityDisplayValue(liability);
  if (balance <= 0) return null;
  final months = (balance / pay).ceil();
  final now = DateTime.now();
  final paid = DateTime(now.year, now.month + months, now.day);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${names[paid.month - 1]} ${paid.year}';
}

class GoalProgressBar extends StatelessWidget {
  const GoalProgressBar({
    super.key,
    required this.fraction,
    required this.accent,
  });

  final double? fraction;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final f = fraction ?? 0;
    final track = isDark
        ? cs.onSurface.withValues(alpha: 0.28)
        : cs.outline.withValues(alpha: 0.55);
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: LinearProgressIndicator(
        value: fraction == null ? null : f.clamp(0.0, 1.0),
        minHeight: 8,
        backgroundColor: track,
        color: accent,
      ),
    );
  }
}

/// Retirement: corpus zone + subtle surplus tail; fill shows progress through both.
class RetirementGoalProgressBar extends StatelessWidget {
  const RetirementGoalProgressBar({
    super.key,
    required this.corpusBase,
    required this.surplus,
    required this.current,
    required this.accent,
  });

  final double corpusBase;
  final double surplus;
  final double current;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Trough behind segments — reads clearly on glass in light and dark.
    final trough = isDark
        ? cs.surfaceContainerHighest.withValues(alpha: 0.55)
        : cs.surfaceContainerHigh;
    final corpusTrack = isDark
        ? cs.onSurface.withValues(alpha: 0.2)
        : cs.outlineVariant.withValues(alpha: 0.55);
    final surplusTrack = isDark
        ? cs.onSurface.withValues(alpha: 0.32)
        : cs.outline.withValues(alpha: 0.35);
    final borderColor = isDark
        ? cs.outline.withValues(alpha: 0.55)
        : cs.outlineVariant;
    final dividerColor = isDark ? cs.outline.withValues(alpha: 0.95) : cs.outline;
    const barHeight = 10.0;
    const dividerWidth = 2.0;
    const segmentGap = 1.0;

    final total = (corpusBase + surplus).clamp(0.001, double.infinity);
    final corpusEnd = (corpusBase / total).clamp(0.0, 1.0);
    final fillEnd = (current / total).clamp(0.0, 1.0);
    final inSurplus = current > corpusBase + 0.5;

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final dividerX = surplus > 0.5 ? w * corpusEnd : 0.0;

        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            color: trough,
            border: Border.all(color: borderColor, width: 1),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: SizedBox(
              height: barHeight,
              child: Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(1),
                    child: Row(
                      children: [
                        Expanded(
                          flex: (corpusBase * 1000).round().clamp(1, 1000000),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: corpusTrack,
                              borderRadius: BorderRadius.horizontal(
                                left: const Radius.circular(4),
                                right: surplus > 0.5 ? Radius.zero : const Radius.circular(4),
                              ),
                            ),
                          ),
                        ),
                        if (surplus > 0.5) ...[
                          SizedBox(width: segmentGap),
                          Expanded(
                            flex: (surplus * 1000).round().clamp(1, 1000000),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: surplusTrack,
                                borderRadius: const BorderRadius.horizontal(right: Radius.circular(4)),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (fillEnd > 0.001)
                    Padding(
                      padding: const EdgeInsets.all(1),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          width: (w - 2) * fillEnd,
                          decoration: BoxDecoration(
                            color: inSurplus ? accent.withValues(alpha: 0.72) : accent,
                            borderRadius: BorderRadius.horizontal(
                              left: const Radius.circular(4),
                              right: fillEnd >= 0.995 ? const Radius.circular(4) : Radius.zero,
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (surplus > 0.5 && corpusEnd > 0.02 && corpusEnd < 0.98)
                    Positioned(
                      left: dividerX - dividerWidth / 2,
                      top: 1,
                      bottom: 1,
                      child: Container(
                        width: dividerWidth,
                        decoration: BoxDecoration(
                          color: dividerColor,
                          borderRadius: BorderRadius.circular(1),
                          boxShadow: isDark
                              ? null
                              : [
                                  BoxShadow(
                                    color: cs.shadow.withValues(alpha: 0.12),
                                    blurRadius: 0,
                                    offset: const Offset(0.5, 0),
                                  ),
                                ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

String retirementAmountsLine(AppModel model, FinancialGoal goal, {bool hide = false}) {
  final current = model.goalCurrentAmount(goal);
  final base = model.goalRetirementCorpusBaseAmount(goal);
  final surplus = model.goalRetirementSurplusTotal(goal);
  final cur = goalMoney(model, current, hide: hide);
  final baseTxt = goalMoney(model, base, hide: hide);
  if (surplus <= 0.5) return '$cur → $baseTxt';
  return '$cur → $baseTxt + ${goalMoney(model, surplus, hide: hide)}';
}

class GoalCardShell extends StatelessWidget {
  const GoalCardShell({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final panel = LiquidGlassPanel(
      padding: padding,
      child: child,
    );
    if (onTap == null) return panel;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: panel,
      ),
    );
  }
}

class GoalSavingsChip extends StatelessWidget {
  const GoalSavingsChip({
    super.key,
    required this.label,
    required this.amountText,
    this.highlight = false,
  });

  final String label;
  final String amountText;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: highlight ? cs.primary.withValues(alpha: 0.14) : cs.surfaceContainerHigh,
        border: Border.all(
          color: highlight ? cs.primary.withValues(alpha: 0.4) : cs.outlineVariant,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            amountText,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: cs.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

String goalAssetLabel(AppModel model, String assetId) {
  final a = model.assetById(assetId);
  if (a == null) return 'Missing';
  final name = a.name.trim();
  return name.isEmpty ? a.type.label : name;
}

IconData goalAssetIcon(AppModel model, String assetId) {
  return model.assetById(assetId)?.type.icon ?? Icons.account_balance_wallet_outlined;
}
