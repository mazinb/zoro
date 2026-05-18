import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
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
    final f = fraction ?? 0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: LinearProgressIndicator(
        value: fraction == null ? null : f.clamp(0.0, 1.0),
        minHeight: 7,
        backgroundColor: cs.surfaceContainerHighest.withValues(alpha: 0.65),
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
