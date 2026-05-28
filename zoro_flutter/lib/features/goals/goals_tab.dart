import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/finance/goal_asset_buckets.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../shared/widgets/tab_header_actions.dart';
import '../../shared/widgets/zoro_status_banner.dart';
import 'goal_editor_sheet.dart';
import 'goal_widgets.dart';
import 'goals_ai_flow.dart';
import 'goals_allocation_sheet.dart';
import 'goals_helper_hub_page.dart';
import 'goals_paydown_sheet.dart';

/// Goals tab type scale (aligned with Ledger cards).
abstract final class _GoalsType {
  static const sectionTitle = TextStyle(fontWeight: FontWeight.w900, fontSize: 15);
  static const sectionSubtitle = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
  static const tileTitle = TextStyle(fontWeight: FontWeight.w900, fontSize: 15);
  static const tileBody = TextStyle(fontWeight: FontWeight.w900, fontSize: 14);
  static const tileMeta = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
  static const rowTitle = TextStyle(fontWeight: FontWeight.w800, fontSize: 14);
  static const rowMeta = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
}

class GoalsTab extends StatefulWidget {
  const GoalsTab({
    super.key,
    required this.model,
    this.onGoToLedger,
    this.onGoToSettingsPermissions,
    this.pendingOpenHelper = false,
    this.onPendingOpenHelperHandled,
  });

  final AppModel model;
  final void Function(String section)? onGoToLedger;
  final VoidCallback? onGoToSettingsPermissions;
  final bool pendingOpenHelper;
  final VoidCallback? onPendingOpenHelperHandled;

  @override
  State<GoalsTab> createState() => GoalsTabState();
}

class GoalsTabState extends State<GoalsTab> {
  void openHelperHub() {
    openGoalsHelperHub(
      context: context,
      model: widget.model,
      onOpenSettings: widget.onGoToSettingsPermissions,
    );
  }

  @override
  void didUpdateWidget(GoalsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pendingOpenHelper && !oldWidget.pendingOpenHelper) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        openHelperHub();
        widget.onPendingOpenHelperHandled?.call();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.pendingOpenHelper) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        openHelperHub();
        widget.onPendingOpenHelperHandled?.call();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) => _GoalsBody(
        model: widget.model,
        onGoToLedger: widget.onGoToLedger,
        onGoToSettingsPermissions: widget.onGoToSettingsPermissions,
      ),
    );
  }
}

class _GoalsBody extends StatelessWidget {
  const _GoalsBody({
    required this.model,
    this.onGoToLedger,
    this.onGoToSettingsPermissions,
  });

  final AppModel model;
  final void Function(String section)? onGoToLedger;
  final VoidCallback? onGoToSettingsPermissions;

