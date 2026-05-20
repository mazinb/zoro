import 'package:flutter/material.dart';

import '../../core/finance/row_review_result.dart';

/// Single-line subtitle under a ledger card title (comment, note, or banner).
class LedgerCardSubtitle extends StatelessWidget {
  const LedgerCardSubtitle({
    super.key,
    required this.text,
    this.level,
    this.onDismiss,
    this.onApply,
    this.applyLabel,
  });

  final String text;
  final RowReviewLevel? level;
  final VoidCallback? onDismiss;
  final VoidCallback? onApply;
  final String? applyLabel;

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    final isBanner = level != null;
    final isBroken = level == RowReviewLevel.broken;
    final fg = isBanner
        ? (isBroken ? cs.error : const Color(0xFFB45309))
        : cs.outline;

    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text.trim(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: isBanner ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
          if (onApply != null && (applyLabel ?? '').isNotEmpty)
            TextButton(
              onPressed: onApply,
              style: TextButton.styleFrom(
                foregroundColor: fg,
                padding: const EdgeInsets.symmetric(horizontal: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
              child: Text(
                applyLabel!,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
              ),
            ),
          if (onDismiss != null)
            GestureDetector(
              onTap: onDismiss,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Icon(Icons.close, size: 14, color: fg.withValues(alpha: 0.85)),
              ),
            ),
        ],
      ),
    );
  }
}
