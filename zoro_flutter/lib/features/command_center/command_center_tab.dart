import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:sankey_flutter/sankey_helpers.dart';
import 'package:sankey_flutter/sankey_link.dart';
import 'package:sankey_flutter/sankey_node.dart';

import '../../core/state/app_model.dart';
import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../shared/theme/app_theme.dart';
import 'zoro_interactive_sankey_painter.dart';

class CommandCenterTab extends StatefulWidget {
  const CommandCenterTab({super.key, required this.model, required this.onGoToLedger});

  final AppModel model;
  final void Function(String section) onGoToLedger;

  @override
  State<CommandCenterTab> createState() => _CommandCenterTabState();
}

class _CommandCenterTabState extends State<CommandCenterTab> {
  SankeyNode? _selectedNode;
  bool _expanded = false;
  _SelectedKind? _selectedKind;

  String _fmtDate(DateTime? d) {
    if (d == null) return '—';
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${names[d.month - 1]} ${d.day}, ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    final sankey = _SankeyModel.fromApp(widget.model);
    final showExpenseDetails = _selectedKind == _SelectedKind.expenses && _expanded;
    final hideNet = widget.model.privacyHideAmounts;
    final reminders = <_ReminderItem>[
      if (widget.model.remindersExpensesCadence != ReminderCadence.off)
        _ReminderItem(
          title: 'Review expense estimates',
          subtitle: 'Last updated ${_fmtDate(widget.model.expenseEstimatesLastUpdated)} • quarterly',
          actionLabel: 'Review',
          onTap: () => widget.onGoToLedger('expenses'),
          icon: Icons.pie_chart_outline,
          overdue: widget.model.expensesReviewOverdue,
        ),
      if (widget.model.remindersCashflowCadence != ReminderCadence.off)
        _ReminderItem(
          title: 'Add this month’s cash flow',
          subtitle: 'Due monthly (day ${widget.model.remindersMonthlyDayOfMonth})',
          actionLabel: 'Open',
          onTap: () => widget.onGoToLedger('cashflow'),
          icon: Icons.playlist_add,
          overdue: widget.model.cashflowReviewOverdue,
        ),
      if (widget.model.remindersIncomeCadence != ReminderCadence.off)
        _ReminderItem(
          title: 'Review income & tax',
          subtitle: 'Last updated ${_fmtDate(widget.model.incomeLastUpdated)} • yearly',
          actionLabel: 'Review',
          onTap: () => widget.onGoToLedger('income'),
          icon: Icons.payments_outlined,
          overdue: widget.model.incomeReviewOverdue,
        ),
      if (widget.model.remindersAssetsCadence != ReminderCadence.off)
        _ReminderItem(
          title: 'Review assets',
          subtitle: 'Last reviewed ${_fmtDate(widget.model.assetsLastReviewed)}',
          actionLabel: 'Review',
          onTap: () => widget.onGoToLedger('assets'),
          icon: Icons.savings_outlined,
          overdue: widget.model.assetsReviewOverdue,
        ),
      if (widget.model.remindersLiabilitiesCadence != ReminderCadence.off)
        _ReminderItem(
          title: 'Review liabilities',
          subtitle: 'Last reviewed ${_fmtDate(widget.model.liabilitiesLastReviewed)}',
          actionLabel: 'Review',
          onTap: () => widget.onGoToLedger('liabilities'),
          icon: Icons.credit_card,
          overdue: widget.model.liabilitiesReviewOverdue,
        ),
    ];
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 20),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                'Home',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const Spacer(),
              SegmentedButton<CurrencyCode>(
                segments: const [
                  ButtonSegment(value: CurrencyCode.usd, label: Text('USD')),
                  ButtonSegment(value: CurrencyCode.thb, label: Text('THB')),
                  ButtonSegment(value: CurrencyCode.inr, label: Text('INR')),
                ],
                selected: {widget.model.displayCurrency},
                onSelectionChanged: (s) => widget.model.setDisplayCurrency(s.first),
                style: ButtonStyle(
                  side: const WidgetStatePropertyAll(BorderSide(color: AppTheme.slate100)),
                  backgroundColor: WidgetStateProperty.resolveWith((states) {
                    if (states.contains(WidgetState.selected)) {
                      return widget.model.accent.withValues(alpha: 0.12);
                    }
                    return Colors.white;
                  }),
                  foregroundColor: WidgetStateProperty.resolveWith((states) {
                    if (states.contains(WidgetState.selected)) return widget.model.accent;
                    return AppTheme.slate600;
                  }),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 6, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          hideNet
                              ? maskSensitiveNumberString(
                                  formatCurrencyDisplay(widget.model.netWorthDisplay, currency: widget.model.displayCurrency),
                                )
                              : formatCurrencyDisplay(widget.model.netWorthDisplay, currency: widget.model.displayCurrency),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 26,
                            height: 1.1,
                            color: hideNet ? AppTheme.slate500.withValues(alpha: 0.9) : AppTheme.slate900,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          hideNet
                              ? maskSensitiveNumberString(
                                  'Assets ${formatCurrencyDisplay(widget.model.totalAssetsDisplay, currency: widget.model.displayCurrency)} • '
                                  'Liabilities ${formatCurrencyDisplay(widget.model.totalLiabilitiesDisplay, currency: widget.model.displayCurrency)}',
                                )
                              : 'Assets ${formatCurrencyDisplay(widget.model.totalAssetsDisplay, currency: widget.model.displayCurrency)} • '
                                  'Liabilities ${formatCurrencyDisplay(widget.model.totalLiabilitiesDisplay, currency: widget.model.displayCurrency)}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppTheme.slate500,
                            fontSize: 11,
                            height: 1.15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: () => widget.model.setPrivacyHideAmounts(!widget.model.privacyHideAmounts),
                    tooltip: hideNet ? 'Show amounts' : 'Hide amounts',
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                    style: IconButton.styleFrom(
                      backgroundColor: widget.model.accentSoft,
                      foregroundColor: widget.model.accent,
                    ),
                    icon: Icon(hideNet ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 22),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          margin: EdgeInsets.zero,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(0, 16, 0, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SankeyPlaceholder(
                  model: sankey,
                  selectedNode: _selectedNode,
                  fullBleed: true,
                  onNodeSelected: (n) {
                    setState(() {
                      _selectedNode = n;
                      _selectedKind = _kindFromLabel(n?.displayLabel);
                    });
                  },
                  onTapFlow: (f) async {
                    if (widget.model.privacyHideAmounts) return;
                    final v = await _quickEditValue(context, f.label, f.monthly);
                    if (v != null) {
                      // Push edits into shared model so Ledger reflects it.
                      if (f.kind == _FlowKind.expenseBucket && f.expenseKey != null) {
                        final key = f.expenseKey!;
                        widget.model.setExpenseBucket(key, v);
                      } else if (f.kind == _FlowKind.allocation && f.allocationKey != null) {
                        switch (f.allocationKey) {
                          case 'investments':
                            widget.model.setAllocationInvestments(v);
                            break;
                          case 'savings':
                            widget.model.setAllocationSavings(v);
                            break;
                        }
                      }
                    }
                  },
                ),
                const SizedBox(height: 12),
                if (_selectedKind != null) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _SelectionCard(
                      kind: _selectedKind!,
                      expanded: _expanded,
                      onGoToLedger: widget.onGoToLedger,
                      onToggleDetails: () => setState(() => _expanded = !_expanded),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                if (showExpenseDetails) ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: _ExpenseDetailsRows(
                      model: widget.model,
                      maskAmounts: widget.model.privacyHideAmounts,
                      onGoToLedger: () => widget.onGoToLedger('expenses'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (reminders.isNotEmpty) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _RemindersCard(items: reminders, accent: widget.model.accent),
          ),
        ],
      ],
    );
  }

  Future<double?> _quickEditValue(BuildContext context, String title, double current) async {
    final ctrl = TextEditingController(text: current.round().toString());
    final res = await showModalBottomSheet<double>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        final bottom = MediaQuery.of(context).viewInsets.bottom;
        return Padding(
          padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Quick edit',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 6),
              Text(title, style: const TextStyle(color: AppTheme.slate600)),
              const SizedBox(height: 14),
              TextField(
                controller: ctrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Monthly value',
                  prefixText: widget.model.displayCurrencySymbol,
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () {
                  final v = double.tryParse(ctrl.text.trim());
                  Navigator.of(context).pop(v);
                },
                child: const Text('Update'),
              ),
            ],
          ),
        );
      },
    );
    return res;
  }
}

