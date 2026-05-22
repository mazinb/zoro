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
