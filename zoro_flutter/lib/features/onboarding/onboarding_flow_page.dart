import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/state/app_model.dart';
import '../../shared/guided_mcq/structured_guide_page.dart';
import '../../shared/help/how_it_works_page.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'onboarding_expense_buckets.dart';

const _kOnboardingFxPickerOptions = <CurrencyCode>[
  CurrencyCode.thb,
  CurrencyCode.inr,
  CurrencyCode.aed,
  CurrencyCode.sgd,
  CurrencyCode.aud,
  CurrencyCode.eur,
  CurrencyCode.jpy,
];

/// First-run setup: currencies → income → expense estimates.
class OnboardingFlowPage extends StatefulWidget {
  const OnboardingFlowPage({super.key, required this.model, required this.onComplete});

  final AppModel model;
  final VoidCallback onComplete;

  @override
  State<OnboardingFlowPage> createState() => _OnboardingFlowPageState();
}

class _OnboardingFlowPageState extends State<OnboardingFlowPage> {
  int _mainStep = 0;
  int _expenseSubStep = 0;
  final List<StructuredGuideAnswer> _expenseAnswers = [];
  final Set<String> _expenseSelected = {};
  final _expenseNoteCtrl = TextEditingController();
  final Map<String, TextEditingController> _manualBucketCtrls = {};
  bool _expenseManual = false;
  bool? _addDummyData;

  CurrencyCode? _pick1;
  CurrencyCode? _pick2;
  final Map<CurrencyCode, TextEditingController> _fxCtrls = {};

  bool _incomeMonthly = true;
  final _salaryCtrl = TextEditingController();
  final _bonusCtrl = TextEditingController();
  final _rsuCtrl = TextEditingController();
  final _taxCtrl = TextEditingController();

  bool _finishing = false;

  @override
  void dispose() {
    _expenseNoteCtrl.dispose();
    for (final c in _manualBucketCtrls.values) {
      c.dispose();
    }
    for (final c in _fxCtrls.values) {
      c.dispose();
    }
    _salaryCtrl.dispose();
    _bonusCtrl.dispose();
    _rsuCtrl.dispose();
    _taxCtrl.dispose();
    super.dispose();
  }

  TextEditingController _fxController(CurrencyCode c) {
    return _fxCtrls.putIfAbsent(c, () {
      final unitsPerUsd = 1 / c.usdPerUnit;
      return TextEditingController(text: unitsPerUsd.toStringAsFixed(2));
    });
  }

  double? _parseIncomeField(TextEditingController ctrl) {
    final digits = ctrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    return double.tryParse(digits);
  }

  double _annualFromSalaryField() {
    final v = _parseIncomeField(_salaryCtrl) ?? 0;
    return _incomeMonthly ? v * 12 : v;
  }

  double get _netMonthlyIncomeUsd {
    final grossAnnual = _annualFromSalaryField() + (_parseIncomeField(_bonusCtrl) ?? 0) + (_parseIncomeField(_rsuCtrl) ?? 0);
    final tax = double.tryParse(_taxCtrl.text.trim()) ?? 0;
    final netAnnual = grossAnnual * (1 - tax.clamp(0, 90) / 100);
    return netAnnual / 12;
  }

  bool get _canNextCurrency =>
      _pick1 != null && _pick2 != null && _pick1 != _pick2;

  bool get _canNextIncome => (_parseIncomeField(_salaryCtrl) ?? 0) > 0;

  List<StructuredGuideStep> get _expenseSteps =>
      onboardingExpenseMcqSteps(netMonthlyIncomeDisplay: _netMonthlyIncomeUsd);

  StructuredGuideStep? get _currentExpenseStep =>
      _expenseSubStep < _expenseSteps.length ? _expenseSteps[_expenseSubStep] : null;

