import 'package:flutter/material.dart';

import '../../core/finance/row_review_result.dart';
import 'modal_sheet_insets.dart';

/// Leading slot on a card: spinner while reviewing, green check when ok, warning/error otherwise.
class RowReviewLeadingIcon extends StatelessWidget {
  const RowReviewLeadingIcon({
    super.key,
    required this.reviewing,
    required this.result,
    required this.defaultIcon,
    required this.accent,
    this.onStatusTap,
    this.size = 44,
    this.iconSize = 26,
  });

  final bool reviewing;
  final RowReviewResult? result;
  final IconData defaultIcon;
  final Color accent;
  final VoidCallback? onStatusTap;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    if (reviewing) {
      return SizedBox(
        width: size,
        height: size,
        child: Center(
          child: SizedBox(
            width: iconSize,
            height: iconSize,
            child: CircularProgressIndicator(strokeWidth: 2.2, color: accent),
          ),
        ),
      );
    }

    final r = result;
    if (r == null) {
      return _defaultBox();
    }

    if (r.isOk) {
      return SizedBox(
        width: size,
        height: size,
        child: Icon(Icons.check_circle, color: Colors.green.shade600, size: iconSize),
      );
    }

    final cs = Theme.of(context).colorScheme;
    final isBroken = r.level == RowReviewLevel.broken;
    final fg = isBroken ? cs.error : const Color(0xFFB45309);
    final icon = isBroken ? Icons.error_outline : Icons.warning_amber_rounded;

    return SizedBox(
      width: size,
      height: size,
      child: IconButton(
        icon: Icon(icon, color: fg, size: iconSize),
        padding: EdgeInsets.zero,
        constraints: BoxConstraints(minWidth: size, minHeight: size),
        visualDensity: VisualDensity.compact,
        tooltip: r.title,
        onPressed: onStatusTap ?? () => showRowReviewDetailSheet(context, r),
      ),
    );
  }

  Widget _defaultBox() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(defaultIcon, color: accent, size: iconSize * 0.85),
    );
  }
}

void showRowReviewDetailSheet(BuildContext context, RowReviewResult result) {
  if (result.isOk) return;
  final feas = result.toGoalFeasibility();
  final cs = Theme.of(context).colorScheme;
  showAppModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            feas.title,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 16,
              color: cs.onSurface,
            ),
          ),
          if (feas.detail.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              feas.detail,
              style: TextStyle(
                fontSize: 14,
                color: cs.onSurfaceVariant,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          if (result.cashflowAmountAdded != null && result.cashflowAmountAdded! > 0.005) ...[
            const SizedBox(height: 8),
            Text(
              'Cashflow added about ${result.cashflowAmountAdded!.round()} to this balance — verify in Ledger → Cash.',
              style: TextStyle(
                fontSize: 13,
                color: cs.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

/// Dismissable banner above card body; status icon replaces default when note is active.
class RowReviewNoteBanner extends StatelessWidget {
  const RowReviewNoteBanner({
    super.key,
    required this.note,
    required this.level,
    required this.onDismiss,
  });

  final String note;
  final RowReviewLevel level;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    if (note.trim().isEmpty) return const SizedBox.shrink();
    final isBroken = level == RowReviewLevel.broken;
    final fg = isBroken
        ? Theme.of(context).colorScheme.error
        : const Color(0xFFB45309);
    final bg = isBroken
        ? Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.15)
        : Theme.of(context).colorScheme.surfaceContainerHigh;
    final icon = isBroken ? Icons.error_outline : Icons.warning_amber_rounded;

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: fg, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              note,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: fg,
                height: 1.3,
              ),
            ),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 16, color: fg),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            onPressed: onDismiss,
            tooltip: 'Dismiss',
          ),
        ],
      ),
    );
  }
}
