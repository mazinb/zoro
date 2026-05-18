import 'package:flutter/material.dart';

import '../../core/finance/asset_context_health.dart';
import '../../core/finance/goals_calculator.dart';

enum ZoroStatusLevel { caution, broken }

/// Icon-only status; tap for a short bottom sheet (never expands inline).
class ZoroStatusIcon extends StatelessWidget {
  const ZoroStatusIcon({
    super.key,
    required this.feasibility,
    this.onAction,
    this.actionLabel,
    this.size = 20,
  });

  factory ZoroStatusIcon.fromGoalFeasibility(
    GoalFeasibility feasibility, {
    VoidCallback? onAction,
    String? actionLabel,
    double size = 20,
  }) {
    return ZoroStatusIcon(
      feasibility: feasibility,
      onAction: onAction,
      actionLabel: actionLabel,
      size: size,
    );
  }

  final GoalFeasibility feasibility;
  final VoidCallback? onAction;
  final String? actionLabel;
  final double size;

  void _showDetail(BuildContext context) {
    if (feasibility.isOk) return;
    final cs = Theme.of(context).colorScheme;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(feasibility.title, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface)),
            if (feasibility.detail.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                feasibility.detail,
                style: TextStyle(fontSize: 14, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600, height: 1.35),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  onAction!();
                },
                child: Text(actionLabel!, style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (feasibility.isOk) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    final isBroken = feasibility.level == GoalFeasibilityLevel.broken;
    final fg = isBroken ? cs.error : const Color(0xFFB45309);
    final icon = isBroken ? Icons.error_outline : Icons.warning_amber_rounded;

    return IconButton(
      icon: Icon(icon, color: fg, size: size),
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      visualDensity: VisualDensity.compact,
      tooltip: feasibility.title,
      onPressed: () => _showDetail(context),
    );
  }
}

/// Warning line under the split slider; omitted when on track.
class ZoroPlanStatusStrip extends StatelessWidget {
  const ZoroPlanStatusStrip({
    super.key,
    required this.feasibility,
    this.onAdjustRetirementDate,
  });

  final GoalFeasibility feasibility;
  final VoidCallback? onAdjustRetirementDate;

  @override
  Widget build(BuildContext context) {
    if (feasibility.isOk) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    final isBroken = feasibility.level == GoalFeasibilityLevel.broken;
    final fg = isBroken ? cs.error : const Color(0xFFB45309);
    final line = feasibility.detail.trim().isNotEmpty ? feasibility.detail : feasibility.title;
    final showAdjust =
        isBroken && feasibility.needsDateAdjust && onAdjustRetirementDate != null;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            line,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: fg,
              height: 1.25,
            ),
          ),
          if (showAdjust)
            TextButton(
              onPressed: onAdjustRetirementDate,
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 28),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                foregroundColor: cs.error,
              ),
              child: const Text(
                'Adjust retirement date',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
              ),
            ),
        ],
      ),
    );
  }
}

/// Reusable caution / broken banner (use sparingly — prefer [ZoroStatusIcon] on tiles).
class ZoroStatusBanner extends StatelessWidget {
  const ZoroStatusBanner({
    super.key,
    required this.level,
    required this.title,
    required this.detail,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  factory ZoroStatusBanner.fromGoalFeasibility(
    GoalFeasibility feasibility, {
    String? actionLabel,
    VoidCallback? onAction,
    bool compact = false,
  }) {
    if (feasibility.isOk) {
      return ZoroStatusBanner(
        level: ZoroStatusLevel.caution,
        title: '',
        detail: '',
        compact: compact,
      );
    }
    return ZoroStatusBanner(
      level: feasibility.level == GoalFeasibilityLevel.broken
          ? ZoroStatusLevel.broken
          : ZoroStatusLevel.caution,
      title: feasibility.title,
      detail: feasibility.detail,
      actionLabel: actionLabel,
      onAction: onAction,
      compact: compact,
    );
  }

  factory ZoroStatusBanner.fromContextHealth(
    AssetContextHealth health, {
    String? actionLabel,
    VoidCallback? onAction,
    bool compact = false,
  }) {
    if (health.isOk) {
      return ZoroStatusBanner(
        level: ZoroStatusLevel.caution,
        title: '',
        detail: '',
        compact: compact,
      );
    }
    return ZoroStatusBanner(
      level: health.level == ContextHealthLevel.broken
          ? ZoroStatusLevel.broken
          : ZoroStatusLevel.caution,
      title: health.title,
      detail: health.detail,
      actionLabel: actionLabel,
      onAction: onAction,
      compact: compact,
    );
  }

  final ZoroStatusLevel level;
  final String title;
  final String detail;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (title.trim().isEmpty && detail.trim().isEmpty) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    final isBroken = level == ZoroStatusLevel.broken;
    final fg = isBroken ? cs.error : const Color(0xFFB45309);
    final bg = isBroken ? cs.errorContainer.withValues(alpha: 0.15) : cs.surfaceContainerHigh;
    final icon = isBroken ? Icons.error_outline : Icons.warning_amber_rounded;
    final line = detail.trim().isNotEmpty ? detail : title;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 12, vertical: compact ? 8 : 9),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: fg, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              line,
              style: TextStyle(fontSize: compact ? 12 : 13, fontWeight: FontWeight.w700, color: fg, height: 1.25),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                foregroundColor: fg,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
              child: Text(actionLabel!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
            ),
        ],
      ),
    );
  }
}