  bool get _onExpenseManualStep => _mainStep == 2 && _expenseManual && _expenseSubStep == -1;
  bool get _onExpenseNoteStep => _mainStep == 2 && _expenseSubStep == _expenseSteps.length;
  bool get _onExpenseDummyStep => _mainStep == 2 && _expenseSubStep == _expenseSteps.length + 1;

  bool get _canContinueExpense {
    if (_onExpenseManualStep) return true;
    if (_onExpenseNoteStep) return true;
    if (_onExpenseDummyStep) return _addDummyData != null;
    final q = _currentExpenseStep;
    if (q == null) return false;
    return _expenseSelected.isNotEmpty;
  }

  void _openHelp() => openHowItWorksPage(context, TabHelpContent.onboarding);

  void _back() {
    if (_mainStep == 2) {
      if (_onExpenseDummyStep) {
        setState(() {
          _expenseSubStep = _expenseSteps.length;
          _addDummyData = null;
        });
        return;
      }
      if (_onExpenseNoteStep) {
        setState(() {
          if (_expenseManual) {
            _expenseSubStep = -1;
          } else {
            _expenseSubStep = _expenseSteps.length - 1;
            _expenseSelected
              ..clear()
              ..addAll(_expenseAnswers.last.selectedIds);
            _expenseAnswers.removeLast();
          }
        });
        return;
      }
      if (_expenseSubStep > 0) {
        setState(() {
          _expenseSubStep--;
          _expenseAnswers.removeLast();
          _expenseSelected
            ..clear()
            ..addAll(_expenseAnswers[_expenseSubStep].selectedIds);
        });
        return;
      }
      setState(() => _mainStep = 1);
      return;
    }
    if (_mainStep > 0) {
      setState(() => _mainStep--);
    }
  }

  TextEditingController _bucketCtrl(String key, double initial) {
    return _manualBucketCtrls.putIfAbsent(
      key,
      () => TextEditingController(text: formatGroupedInteger(initial.round(), currency: CurrencyCode.usd)),
    );
  }

  double _parseBucketCtrl(String key) {
    final raw = _manualBucketCtrls[key]?.text ?? '';
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return 0;
    return (double.tryParse(digits) ?? 0).toDouble();
  }

  void _next() {
    if (_mainStep == 0) {
      if (!_canNextCurrency) return;
      setState(() => _mainStep = 1);
      return;
    }
    if (_mainStep == 1) {
      if (!_canNextIncome) return;
      setState(() {
        _mainStep = 2;
        _expenseSubStep = _expenseManual ? -1 : 0;
        _expenseSelected.clear();
        _addDummyData = null;
      });
      return;
    }
    if (_onExpenseDummyStep) {
      unawaited(_finish(addDummyData: _addDummyData == true));
      return;
    }
    if (_onExpenseNoteStep) {
      setState(() => _expenseSubStep = _expenseSteps.length + 1);
      return;
    }
    if (_onExpenseManualStep) {
      setState(() => _expenseSubStep = _expenseSteps.length);
      return;
    }
    final q = _currentExpenseStep;
    if (q == null || !_canContinueExpense) return;
    setState(() {
      _expenseAnswers.add(StructuredGuideAnswer(
        questionId: q.id,
        selectedIds: Set<String>.from(_expenseSelected),
      ));
      _expenseSelected.clear();
      _expenseSubStep++;
    });
  }

