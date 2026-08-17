import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../goals/goal_widgets.dart';
import '../goals/goals_allocation_sheet.dart';

/// Invest vs savings split of leftover cash. Lives on Ledger → Cash.
class AllocationSplitPanel extends StatelessWidget {
  const AllocationSplitPanel({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final avail = m.availableAfterExpensesMonthly;
    final hide = m.privacyHideAmounts;
    final investPct = m.investPctOfAvailableRounded();
    final savedPct = 100 - investPct;
    final headline = investPct > 50
        ? '$investPct% invested'
        : (investPct == 50 ? '50% saved' : '$savedPct% saved');
    final hasNotes = m.allocationContextMarkdown.trim().isNotEmpty;

    return LiquidGlassPanel(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Center(
                  child: Text(
                    headline,
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface),
                  ),
                ),
              ),
              IconButton(
                icon: Icon(
                  hasNotes ? Icons.notes : Icons.notes_outlined,
                  size: 20,
                  color: hasNotes ? m.accent : cs.onSurfaceVariant,
                ),
                tooltip: 'Allocation notes',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                onPressed: () => openGoalsAllocationSheet(context: context, model: m),
              ),
            ],
          ),
          Slider(
            value: avail <= 0 ? 0.0 : m.allocInvestFraction.clamp(0.0, 1.0),
            divisions: 20,
            onChanged: avail <= 0 ? null : m.setAllocInvestFraction,
          ),
          if (avail > 0)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _EditableFlowAmount(
                    label: 'Savings',
                    amount: m.allocSavingsMonthly,
                    model: m,
                    hide: hide,
                    accent: cs.secondary,
                    align: CrossAxisAlignment.start,
                    onApply: (v) => m.setAllocationMonthlyExact(
                      investMonthly: m.allocInvestmentsMonthly,
                      savingsMonthly: v,
                    ),
                  ),
                ),
                Expanded(
                  child: _EditableFlowAmount(
                    label: 'Invest',
                    amount: m.allocInvestmentsMonthly,
                    model: m,
                    hide: hide,
                    accent: m.accent,
                    align: CrossAxisAlignment.end,
                    onApply: (v) => m.setAllocationMonthlyExact(
                      investMonthly: v,
                      savingsMonthly: m.allocSavingsMonthly,
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _EditableFlowAmount extends StatelessWidget {
  const _EditableFlowAmount({
    required this.label,
    required this.amount,
    required this.model,
    required this.hide,
    required this.accent,
    required this.align,
    required this.onApply,
  });

  final String label;
  final double amount;
  final AppModel model;
  final bool hide;
  final Color accent;
  final CrossAxisAlignment align;
  final ValueChanged<double> onApply;

  Future<void> _edit(BuildContext context) async {
    final ctrl = TextEditingController(
      text: amount > 0 ? goalFormatGrouped(model, amount, hide: hide) : '',
    );
    final next = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('$label /mo', style: const TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Monthly amount', border: OutlineInputBorder()),
          onSubmitted: (_) => Navigator.pop(ctx, goalParseGroupedAmount(ctrl.text)),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, goalParseGroupedAmount(ctrl.text)),
            child: const Text('Update'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (next != null) onApply(next);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final display = goalMoney(model, amount, hide: hide);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: hide ? null : () => _edit(context),
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Column(
            crossAxisAlignment: align,
            children: [
              Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: cs.onSurfaceVariant)),
              Text('$display/mo', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: accent)),
              if (!hide)
                Text(
                  'Tap to update',
                  style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