class _Flow {
  _Flow(this.label, this.monthly, this.color)
      : from = '',
        to = '',
        stage = _FlowStage.sourceToMiddle;

  _Flow._(this.from, this.to, this.monthly, this.color, {required this.stage})
      : label = '$from → $to';

  final String label;
  final String from;
  final String to;
  final _FlowStage stage;
  double monthly;
  final Color color;

  _FlowKind kind = _FlowKind.other;
  String? expenseKey;
  String? allocationKey;
}

enum _FlowKind { incomeSource, expenseBucket, allocation, other }

class _SankeyPlaceholder extends StatelessWidget {
  const _SankeyPlaceholder({
    required this.model,
    required this.selectedNode,
    required this.onNodeSelected,
    required this.onTapFlow,
    this.fullBleed = false,
  });

  final _SankeyModel model;
  final SankeyNode? selectedNode;
  final ValueChanged<SankeyNode?> onNodeSelected;
  final ValueChanged<_Flow> onTapFlow;
  final bool fullBleed;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: fullBleed ? 16 : 0),
          child: Text(
            selectedNode?.displayLabel.trim().isNotEmpty == true ? selectedNode!.displayLabel : 'Tap a category',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 300,
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppTheme.slate50,
            borderRadius: BorderRadius.circular(fullBleed ? 0 : 12),
            border: fullBleed ? null : Border.all(color: AppTheme.slate100),
          ),
          child: LayoutBuilder(
            builder: (context, c) {
              final w = c.maxWidth.isFinite && c.maxWidth > 0
                  ? c.maxWidth
                  : MediaQuery.sizeOf(context).width;
              final h = c.maxHeight.isFinite && c.maxHeight > 0
                  ? c.maxHeight
                  : 260.0;
              final width = w;
              final height = math.max(h, 200.0);

              final graph = model.toSankeyDataSet(width: width, height: height);
              // 3-blues palette (used across the app).
              const blue = AppTheme.blue;
              const ink = AppTheme.slate900;

              Color lerpToInk(double t) => Color.lerp(blue, ink, t) ?? ink;

              Color colorForNodeLabel(String label) {
                final head = label.split(RegExp(r'\s{2,}')).first.trim();
                final l = head.toLowerCase();
                // Column gradient: left bright → middle medium → right near-black.
                if (l == 'all income' || l == 'net income') return lerpToInk(0.45);
                if (l == 'taxes') return lerpToInk(0.65);
                if (l == 'expenses') return lerpToInk(0.78);
                if (l == 'investments') return lerpToInk(0.72);
                if (l == 'savings') return lerpToInk(0.68);
                return blue; // sources
              }

              String nodeDisplayName(SankeyNode n) {
                final d = n.displayLabel.trim();
                return d.isNotEmpty ? d : (n.label ?? '');
              }

              final nodeColors = <String, Color>{
                for (final n in graph.nodes) n.displayLabel: colorForNodeLabel(nodeDisplayName(n)),
              };
              final selectedId = selectedNode?.id;
              if (selectedId is int) {
                // Selection: keep normal colors, just tint the selected node.
                final selected = graph.nodes.where((n) => n.id == selectedId).cast<SankeyNode?>().firstOrNull;
                if (selected != null) {
                  nodeColors[selected.displayLabel] = Theme.of(context).colorScheme.primary.withValues(alpha: 0.75);
                }
              }

              final chart = GestureDetector(
                onTapDown: (details) {
                  final tapped = detectTappedNode(graph.nodes, details.localPosition);
                  onNodeSelected(tapped);
                },
                child: CustomPaint(
                  size: Size(width, height),
                  painter: ZoroInteractiveSankeyPainter(
                    nodes: graph.nodes,
                    links: graph.links,
                    nodeColors: nodeColors,
                    selectedNodeId: selectedId as int?,
                    showLabels: true,
                    showTexture: true,
                  ),
                ),
              );

              return fullBleed
                  ? chart
                  : ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: chart,
                    );
            },
          ),
        ),
      ],
    );
  }

}