  Widget _allocationSlider(BuildContext context) {
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

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final hide = m.privacyHideAmounts;
    final accent = m.accent;

    final retirement = m.retirementGoal;
    final policy = m.assetsGoalsPolicy;
    final savingsTotal = totalSavingsPoolBalance(
      assets: m.assets,
      displayValue: m.assetDisplayValue,
      policy: policy,
    );
    final savingsRows = savingsPoolAssets(m.assets, policy).toList()
      ..sort((a, b) => m.assetDisplayValue(b).compareTo(m.assetDisplayValue(a)));

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      children: [
        Row(
          children: [
            Text('Goals', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const Spacer(),
            TabHeaderActions(
              model: m,
              help: TabHelpContent.goals,
              assistantTooltip: 'Goals helper',
              onAssistant: () => openGoalsAiAssistant(
                context: context,
                model: m,
                onOpenSettings: onGoToSettingsPermissions,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _allocationSlider(context),
        const SizedBox(height: 12),
        _GoalsSection(
          title: 'Investments',
          subtitle: '',
          showSubtitle: false,
          children: [
            if (retirement == null)
              Text(
                'No retirement goal.',
                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
              )
            else
              _GoalTile(
                model: m,
                goal: retirement,
                accent: accent,
                hide: hide,
                onTap: () => openGoalEditorSheet(context: context, model: m, goalId: retirement.id),
              ),
          ],
        ),
        const SizedBox(height: 10),
        _GoalsSection(
          title: 'Savings',
          headerTrailing: _SavingsSalaryPctBox(model: m),
          subtitle: savingsTotal > 0 || m.allocSavingsMonthly > 0
              ? '${goalMoney(m, savingsTotal, hide: hide)} · ${goalMoney(m, m.allocSavingsMonthly, hide: hide)}/mo'
              : '—',
          children: [
            if (savingsRows.isEmpty)
              Text(
                'Add savings accounts in Ledger, or link cash in Ledger → Cash.',
                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
              )
            else
              ...savingsRows.map(
                (a) => _SavingsAssetRow(model: m, asset: a, hide: hide),
              ),
            if (m.liabilities.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Loans', style: _GoalsType.sectionTitle.copyWith(color: cs.onSurface)),
              const SizedBox(height: 6),
              ...m.liabilities.map((l) {
                final liabilityId = l.id;
                return _LiabilityRow(
                  key: ValueKey<String>(liabilityId),
                  model: m,
                  liability: l,
                  hide: hide,
                  onTap: () => openGoalsPaydownSheet(
                    context: context,
                    model: m,
                    liabilityId: liabilityId,
                  ),
                );
              }),
            ],
          ],
        ),
      ],
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
              Text(label, style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant)),
              Text('$display/mo', style: _GoalsType.tileBody.copyWith(color: accent)),
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

class _SavingsSalaryPctBox extends StatefulWidget {
  const _SavingsSalaryPctBox({required this.model});

  final AppModel model;

  @override
  State<_SavingsSalaryPctBox> createState() => _SavingsSalaryPctBoxState();
}

class _SavingsSalaryPctBoxState extends State<_SavingsSalaryPctBox> {
  late final TextEditingController _pctCtrl;
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _pctCtrl = TextEditingController(text: _formatPct(widget.model.savingsPctOfSalary));
    _focus.addListener(() => setState(() {}));
  }

  String _formatPct(double v) {
    if (v <= 0.005) return '0';
    final r = v.round();
    if ((v - r).abs() < 0.05) return r.toString();
    return v.toStringAsFixed(1);
  }

  double? _parsePct(String raw) {
    final t = raw.trim().replaceAll('%', '');
    if (t.isEmpty) return 0;
    return double.tryParse(t);
  }

  void _applyPct({bool dismissKeyboard = false}) {
    final v = _parsePct(_pctCtrl.text);
    if (v == null) return;
    widget.model.setAllocFromSavingsPctOfSalary(v);
    _pctCtrl.text = _formatPct(widget.model.savingsPctOfSalary);
    if (dismissKeyboard) _focus.unfocus();
  }

  @override
  void dispose() {
    _focus.dispose();
    _pctCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        final editing = _focus.hasFocus;
        final pct = widget.model.savingsPctOfSalary;
        if (!editing) {
          final next = _formatPct(pct);
          if (_pctCtrl.text != next) _pctCtrl.text = next;
        }
        final over = pct > 100.01;
        final cs = Theme.of(context).colorScheme;
        final fg = over ? cs.error : cs.onSurface;
        const fieldW = 52.0;
        const suffixW = 58.0;
        const boxH = 34.0;

        return SizedBox(
          height: boxH,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              border: Border.all(color: over ? cs.error.withValues(alpha: 0.6) : cs.outlineVariant),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: fieldW,
                  child: TextField(
                    controller: _pctCtrl,
                    focusNode: _focus,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _applyPct(dismissKeyboard: true),
                    onEditingComplete: () => _applyPct(dismissKeyboard: true),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                    ],
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      color: fg,
                      height: 1.2,
                    ),
                    textAlign: TextAlign.center,
                    decoration: const InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.zero,
                      isCollapsed: true,
                    ),
                  ),
                ),
                SizedBox(
                  width: suffixW,
                  child: editing
                      ? Align(
                          alignment: Alignment.centerRight,
                          child: IconButton(
                            icon: Icon(Icons.check, size: 18, color: widget.model.accent),
                            tooltip: 'Apply',
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                            onPressed: () => _applyPct(dismissKeyboard: true),
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            Text(
                              '%',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: fg),
                            ),
                            const SizedBox(width: 3),
                            Text(
                              'salary',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: over ? cs.error : cs.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _GoalsSection extends StatelessWidget {
  const _GoalsSection({
    required this.title,
    required this.subtitle,
    required this.children,
    this.showSubtitle = true,
    this.headerTrailing,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final bool showSubtitle;
  final Widget? headerTrailing;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hasSubtitle = showSubtitle && subtitle.trim().isNotEmpty && subtitle != '—';
    return LiquidGlassPanel(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: Text(title, style: _GoalsType.sectionTitle)),
              ?headerTrailing,
            ],
          ),
          if (hasSubtitle) ...[
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: _GoalsType.sectionSubtitle.copyWith(color: cs.onSurfaceVariant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          SizedBox(height: hasSubtitle ? 10 : 8),
          ...children,
        ],
      ),
    );
  }
}

class _SavingsAssetRow extends StatelessWidget {
  const _SavingsAssetRow({
    required this.model,
    required this.asset,
    required this.hide,
  });

  final AppModel model;
  final LedgerAssetRow asset;
  final bool hide;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final name = asset.name.trim().isEmpty ? asset.type.label : asset.name.trim();
    final balance = model.assetDisplayValue(asset);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(asset.type.icon, size: 20, color: cs.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(child: Text(name, style: _GoalsType.rowTitle)),
          Text(
            goalMoney(model, balance, hide: hide),
            style: _GoalsType.tileBody,
          ),
        ],
      ),
    );
  }
}

class _LiabilityRow extends StatelessWidget {
  const _LiabilityRow({
    super.key,
    required this.model,
    required this.liability,
    required this.hide,
    required this.onTap,
  });

  final AppModel model;
  final LedgerLiabilityRow liability;
  final bool hide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final pay = model.liabilityPaydownMonthly(liability);
    final payoff = goalLiabilityPayoffDateLabel(model, liability);
    final name = liability.name.trim().isEmpty ? liability.type.label : liability.name.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Icon(liability.type.icon, size: 20, color: cs.onSurfaceVariant),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: _GoalsType.rowTitle),
                    Text(
                      pay > 0
                          ? '${goalMoney(model, pay, hide: hide)}/mo${payoff != null ? ' · $payoff' : ''}'
                          : (payoff ?? 'Set paydown'),
                      style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 22, color: cs.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoalTile extends StatelessWidget {
  const _GoalTile({
    required this.model,
    required this.goal,
    required this.accent,
    required this.hide,
    required this.onTap,
  });

  final AppModel model;
  final FinancialGoal goal;
  final Color accent;
  final bool hide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final current = model.goalCurrentAmount(goal);
    final corpusBase = model.goalRetirementCorpusBaseAmount(goal);
    final surplus = model.goalRetirementSurplusTotal(goal);
    final feas = model.retirementInvestFeasibility(goal);
    final timeLabel = retirementTimeToTargetLabel(model, goal);
    final amountsLine = retirementAmountsLine(model, goal, hide: hide);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _RetirementLeadingIcon(feasibility: feas, accent: accent),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(child: Text('Retirement', style: _GoalsType.tileTitle)),
                            if (timeLabel.isNotEmpty)
                              Text(
                                timeLabel,
                                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          amountsLine,
                          style: _GoalsType.tileMeta.copyWith(color: cs.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, size: 22, color: cs.onSurfaceVariant),
                ],
              ),
              const SizedBox(height: 8),
              RetirementGoalProgressBar(
                corpusBase: corpusBase,
                surplus: surplus,
                current: current,
                accent: accent,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetirementLeadingIcon extends StatelessWidget {
  const _RetirementLeadingIcon({
    required this.feasibility,
    required this.accent,
  });

  final GoalFeasibility feasibility;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    const box = 34.0;
    const iconSize = 26.0;

    if (!feasibility.isOk) {
      return SizedBox(
        width: box,
        height: box,
        child: Center(
          child: ZoroStatusIcon.fromGoalFeasibility(feasibility, size: iconSize),
        ),
      );
    }
    return SizedBox(
      width: box,
      height: box,
      child: Icon(Icons.trending_up, color: accent, size: iconSize),
    );
  }
}
