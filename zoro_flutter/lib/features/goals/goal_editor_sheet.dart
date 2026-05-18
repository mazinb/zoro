import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../shared/widgets/zoro_status_banner.dart';
import 'goal_context_page.dart';
import 'goal_widgets.dart';

Future<void> openGoalEditorSheet({
  required BuildContext context,
  required AppModel model,
  required String goalId,
}) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _GoalEditorSheet(model: model, goalId: goalId),
  );
}

/// Opens a new target editor without saving until the user taps Save.
Future<void> openNewTargetGoalSheet({
  required BuildContext context,
  required AppModel model,
}) {
  final nextOrder = model.targetGoals.isEmpty
      ? 0
      : model.targetGoals.map((g) => g.sortOrder).reduce((a, b) => a > b ? a : b) + 1;
  final draft = FinancialGoal(
    id: newLedgerRowId('g'),
    kind: FinancialGoalKind.target,
    name: '',
    sortOrder: nextOrder,
  );
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => _GoalEditorSheet(model: model, draftGoal: draft, isNew: true),
  );
}

class _GoalEditorSheet extends StatefulWidget {
  const _GoalEditorSheet({
    required this.model,
    this.goalId,
    this.draftGoal,
    this.isNew = false,
  }) : assert(goalId != null || draftGoal != null);

  final AppModel model;
  final String? goalId;
  final FinancialGoal? draftGoal;
  final bool isNew;

  @override
  State<_GoalEditorSheet> createState() => _GoalEditorSheetState();
}

class _GoalEditorSheetState extends State<_GoalEditorSheet> {
  late TextEditingController _nameCtrl;
  late TextEditingController _targetCtrl;
  DateTime? _targetDate;
  double _swr = 4;
  double _buffer = 0;
  double _savingsWeight = 1;
  late Set<String> _retirementExtras;
  bool _propertyExpanded = false;
  bool _otherExpanded = false;

  FinancialGoal? get _goal => widget.draftGoal ?? widget.model.financialGoalById(widget.goalId ?? '');

  List<LedgerAssetRow> get _propertyAssets =>
      widget.model.assets.where((a) => a.type == LedgerAssetType.property).toList();

  List<LedgerAssetRow> get _otherAssets =>
      widget.model.assets.where((a) => a.type == LedgerAssetType.other).toList();

  @override
  void initState() {
    super.initState();
    final g = _goal;
    _nameCtrl = TextEditingController(text: g?.name ?? '');
    _targetCtrl = TextEditingController(
      text: g != null && g.targetAmount > 0
          ? formatGroupedInteger(g.targetAmount.round(), currency: widget.model.displayCurrency)
          : '',
    );
    _targetDate = g?.targetDate;
    _swr = g?.safeWithdrawalRatePct ?? 4;
    _buffer = g?.corpusBufferPct ?? 0;
    _savingsWeight = g?.savingsWeight ?? 1;
    _retirementExtras = Set<String>.from(widget.model.retirementExtraAssetIds);
    _propertyExpanded = _propertyAssets.any((a) => _retirementExtras.contains(a.id));
    _otherExpanded = _otherAssets.any((a) => _retirementExtras.contains(a.id));
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _targetCtrl.dispose();
    super.dispose();
  }