enum _SelectedKind { income, expenses, allocations, summary }

_SelectedKind? _kindFromLabel(String? label) {
  final raw = label ?? '';
  final head = raw.split(RegExp(r'\s{2,}')).first.toLowerCase();
  if (head.startsWith('expenses')) return _SelectedKind.expenses;
  if (head.startsWith('investments') || head.startsWith('savings')) {
    return _SelectedKind.allocations;
  }
  if (head.startsWith('all income') || head.startsWith('net income') || head.startsWith('taxes')) {
    return _SelectedKind.summary;
  }
  final l = raw.toLowerCase();
  if (l.contains('housing') ||
      l.contains('food') ||
      l.contains('transport') ||
      l.contains('health') ||
      l.contains('entertain') ||
      l.contains('travel') ||
      l.contains('one-off') ||
      l.contains('other expenses')) {
    return _SelectedKind.expenses;
  }
  if (head.isNotEmpty) return _SelectedKind.income;
  return null;
}

class _SelectionCard extends StatelessWidget {
  const _SelectionCard({
    required this.kind,
    required this.expanded,
    required this.onGoToLedger,
    required this.onToggleDetails,
  });

  final _SelectedKind kind;
  final bool expanded;
  final void Function(String section) onGoToLedger;
  final VoidCallback onToggleDetails;