  Future<void> _finish({required bool addDummyData}) async {
    if (_finishing || _pick1 == null || _pick2 == null) return;
    setState(() => _finishing = true);

    final mcq = StructuredGuideResult(
      answers: List<StructuredGuideAnswer>.from(_expenseAnswers),
      optionalNote: _expenseNoteCtrl.text.trim(),
    );
    final fx = <CurrencyCode, double>{};
    for (final c in [_pick1!, _pick2!]) {
      final perUsd = double.tryParse(_fxController(c).text.trim().replaceAll(',', ''));
      if (perUsd != null && perUsd > 0) fx[c] = perUsd;
    }

    Map<String, double> buckets;
    if (_expenseManual) {
      buckets = {for (final k in recurringExpenseBucketKeys) k: _parseBucketCtrl(k)};
    } else {
      buckets = deterministicOnboardingExpenseBuckets(
        displayCurrency: CurrencyCode.usd,
        mcq: mcq,
        netMonthlyIncomeDisplay: _netMonthlyIncomeUsd,
        usdPerUnitOverrides: {
          for (final e in fx.entries) e.key: 1 / e.value,
        },
      );
    }

    final note = _expenseNoteCtrl.text.trim();
    if (note.isNotEmpty && !_expenseManual) {
      final ai = await appleOnboardingExpenseBuckets(
        model: widget.model,
        note: note,
        mcq: mcq,
        netMonthlyIncomeDisplay: _netMonthlyIncomeUsd,
        baselineBuckets: buckets,
      );
      if (ai != null && ai.isNotEmpty) buckets = ai;
    }

    widget.model.applyOnboardingSetup(
      homeQuickPick1: _pick1!,
      homeQuickPick2: _pick2!,
      unitsPerUsdByCurrency: fx,
      salaryAnnualUsd: _annualFromSalaryField(),
      bonusAnnualUsd: (_parseIncomeField(_bonusCtrl) ?? 0) > 0 ? (_parseIncomeField(_bonusCtrl) ?? 0) : null,
      rsuAnnualUsd: (_parseIncomeField(_rsuCtrl) ?? 0) > 0 ? (_parseIncomeField(_rsuCtrl) ?? 0) : null,
      effectiveTaxRatePct: double.tryParse(_taxCtrl.text.trim()),
      expenseBucketsMonthlyUsd: buckets,
      expenseContextNote: note.isEmpty ? null : note,
    );
    if (addDummyData) {
      widget.model.seedDummyData();
    }

    if (!mounted) return;
    setState(() => _finishing = false);
    widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = widget.model.accent;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        leading: _mainStep > 0
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: _back)
            : null,
        title: const Text('Welcome to Zoro', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline),
            tooltip: 'How it works',
            onPressed: _openHelp,
          ),
        ],
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [cs.surface, accent.withValues(alpha: 0.08)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _StepBar(mainStep: _mainStep, accent: accent, cs: cs),
                const SizedBox(height: 16),
                Expanded(
                  child: switch (_mainStep) {
                    0 => _CurrencyStep(
                        pick1: _pick1,
                        pick2: _pick2,
                        fxController: _fxController,
                        onPick1: (c) => setState(() => _pick1 = c),
                        onPick2: (c) => setState(() => _pick2 = c),
                      ),
                    1 => _IncomeStep(
                        monthly: _incomeMonthly,
                        onMonthlyChanged: (v) => setState(() => _incomeMonthly = v),
                        salaryCtrl: _salaryCtrl,
                        bonusCtrl: _bonusCtrl,
                        rsuCtrl: _rsuCtrl,
                        taxCtrl: _taxCtrl,
                        onFieldChanged: () => setState(() {}),
                      ),
                    _ => _onExpenseDummyStep
                        ? _DummyDataStep(
                            value: _addDummyData,
                            onChanged: (v) => setState(() => _addDummyData = v),
                          )
                        : _onExpenseNoteStep
                            ? _ExpenseNoteStep(controller: _expenseNoteCtrl, finishing: _finishing)
                            : _onExpenseManualStep
                                ? _ExpenseManualStep(
                                    bucketCtrl: _bucketCtrl,
                                    onSwitchToMcq: () => setState(() {
                                      _expenseManual = false;
                                      _expenseSubStep = 0;
                                    }),
                                  )
                                : _ExpenseMcqStep(
                                    step: _currentExpenseStep!,
                                    subIndex: _expenseSubStep,
                                    subTotal: _expenseSteps.length,
                                    selected: _expenseSelected,
                                    onSelect: (id, multi) {
                                      setState(() {
                                        if (multi) {
                                          if (_expenseSelected.contains(id)) {
                                            _expenseSelected.remove(id);
                                          } else {
                                            _expenseSelected.add(id);
                                          }
                                        } else {
                                          _expenseSelected
                                            ..clear()
                                            ..add(id);
                                        }
                                      });
                                    },
                                    onSkipToManual: () => setState(() {
                                      _expenseManual = true;
                                      _expenseSubStep = -1;
                                    }),
                                  ),
                  },
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _finishing
                      ? null
                      : switch (_mainStep) {
                          0 => _canNextCurrency ? _next : null,
                          1 => _canNextIncome ? _next : null,
                          _ => _canContinueExpense ? _next : null,
                        },
                  child: Text(_mainStep == 2 && _onExpenseDummyStep
                      ? (_finishing ? 'Setting up…' : 'Get started')
                      : 'Next'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StepBar extends StatelessWidget {
  const _StepBar({required this.mainStep, required this.accent, required this.cs});

  final int mainStep;
  final Color accent;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return LiquidGlassPanel(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Text(
            'Step ${mainStep + 1} of 3',
            style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurfaceVariant),
          ),
          const Spacer(),
          for (var i = 0; i < 3; i++)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: CircleAvatar(
                radius: 14,
                backgroundColor: i <= mainStep ? accent : accent.withValues(alpha: 0.15),
                child: Text(
                  '${i + 1}',
                  style: TextStyle(
                    color: i <= mainStep ? cs.onPrimary : accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CurrencyStep extends StatelessWidget {
  const _CurrencyStep({
    required this.pick1,
    required this.pick2,
    required this.fxController,
    required this.onPick1,
    required this.onPick2,
  });

  final CurrencyCode? pick1;
  final CurrencyCode? pick2;
  final TextEditingController Function(CurrencyCode) fxController;
  final ValueChanged<CurrencyCode?> onPick1;
  final ValueChanged<CurrencyCode?> onPick2;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      children: [
        Text(
          'Home currency',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface),
        ),
        const SizedBox(height: 6),
        Text(
          'USD is your default. Pick two more currencies for quick switching on Home.',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
        ),
        const SizedBox(height: 16),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Text('🇺🇸', style: TextStyle(fontSize: 28)),
              const SizedBox(width: 12),
              Text('USD', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface)),
              const Spacer(),
              Text('Default', style: TextStyle(fontWeight: FontWeight.w700, color: cs.onSurfaceVariant)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _CurrencyPickCard(
          label: 'Second currency',
          value: pick1,
          exclude: pick2,
          onChanged: onPick1,
        ),
        if (pick1 != null) ...[
          const SizedBox(height: 8),
          _FxRateRow(currency: pick1!, controller: fxController(pick1!)),
        ],
        const SizedBox(height: 12),
        _CurrencyPickCard(
          label: 'Third currency',
          value: pick2,
          exclude: pick1,
          onChanged: onPick2,
        ),
        if (pick2 != null) ...[
          const SizedBox(height: 8),
          _FxRateRow(currency: pick2!, controller: fxController(pick2!)),
        ],
      ],
    );
  }
}

class _CurrencyPickCard extends StatelessWidget {
  const _CurrencyPickCard({
    required this.label,
    required this.value,
    required this.exclude,
    required this.onChanged,
  });

  final String label;
  final CurrencyCode? value;
  final CurrencyCode? exclude;
  final ValueChanged<CurrencyCode?> onChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final options = _kOnboardingFxPickerOptions.where((c) => c != exclude).toList();

    return LiquidGlassPanel(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
      child: DropdownButtonFormField<CurrencyCode>(
        key: ValueKey('$label-$value'),
        initialValue: value,
        decoration: InputDecoration(
          labelText: label,
          border: InputBorder.none,
          isDense: true,
        ),
        hint: Text('Select currency', style: TextStyle(color: cs.onSurfaceVariant)),
        items: [
          for (final c in options)
            DropdownMenuItem(
              value: c,
              child: Text('${c.flag} ${c.code} · ${c.symbol}', style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
        ],
        onChanged: onChanged,
      ),
    );
  }
}

class _FxRateRow extends StatelessWidget {
  const _FxRateRow({required this.currency, required this.controller});

  final CurrencyCode currency;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return LiquidGlassPanel(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          const Text('🇺🇸', style: TextStyle(fontSize: 22)),
          const SizedBox(width: 8),
          const Text('1 USD =', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(width: 8),
          SizedBox(
            width: 88,
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w900),
              decoration: InputDecoration(
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${currency.flag} ${currency.code}',
            style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _IncomeStep extends StatelessWidget {
  const _IncomeStep({
    required this.monthly,
    required this.onMonthlyChanged,
    required this.salaryCtrl,
    required this.bonusCtrl,
    required this.rsuCtrl,
    required this.taxCtrl,
    required this.onFieldChanged,
  });

  final bool monthly;
  final ValueChanged<bool> onMonthlyChanged;
  final TextEditingController salaryCtrl;
  final TextEditingController bonusCtrl;
  final TextEditingController rsuCtrl;
  final TextEditingController taxCtrl;
  final VoidCallback onFieldChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final salaryPeriod = monthly ? 'Monthly' : 'Annual';

    return ListView(
      children: [
        Text('Income', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface)),
        const SizedBox(height: 6),
        Text(
          'All amounts in USD. Bonus and RSUs are annual (optional).',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
        ),
        const SizedBox(height: 14),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(4),
          child: SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: true, label: Text('Monthly')),
              ButtonSegment(value: false, label: Text('Annual')),
            ],
            selected: {monthly},
            onSelectionChanged: (s) => onMonthlyChanged(s.first),
          ),
        ),
        const SizedBox(height: 14),
        _IncomeField(ctrl: salaryCtrl, label: 'Salary ($salaryPeriod)', required: true, onChanged: onFieldChanged),
        const SizedBox(height: 10),
        _IncomeField(ctrl: bonusCtrl, label: 'Bonus (Annual)', onChanged: onFieldChanged),
        const SizedBox(height: 10),
        _IncomeField(ctrl: rsuCtrl, label: 'RSUs (Annual)', onChanged: onFieldChanged),
        const SizedBox(height: 14),
        TextField(
          controller: taxCtrl,
          keyboardType: TextInputType.number,
          onChanged: (_) => onFieldChanged(),
          decoration: const InputDecoration(
            labelText: 'Effective tax rate %',
            suffixText: '%',
            border: OutlineInputBorder(),
            isDense: true,
          ),
        ),
      ],
    );
  }
}

class _IncomeField extends StatelessWidget {
  const _IncomeField({
    required this.ctrl,
    required this.label,
    this.required = false,
    required this.onChanged,
  });

  final TextEditingController ctrl;
  final String label;
  final bool required;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: ctrl,
      keyboardType: TextInputType.number,
      onChanged: (_) => onChanged(),
      inputFormatters: [
        GroupedIntegerTextInputFormatter(currency: CurrencyCode.usd),
      ],
      decoration: InputDecoration(
        labelText: label,
        prefixText: r'$',
        border: const OutlineInputBorder(),
        isDense: true,
      ),
    );
  }
}

class _ExpenseMcqStep extends StatelessWidget {
  const _ExpenseMcqStep({
    required this.step,
    required this.subIndex,
    required this.subTotal,
    required this.selected,
    required this.onSelect,
    required this.onSkipToManual,
  });

  final StructuredGuideStep step;
  final int subIndex;
  final int subTotal;
  final Set<String> selected;
  final void Function(String id, bool multi) onSelect;
  final VoidCallback onSkipToManual;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = Theme.of(context).colorScheme.primary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Monthly expenses',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface),
        ),
        Text(
          'Question ${subIndex + 1} of $subTotal',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w700),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: onSkipToManual,
            child: const Text('Type estimates instead'),
          ),
        ),
        const SizedBox(height: 12),
        Text(step.prompt, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        if (step.hint != null) ...[
          const SizedBox(height: 6),
          Text(step.hint!, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
        ],
        const SizedBox(height: 12),
        Expanded(
          child: ListView(
            children: [
              for (final c in step.choices)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _GlassChoiceTile(
                    label: c.label,
                    selected: selected.contains(c.id),
                    accent: accent,
                    onTap: () => onSelect(c.id, step.allowMultiple),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ExpenseManualStep extends StatelessWidget {
  const _ExpenseManualStep({required this.bucketCtrl, required this.onSwitchToMcq});

  final TextEditingController Function(String key, double initial) bucketCtrl;
  final VoidCallback onSwitchToMcq;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final preset = presetForCountry('US');
    return ListView(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Monthly expenses',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface),
              ),
            ),
            TextButton(onPressed: onSwitchToMcq, child: const Text('Quick questions')),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          'Type your monthly estimates in USD. You can refine later in Ledger.',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
        ),
        const SizedBox(height: 14),
        for (final k in recurringExpenseBucketKeys) ...[
          TextField(
            controller: bucketCtrl(k, preset.buckets[k]!.value),
            keyboardType: TextInputType.number,
            inputFormatters: [GroupedIntegerTextInputFormatter(currency: CurrencyCode.usd)],
            decoration: InputDecoration(
              labelText: preset.buckets[k]!.label,
              prefixText: r'$',
              border: const OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _DummyDataStep extends StatelessWidget {
  const _DummyDataStep({required this.value, required this.onChanged});

  final bool? value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = Theme.of(context).colorScheme.primary;
    Widget option({required bool v, required String title, required String subtitle}) {
      final selected = value == v;
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => onChanged(v),
          borderRadius: BorderRadius.circular(12),
          child: LiquidGlassPanel(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.check_circle : Icons.circle_outlined,
                  color: selected ? accent : cs.onSurfaceVariant,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 4),
                      Text(subtitle, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, height: 1.35)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ListView(
      children: [
        Text('Demo data', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface)),
        const SizedBox(height: 6),
        Text(
          'Add example cash-flow months so the charts look alive while you explore.',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
        ),
        const SizedBox(height: 14),
        option(
          v: true,
          title: 'Add demo months',
          subtitle: 'You can remove them later (until edited).',
        ),
        const SizedBox(height: 10),
        option(
          v: false,
          title: 'No thanks',
          subtitle: 'Start clean.',
        ),
      ],
    );
  }
}

class _ExpenseNoteStep extends StatelessWidget {
  const _ExpenseNoteStep({required this.controller, required this.finishing});

  final TextEditingController controller;
  final bool finishing;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      children: [
        Text(
          'Anything else about your spending?',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: cs.onSurface),
        ),
        const SizedBox(height: 6),
        Text(
          'Optional. On supported iPhones, Apple Intelligence adjusts your budget buckets from this note. Otherwise we use your answers above.',
          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
        ),
        const SizedBox(height: 14),
        LiquidGlassPanel(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: TextField(
            controller: controller,
            enabled: !finishing,
            minLines: 4,
            maxLines: 6,
            decoration: const InputDecoration(
              hintText: 'e.g. high rent in NYC, eat out often, two kids in school…',
              border: InputBorder.none,
            ),
          ),
        ),
        if (finishing) ...[
          const SizedBox(height: 24),
          const Center(child: CircularProgressIndicator()),
        ],
      ],
    );
  }
}

class _GlassChoiceTile extends StatelessWidget {
  const _GlassChoiceTile({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: LiquidGlassPanel(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle : Icons.circle_outlined,
                color: selected ? accent : cs.onSurfaceVariant,
                size: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurface)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