  double _parseTarget() => goalParseGroupedAmount(_targetCtrl.text);

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _targetDate ?? DateTime(now.year + 5, now.month, now.day),
      firstDate: now,
      lastDate: DateTime(now.year + 60),
    );
    if (picked != null) setState(() => _targetDate = picked);
  }

  void _togglePropertySection(bool on) {
    setState(() {
      _propertyExpanded = on;
      if (!on) {
        for (final a in _propertyAssets) {
          _retirementExtras.remove(a.id);
        }
      }
    });
  }

  void _toggleOtherSection(bool on) {
    setState(() {
      _otherExpanded = on;
      if (!on) {
        for (final a in _otherAssets) {
          _retirementExtras.remove(a.id);
        }
      }
    });
  }

  void _save() {
    final g = _goal;
    if (g == null) return;
    final m = widget.model;
    final target = g.isRetirement
        ? computeRetirementCorpus(
            recurringExpensesMonthly: m.recurringExpensesMonthly,
            safeWithdrawalRatePct: _swr,
            corpusBufferPct: _buffer,
          )
        : _parseTarget();
    final next = g.copyWith(
      name: _nameCtrl.text.trim().isEmpty ? (widget.isNew ? 'New goal' : g.name) : _nameCtrl.text.trim(),
      targetAmount: target,
      targetDate: _targetDate,
      clearTargetDate: _targetDate == null,
      savingsWeight: _savingsWeight.clamp(0, 1e6),
      safeWithdrawalRatePct: clampWithdrawalRatePct(_swr),
      corpusBufferPct: clampCorpusBufferPct(_buffer),
      corpusAutoFromExpenses: true,
    );
    if (g.isRetirement) {
      m.setRetirementExtraAssetIds(_retirementExtras);
    }
    m.upsertFinancialGoal(next);
    if (mounted) Navigator.of(context).pop();
  }

  void _delete() {
    if (widget.isNew) {
      Navigator.of(context).pop();
      return;
    }
    final id = widget.goalId;
    if (id != null) widget.model.removeFinancialGoal(id);
    if (mounted) Navigator.of(context).pop();
  }

  Widget _retirementAssetSection({
    required String title,
    required List<LedgerAssetRow> assets,
    required bool expanded,
    required ValueChanged<bool> onToggleSection,
  }) {
    if (assets.isEmpty) return const SizedBox.shrink();
    final m = widget.model;
    final hide = m.privacyHideAmounts;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          value: expanded,
          onChanged: onToggleSection,
        ),
        if (expanded)
          for (final a in assets)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              secondary: Icon(a.type.icon, color: m.accent, size: 22),
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      a.name.trim().isEmpty ? a.type.label : a.name.trim(),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Text(
                    goalMoney(m, m.assetDisplayValue(a), hide: hide),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ],
              ),
              value: _retirementExtras.contains(a.id),
              onChanged: (on) {
                setState(() {
                  if (on == true) {
                    _retirementExtras.add(a.id);
                  } else {
                    _retirementExtras.remove(a.id);
                  }
                });
              },
            ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        final m = widget.model;
        final g = _goal;
        if (g == null) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Goal not found'),
          );
        }
        final cs = Theme.of(context).colorScheme;
        final hide = m.privacyHideAmounts;
        final isRetirement = g.isRetirement;

        final previewCorpus = isRetirement
            ? computeRetirementCorpus(
                recurringExpensesMonthly: m.recurringExpensesMonthly,
                safeWithdrawalRatePct: _swr,
                corpusBufferPct: _buffer,
              )
            : _parseTarget();

        final draft = g.copyWith(
          targetAmount: isRetirement ? previewCorpus : _parseTarget(),
          targetDate: _targetDate,
          safeWithdrawalRatePct: _swr,
          corpusBufferPct: _buffer,
          corpusAutoFromExpenses: true,
          savingsWeight: _savingsWeight,
        );
        final feas = m.goalFeasibility(draft);
        final pool = m.savingsMonthlyForTargetsPool;
        final share = m.normalizedTargetSavingsShares()[g.id] ?? 0;
        final monthlyFromWeight = isRetirement ? 0.0 : pool * share;

        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        isRetirement ? 'Retirement' : (widget.isNew ? 'New target' : 'Target'),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Close',
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                if (!feas.isOk) ...[
                  const SizedBox(height: 6),
                  ZoroStatusBanner.fromGoalFeasibility(feas, compact: true),
                ],
                const SizedBox(height: 12),
                if (!isRetirement)
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                if (!isRetirement) const SizedBox(height: 12),
                if (isRetirement) ...[
                  Text(
                    'Corpus from expenses',
                    style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    goalMoney(m, previewCorpus, hide: hide),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
                  ),
                  const SizedBox(height: 12),
                  Text('SWR ${_swr.round()}%', style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 13)),
                  Slider(
                    value: _swr.clamp(1, 10),
                    min: 1,
                    max: 10,
                    divisions: 9,
                    label: '${_swr.round()}%',
                    onChanged: (v) => setState(() => _swr = v),
                  ),
                  Text('Buffer ${_buffer.round()}%', style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 13)),
                  Slider(
                    value: _buffer.clamp(0, 100),
                    min: 0,
                    max: 100,
                    divisions: 20,
                    label: '${_buffer.round()}%',
                    onChanged: (v) => setState(() => _buffer = v),
                  ),
                  const SizedBox(height: 8),
                  _retirementAssetSection(
                    title: 'Property',
                    assets: _propertyAssets,
                    expanded: _propertyExpanded,
                    onToggleSection: _togglePropertySection,
                  ),
                  _retirementAssetSection(
                    title: 'Other assets',
                    assets: _otherAssets,
                    expanded: _otherExpanded,
                    onToggleSection: _toggleOtherSection,
                  ),
                ] else
                  TextField(
                    controller: _targetCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Target amount',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.event_outlined, size: 18),
                  label: Text(goalDateLabel(_targetDate), style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
                if (!isRetirement) ...[
                  const SizedBox(height: 16),
                  Text('Monthly allocation', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                  const SizedBox(height: 8),
                  Text(
                    goalMoney(m, monthlyFromWeight, hide: hide),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
                  ),
                  Text(
                    '/mo · pool ${goalMoney(m, pool, hide: hide)}',
                    style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  Text('Priority', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: cs.onSurfaceVariant)),
                  Slider(
                    value: _savingsWeight.clamp(0, 10),
                    min: 0,
                    max: 10,
                    divisions: 20,
                    label: _savingsWeight.toStringAsFixed(1),
                    onChanged: (v) {
                      setState(() => _savingsWeight = v);
                      if (!widget.isNew) {
                        m.setTargetSavingsWeight(g.id, v);
                      }
                    },
                  ),
                ],
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  title: Text(
                    'Context notes',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                  trailing: Icon(Icons.chevron_right, size: 20, color: cs.onSurfaceVariant),
                  onTap: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (ctx) => GoalContextPage(model: m, goalId: g.id),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    if (!isRetirement)
                      TextButton(
                        onPressed: _delete,
                        child: Text(
                          widget.isNew ? 'Cancel' : 'Delete',
                          style: TextStyle(color: cs.error, fontWeight: FontWeight.w800),
                        ),
                      ),
                    const Spacer(),
                    FilledButton(
                      onPressed: _save,
                      child: const Text('Save'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