  @override
  Widget build(BuildContext context) {
    final narrow = MediaQuery.sizeOf(context).width < 420;
    late final String title;
    late final String subtitle;
    late final VoidCallback primaryAction;
    late final String primaryLabel;

    String? secondaryLabel;
    VoidCallback? secondaryAction;

    switch (kind) {
      case _SelectedKind.expenses:
        title = 'Expenses';
        subtitle = 'Edit the details in Ledger.';
        primaryLabel = 'Go to Ledger';
        primaryAction = () => onGoToLedger('expenses');
        secondaryLabel = expanded ? 'Hide details' : 'View details';
        secondaryAction = onToggleDetails;
        break;
      case _SelectedKind.income:
        title = 'Income';
        subtitle = 'Edit income sources and tax in Ledger.';
        primaryLabel = 'Go to Ledger';
        primaryAction = () => onGoToLedger('income');
        break;
      case _SelectedKind.allocations:
        title = 'Allocations';
        subtitle = 'Adjust cash/FDs vs investments in Ledger.';
        primaryLabel = 'Go to Ledger';
        primaryAction = () => onGoToLedger('allocations');
        break;
      case _SelectedKind.summary:
        title = 'Totals';
        subtitle = 'Derived from your Ledger inputs.';
        primaryLabel = 'Go to Ledger';
        primaryAction = () => onGoToLedger('income');
        break;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.slate50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.slate100),
      ),
      child: narrow
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.slate900)),
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: AppTheme.slate600)),
                const SizedBox(height: 10),
                FilledButton(onPressed: primaryAction, child: Text(primaryLabel)),
                if (secondaryLabel != null && secondaryAction != null) ...[
                  const SizedBox(height: 6),
                  OutlinedButton(onPressed: secondaryAction, child: Text(secondaryLabel)),
                ],
              ],
            )
          : Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.slate900)),
                      const SizedBox(height: 4),
                      Text(subtitle, style: const TextStyle(color: AppTheme.slate600)),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                if (secondaryLabel != null && secondaryAction != null) ...[
                  OutlinedButton(onPressed: secondaryAction, child: Text(secondaryLabel)),
                  const SizedBox(width: 8),
                ],
                FilledButton(onPressed: primaryAction, child: Text(primaryLabel)),
              ],
            ),
    );
  }
}

