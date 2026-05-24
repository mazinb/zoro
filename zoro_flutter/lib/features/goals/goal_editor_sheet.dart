import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';
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
    sizesToContent: true,
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

bool _setEquals(Set<String> a, Set<String> b) {
  if (a.length != b.length) return false;
  for (final id in a) {
    if (!b.contains(id)) return false;
  }
  return true;
}

class _GoalEditorSheetState extends State<_GoalEditorSheet> {
  late TextEditingController _nameCtrl;
  late TextEditingController _targetCtrl;
  late TextEditingController _surplusCtrl;
  DateTime? _targetDate;
  double _swr = 4;
  double _buffer = 0;
  double _surplus = 0;
  double _savingsWeight = 1;
  bool _corpusFromExpenses = true;
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
    _surplus = g?.corpusSurplus ?? 0;
    _surplusCtrl = TextEditingController(
      text: _surplus > 0
          ? formatGroupedInteger(_surplus.round(), currency: widget.model.displayCurrency)
          : '',
    );
    _targetDate = g?.targetDate;
    _corpusFromExpenses = g?.corpusAutoFromExpenses ?? true;
    _swr = quantizeWithdrawalRatePct(g?.safeWithdrawalRatePct ?? 4);
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
    _surplusCtrl.dispose();
    super.dispose();
  }

  double _parseTarget() => goalParseGroupedAmount(_targetCtrl.text);

  double _parseSurplus() => goalParseGroupedAmount(_surplusCtrl.text);

  double _corpusBaseForDraft(AppModel m) {
    if (_corpusFromExpenses) {
      return computeRetirementCorpusBase(
        recurringExpensesMonthly: m.recurringExpensesMonthly,
        safeWithdrawalRatePct: _swr,
      );
    }
    return _parseTarget();
  }

  void _eatSurplusForCorpusChange(double oldBase, double newBase) {
    final next = surplusAfterCorpusIncrease(
      surplus: _surplus,
      oldBase: oldBase,
      newBase: newBase,
    );
    if ((next - _surplus).abs() < 0.5) return;
    _surplus = next;
    _surplusCtrl.text = _surplus > 0
        ? formatGroupedInteger(_surplus.round(), currency: widget.model.displayCurrency)
        : '';
  }

  double _draftCorpusTarget(AppModel m) {
    if (_corpusFromExpenses) {
      return computeRetirementCorpusBase(
        recurringExpensesMonthly: m.recurringExpensesMonthly,
        safeWithdrawalRatePct: _swr,
      );
    }
    return _parseTarget();
  }

  FinancialGoal _draftRetirement(AppModel m, FinancialGoal g) {
    return g.copyWith(
      targetAmount: _draftCorpusTarget(m),
      targetDate: _targetDate,
      safeWithdrawalRatePct: _swr,
      corpusBufferPct: _buffer,
      corpusAutoFromExpenses: _corpusFromExpenses,
      corpusSurplus: _surplus,
    );
  }

  void _applyRetireByFromInvestFlow(AppModel m, FinancialGoal g) {
    // Plan date = earliest reach of base corpus at invest /mo; surplus is not part of the target.
    final draft = _draftRetirement(m, g).copyWith(corpusSurplus: 0);
    final computed = m.retirementTargetDateFromPlan(draft);
    if (computed == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Raise invest /mo in the split above first.')),
      );
      return;
    }
    setState(() {
      _targetDate = computed;
      _surplus = 0;
      _surplusCtrl.text = '';
    });
  }

  void _shiftRetirementYears(AppModel m, FinancialGoal g, int yearsDelta) {
    final base = _targetDate ??
        m.retirementTargetDateFromPlan(_draftRetirement(m, g)) ??
        DateTime.now();
    final annualReturn = m.projectionInvestReturnPctAnnual[m.displayCurrency] ?? 0;
    final delta = retirementSurplusDeltaForYears(
      yearsDelta: yearsDelta,
      monthlyInvest: m.allocInvestmentsMonthly,
      annualReturnPct: annualReturn,
    );
    setState(() {
      _targetDate = shiftRetirementTargetDate(baseDate: base, yearsDelta: yearsDelta);
      if (delta.abs() > 0.5) {
        _surplus = (_surplus + delta).clamp(0, double.infinity);
        _surplusCtrl.text = _surplus > 0
            ? formatGroupedInteger(_surplus.round(), currency: m.displayCurrency)
            : '';
      }
    });
  }

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
    final isRetirement = g.isRetirement;
    final target = isRetirement
        ? (_corpusFromExpenses
            ? computeRetirementCorpusBase(
                recurringExpensesMonthly: m.recurringExpensesMonthly,
                safeWithdrawalRatePct: _swr,
              )
            : _parseTarget())
        : _parseTarget();
    final next = g.copyWith(
      name: _nameCtrl.text.trim().isEmpty ? (widget.isNew ? 'New goal' : g.name) : _nameCtrl.text.trim(),
      targetAmount: target,
      targetDate: _targetDate,
      clearTargetDate: _targetDate == null,
      savingsWeight: _savingsWeight.clamp(0, 1e6),
      safeWithdrawalRatePct: quantizeWithdrawalRatePct(_swr),
      corpusBufferPct: clampCorpusBufferPct(_buffer),
      corpusAutoFromExpenses: isRetirement ? _corpusFromExpenses : g.corpusAutoFromExpenses,
      corpusSurplus: isRetirement ? _parseSurplus() : g.corpusSurplus,
    );
    m.upsertFinancialGoal(next);
    if (g.isRetirement && !_setEquals(_retirementExtras, m.retirementExtraAssetIds)) {
      m.setRetirementExtraAssetIds(_retirementExtras);
    }
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
            ? computeRetirementCorpusBase(
                recurringExpensesMonthly: m.recurringExpensesMonthly,
                safeWithdrawalRatePct: _swr,
              )
            : _parseTarget();
        final corpusTarget = isRetirement
            ? (_corpusFromExpenses ? previewCorpus : _parseTarget())
            : _parseTarget();

        final draft = g.copyWith(
          targetAmount: corpusTarget,
          targetDate: _targetDate,
          safeWithdrawalRatePct: _swr,
          corpusBufferPct: _buffer,
          corpusAutoFromExpenses: isRetirement ? _corpusFromExpenses : g.corpusAutoFromExpenses,
          corpusSurplus: isRetirement ? _surplus : g.corpusSurplus,
          savingsWeight: _savingsWeight,
        );
        final displayCorpus = isRetirement
            ? (_corpusFromExpenses ? previewCorpus : _parseTarget())
            : corpusTarget;
        final displaySurplus = isRetirement ? _surplus : 0.0;
        final pool = m.savingsMonthlyForTargetsPool;
        final share = m.normalizedTargetSavingsShares()[g.id] ?? 0;
        final monthlyFromWeight = isRetirement ? 0.0 : pool * share;

        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        isRetirement ? 'Retirement' : (widget.isNew ? 'New target' : 'Target'),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      tooltip: 'Close',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                if (!isRetirement) ...[
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
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
                  const SizedBox(height: 12),
                  Text('Monthly allocation', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                  const SizedBox(height: 6),
                  Text(
                    goalMoney(m, monthlyFromWeight, hide: hide),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
                  ),
                  Text(
                    '/mo · pool ${goalMoney(m, pool, hide: hide)}',
                    style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
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
                ] else ...[
                  _RetirementPlanPanel(
                    model: m,
                    draft: draft,
                    hide: hide,
                    investMonthly: m.allocInvestmentsMonthly,
                    requiredMonthly: m.retirementRequiredInvestMonthly(draft),
                    onUpdateFromFlow: () => _applyRetireByFromInvestFlow(m, g),
                    onShiftYears: (y) => _shiftRetirementYears(m, g, y),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text('Corpus from expenses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    value: _corpusFromExpenses,
                    onChanged: (on) {
                      final oldBase = _corpusBaseForDraft(m);
                      setState(() {
                        _corpusFromExpenses = on;
                        if (!on && _targetCtrl.text.trim().isEmpty) {
                          _targetCtrl.text = formatGroupedInteger(
                            previewCorpus.round(),
                            currency: m.displayCurrency,
                          );
                        }
                        _eatSurplusForCorpusChange(oldBase, _corpusBaseForDraft(m));
                      });
                    },
                  ),
                  if (_corpusFromExpenses)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            goalMoney(m, displayCorpus, hide: hide),
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
                          ),
                          if (displaySurplus > 0.5)
                            Text(
                              '+ ${goalMoney(m, displaySurplus, hide: hide)} surplus',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    )
                  else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _targetCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
                            ],
                            decoration: InputDecoration(
                              labelText: 'Corpus target',
                              isDense: true,
                              border: const OutlineInputBorder(),
                              prefixText:
                                  m.displayCurrency == CurrencyCode.aed ? null : m.displayCurrency.symbol,
                            ),
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _surplusCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
                            ],
                            decoration: InputDecoration(
                              labelText: 'Surplus',
                              isDense: true,
                              border: const OutlineInputBorder(),
                              prefixText:
                                  m.displayCurrency == CurrencyCode.aed ? null : m.displayCurrency.symbol,
                            ),
                            onChanged: (_) {
                              _surplus = _parseSurplus();
                              setState(() {});
                            },
                          ),
                        ),
                      ],
                    ),
                  if (_corpusFromExpenses) ...[
                    Text(
                      'Withdrawal ${_swr.toStringAsFixed(1)}%',
                      style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 12),
                    ),
                    Slider(
                      value: _swr.clamp(1, 10),
                      min: 1,
                      max: 10,
                      divisions: 18,
                      label: '${_swr.toStringAsFixed(1)}%',
                      onChanged: (v) {
                        final oldBase = _corpusBaseForDraft(m);
                        setState(() {
                          _swr = quantizeWithdrawalRatePct(v);
                          _eatSurplusForCorpusChange(oldBase, _corpusBaseForDraft(m));
                        });
                      },
                    ),
                  ],
                  const SizedBox(height: 10),
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
                ],
                const SizedBox(height: 12),
                if (!isRetirement)
                  Row(
                    children: [
                      TextButton(
                        onPressed: _delete,
                        child: Text(
                          widget.isNew ? 'Cancel' : 'Delete',
                          style: TextStyle(color: cs.error, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const Spacer(),
                      FilledButton(onPressed: _save, child: const Text('Save')),
                    ],
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _save,
                      child: const Text('Save'),
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

class _RetirementPlanPanel extends StatelessWidget {
  const _RetirementPlanPanel({
    required this.model,
    required this.draft,
    required this.hide,
    required this.investMonthly,
    required this.requiredMonthly,
    required this.onUpdateFromFlow,
    required this.onShiftYears,
  });

  final AppModel model;
  final FinancialGoal draft;
  final bool hide;
  final double investMonthly;
  final double requiredMonthly;
  final VoidCallback onUpdateFromFlow;
  final ValueChanged<int> onShiftYears;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final timeLabel = retirementTimeToTargetLabel(model, draft);
    final hasDate = draft.targetDate != null;
    final onTrack = hasDate && requiredMonthly <= 0.5 || (hasDate && investMonthly >= requiredMonthly * 0.95);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text('Retire', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: cs.onSurfaceVariant)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                timeLabel.isEmpty ? '—' : timeLabel,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
              ),
            ),
            TextButton(
              onPressed: onUpdateFromFlow,
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                minimumSize: const Size(0, 32),
              ),
              child: Text('Update', style: TextStyle(fontWeight: FontWeight.w800, color: model.accent)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Invest', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: cs.onSurfaceVariant)),
                  Text(
                    '${goalMoney(model, investMonthly, hide: hide)}/mo',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: model.accent),
                  ),
                ],
              ),
            ),
            if (hasDate)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('Need', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: cs.onSurfaceVariant)),
                    Text(
                      onTrack ? 'On track' : '${goalMoney(model, requiredMonthly, hide: hide)}/mo',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: onTrack ? cs.primary : cs.onSurface,
                      ),
                      textAlign: TextAlign.end,
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _HorizonChip(label: '−2 yr', onTap: () => onShiftYears(-2))),
            const SizedBox(width: 6),
            Expanded(child: _HorizonChip(label: '−1 yr', onTap: () => onShiftYears(-1))),
            const SizedBox(width: 6),
            Expanded(child: _HorizonChip(label: '+1 yr', onTap: () => onShiftYears(1))),
            const SizedBox(width: 6),
            Expanded(child: _HorizonChip(label: '+2 yr', onTap: () => onShiftYears(2))),
          ],
        ),
      ],
    );
  }
}

class _HorizonChip extends StatelessWidget {
  const _HorizonChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsets.symmetric(vertical: 10),
      ),
      child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: cs.onSurface)),
    );
  }
}