class _ExpenseDetailsRows extends StatelessWidget {
  const _ExpenseDetailsRows({
    required this.model,
    required this.maskAmounts,
    required this.onGoToLedger,
  });

  final AppModel model;
  final bool maskAmounts;
  final VoidCallback onGoToLedger;

  @override
  Widget build(BuildContext context) {
    final preset = presetForCountry(AppModel.expensePresetCountry);
    final cur = model.displayCurrencySymbol;

    final rows = <({String key, String label, double monthly, Color color})>[];
    for (final k in recurringExpenseBucketKeys) {
      final b = preset.buckets[k]!;
      rows.add((key: k, label: b.label, monthly: (model.expenseBuckets[k] ?? b.value), color: bucketColor(k)));
    }
    rows.sort((a, b) => b.monthly.compareTo(a.monthly));

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.slate100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Expense details', style: TextStyle(fontWeight: FontWeight.w900)),
              ),
              TextButton(onPressed: onGoToLedger, child: const Text('Edit in Ledger')),
            ],
          ),
          const SizedBox(height: 6),
          ...rows.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: r.color, shape: BoxShape.circle)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      r.label,
                      style: const TextStyle(color: AppTheme.slate600, fontWeight: FontWeight.w600),
                    ),
                  ),
                  Text(
                    maskAmounts
                        ? maskSensitiveNumberString(money(r.monthly, currencySymbol: cur))
                        : money(r.monthly, currencySymbol: cur),
                    style: const TextStyle(fontWeight: FontWeight.w900, color: AppTheme.slate900),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReminderItem {
  const _ReminderItem({
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onTap,
    required this.icon,
    required this.overdue,
  });

  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onTap;
  final IconData icon;
  final bool overdue;
}

class _RemindersCard extends StatelessWidget {
  const _RemindersCard({required this.items, required this.accent});

  final List<_ReminderItem> items;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final hasOverdue = items.any((e) => e.overdue);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              hasOverdue ? 'To update' : 'Up to date',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
            if (!hasOverdue) ...[
              const SizedBox(height: 6),
              const Text('All caught up.', style: TextStyle(color: AppTheme.slate600)),
            ],
            const SizedBox(height: 12),
            ...items.map(
              (it) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: it.overdue ? AppTheme.slate50 : AppTheme.slate100.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppTheme.slate100.withValues(alpha: it.overdue ? 1.0 : 0.7),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: it.overdue ? accent.withValues(alpha: 0.12) : AppTheme.slate100.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(it.icon, color: it.overdue ? accent : AppTheme.slate500),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              it.title,
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                color: it.overdue ? AppTheme.slate900 : AppTheme.slate500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              it.subtitle,
                              style: TextStyle(
                                color: it.overdue ? AppTheme.slate600 : AppTheme.slate500.withValues(alpha: 0.85),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      it.overdue
                          ? FilledButton(
                              onPressed: it.onTap,
                              child: Text(it.actionLabel),
                            )
                          : FilledButton(
                              onPressed: it.onTap,
                              style: FilledButton.styleFrom(
                                backgroundColor: AppTheme.slate100.withValues(alpha: 0.95),
                                foregroundColor: AppTheme.slate600,
                              ),
                              child: Text(it.actionLabel),
                            ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _FlowStage { sourceToMiddle, middleToMiddle2, middle2ToSink }

class _SankeyModel {
  final List<String> sources;
  final List<String> middle;
  final List<String> sinks;
  final List<_Flow> links;
  final String modelCurrencySymbol;

  double get maxValue => links.isEmpty
      ? 1
      : links.map((e) => e.monthly).reduce(math.max);

  double totalOut(String from) => links
      .where((e) => e.from == from)
      .fold<double>(0, (a, b) => a + b.monthly);

  double totalIn(String to) => links
      .where((e) => e.to == to)
      .fold<double>(0, (a, b) => a + b.monthly);

  /// Share of **Net income** for right-column sinks (no currency in the painted label).
  static const _sinksWithNetPct = {'Expenses', 'Investments', 'Savings'};

  String? _percentOfNetIncome(String sinkName, Map<String, double> totals) {
    if (!_sinksWithNetPct.contains(sinkName)) return null;
    final v = totals[sinkName] ?? 0;
    if (v <= 0) return null;
    final n = totals['Net income'] ?? 0;
    if (n <= 0) return null;
    return '${(100 * v / n).round()}%';
  }

  /// Single line only: `sankey_flutter` paints labels with `maxLines: 1`.
  /// Sinks: `Expenses  42%` (percent only after the name — no ฿). Sources / middle: name only.
  String _sankeyNodeLabel(String name, Map<String, double> totals) {
    final pct = _percentOfNetIncome(name, totals);
    if (pct != null) return '$name  $pct';
    return name;
  }

  SankeyDataSet toSankeyDataSet({required double width, required double height}) {
    // Preserve ordering so larger buckets are laid out near the top (like the Reddit example).
    // We order within each column by total flow descending.
    double totalForLabel(String l) {
      final inbound = totalIn(l);
      final outbound = totalOut(l);
      return inbound > 0 ? inbound : outbound;
    }

    final orderedSources = [...sources]..sort((a, b) => totalForLabel(b).compareTo(totalForLabel(a)));
    final orderedMiddle = [...middle]..sort((a, b) => totalForLabel(b).compareTo(totalForLabel(a)));
    final orderedSinks = [...sinks]..sort((a, b) => totalForLabel(b).compareTo(totalForLabel(a)));

    final labels = <String>[...orderedSources, ...orderedMiddle, ...orderedSinks];
    final totals = {for (final l in labels) l: totalForLabel(l)};

    final nodes = <SankeyNode>[
      for (var i = 0; i < labels.length; i++)
        SankeyNode(
          id: i,
          label: _sankeyNodeLabel(labels[i], totals),
        ),
    ];

    SankeyNode nodeOf(String label) => nodes[labels.indexOf(label)];

    final sankeyLinks = <SankeyLink>[
      for (final l in links)
        SankeyLink(
          source: nodeOf(l.from),
          target: nodeOf(l.to),
          value: l.monthly,
        ),
    ];

    final data = SankeyDataSet(nodes: nodes, links: sankeyLinks);
    final narrow = width < 380;
    final layout = generateSankeyLayout(
      width: width,
      height: height,
      nodeWidth: narrow ? 10 : 14,
      nodePadding: narrow ? 18 : 26,
    )
      ..topBound = 14
      ..bottomBound = height - 20;
    data.layout(layout);
    return data;
  }

  // ignore: unused_element
  static _SankeyModel _sample() {
    // Inspired by the Reddit example: sources -> all income -> net income + taxes -> allocations.
    const blue = Color(0xFF3B82F6);
    const grey = Color(0xFF94A3B8);
    const teal = Color(0xFF06B6D4);
    const emerald = Color(0xFF10B981);
    const amber = Color(0xFFF59E0B);

    const sources = ['Salary', 'Dividends', 'Side Hustle'];
    const middle = ['All income', 'Net income', 'Taxes'];
    const sinks = ['Fixed costs', 'Fun', 'Investments'];

    final links = <_Flow>[
      _Flow._('Salary', 'All income', 5200, blue, stage: _FlowStage.sourceToMiddle),
      _Flow._('Dividends', 'All income', 420, teal, stage: _FlowStage.sourceToMiddle),
      _Flow._('Side Hustle', 'All income', 380, amber, stage: _FlowStage.sourceToMiddle),

      _Flow._('All income', 'Net income', 4700, grey, stage: _FlowStage.middleToMiddle2),
      _Flow._('All income', 'Taxes', 1300, grey, stage: _FlowStage.middleToMiddle2),

      _Flow._('Net income', 'Fixed costs', 2600, grey, stage: _FlowStage.middle2ToSink),
      _Flow._('Net income', 'Fun', 700, amber, stage: _FlowStage.middle2ToSink),
      _Flow._('Net income', 'Investments', 1400, emerald, stage: _FlowStage.middle2ToSink),
    ];

    return _SankeyModel(
      sources: sources,
      middle: middle,
      sinks: sinks,
      links: links,
      modelCurrencySymbol: '\$',
    );
  }

  static _SankeyModel fromApp(AppModel model) {
    final sources = <String>[];
    final middle = <String>['All income', 'Net income', 'Taxes'];

    // Always keep Expenses grouped in the chart (details are shown as rows below).
    final expenseSinks = <String>['Expenses'];

    final allocSinks = <String>['Investments', 'Savings'];

    final sinks = <String>[...expenseSinks, ...allocSinks];

    final links = <_Flow>[];

    final totalIncomeMonthly = model.totalIncomeAnnualDisplay / 12.0;
    final taxesMonthly = (model.effectiveTaxRatePct ?? 0).clamp(0, 100) / 100.0 * totalIncomeMonthly;
    final netMonthly = (totalIncomeMonthly - taxesMonthly).clamp(0, double.infinity);

    _Flow incomeLink(String from, double v, Color c) {
      final f = _Flow._(from, 'All income', v, c, stage: _FlowStage.sourceToMiddle);
      f.kind = _FlowKind.incomeSource;
      return f;
    }

    const incomeColors = <Color>[
      Color(0xFF1D4ED8), // blueDark
      Color(0xFF3B82F6), // blue
      Color(0xFF93C5FD), // blueLight
    ];
    var colorIndex = 0;
    for (final line in model.incomeLines) {
      if (line.annualAmount <= 0) continue;
      final monthlyNative = line.annualAmount / 12.0;
      final monthlyDisplay = model.moneyInDisplayCurrency(
        monthlyNative,
        currencyCodeForPresetCountry(line.currencyCountry),
      );
      final name = line.label.trim().isEmpty ? 'Income' : line.label.trim();
      sources.add(name);
      final c = incomeColors[colorIndex % incomeColors.length];
      colorIndex++;
      links.add(incomeLink(name, monthlyDisplay, c));
    }

    links.add(
      _Flow._('All income', 'Net income', netMonthly.toDouble(), const Color(0xFF93C5FD), stage: _FlowStage.middleToMiddle2),
    );
    links.add(
      _Flow._('All income', 'Taxes', taxesMonthly.toDouble(), const Color(0xFF1D4ED8), stage: _FlowStage.middleToMiddle2),
    );

    // Expenses (grouped).
    final expenses = _Flow._(
      'Net income',
      'Expenses',
      model.totalExpensesMonthly.toDouble(),
      const Color(0xFF1D4ED8),
      stage: _FlowStage.middle2ToSink,
    );
    expenses.kind = _FlowKind.other;
    links.add(expenses);

    // Allocations: everything remaining after expenses should be allocated.
    final avail = model.availableAfterExpensesMonthly;
    if (avail > 0) {
      // Do NOT notify from within build (Sankey is derived data only).
      model.normalizeAllocations(notify: false);
      final inv = _Flow._('Net income', 'Investments', model.allocInvestmentsMonthly.toDouble(), const Color(0xFF3B82F6), stage: _FlowStage.middle2ToSink);
      inv.kind = _FlowKind.allocation;
      inv.allocationKey = 'investments';
      links.add(inv);

      final sav = _Flow._('Net income', 'Savings', model.allocSavingsMonthly.toDouble(), const Color(0xFF93C5FD), stage: _FlowStage.middle2ToSink);
      sav.kind = _FlowKind.allocation;
      sav.allocationKey = 'savings';
      links.add(sav);
    }

    return _SankeyModel(
      sources: sources,
      middle: middle,
      sinks: sinks,
      links: links,
      modelCurrencySymbol: model.displayCurrencySymbol,
    );
  }

  _SankeyModel({
    required this.sources,
    required this.middle,
    required this.sinks,
    required this.links,
    required this.modelCurrencySymbol,
  });
}

