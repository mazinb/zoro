import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/finance/corpus_backtest.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/finance/historical_returns.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_widgets.dart';

Future<void> openCorpusBacktestPage({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  model.ensureDefaultHistoricalReturns();
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => CorpusBacktestPage(model: model),
    ),
  );
}

class CorpusBacktestPage extends StatefulWidget {
  const CorpusBacktestPage({super.key, required this.model});

  final AppModel model;

  @override
  State<CorpusBacktestPage> createState() => _CorpusBacktestPageState();
}

class _CorpusBacktestPageState extends State<CorpusBacktestPage> {
  late double _swr;
  late bool _corpusFromExpenses;
  int? _startYear;

  AppModel get m => widget.model;

  @override
  void initState() {
    super.initState();
    final r = m.retirementGoal;
    _swr = quantizeWithdrawalRatePct(r?.safeWithdrawalRatePct ?? 4);
    _corpusFromExpenses = r?.corpusAutoFromExpenses ?? true;
    _startYear = m.corpusBacktestStartYear;
  }

  double get _corpusBase {
    if (_corpusFromExpenses) {
      return computeRetirementCorpusBase(
        recurringExpensesMonthly: m.recurringExpensesMonthly,
        safeWithdrawalRatePct: _swr,
      );
    }
    final r = m.retirementGoal;
    return r == null ? 0 : m.goalRetirementCorpusBaseAmount(r);
  }

  CorpusBacktestResult? get _result => m.corpusBacktestPreview(safeWithdrawalRatePct: _swr);

  void _applyAndPop() {
    m.setRetirementCorpusParams(
      safeWithdrawalRatePct: _swr,
      corpusAutoFromExpenses: _corpusFromExpenses,
    );
    m.markRetirementCorpusUpdated();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: m,
      builder: (context, _) {
        final cs = Theme.of(context).colorScheme;
        final accent = m.accent;
        final hide = m.privacyHideAmounts;
        final result = _result;
        final equityPct = m.corpusBacktestEquityPct.round();
        final debtPct = 100 - equityPct;
        final equityOptions = m.historicalSeriesForClass(HistoricalAssetClass.equity);
        final debtOptions = m.historicalSeriesForClass(HistoricalAssetClass.debt);
        final inflation = (m.projectionInflationPctAnnual[m.displayCurrency] ?? 0).toStringAsFixed(1);

        final eq = m.historicalSeriesById(m.corpusBacktestEquitySeriesId) ??
            m.historicalSeriesById(kDefaultUsSp500SeriesId);
        final de = m.historicalSeriesById(m.corpusBacktestDebtSeriesId) ??
            m.historicalSeriesById(kDefaultUsAggBondSeriesId);
        final overlapYears = (eq == null || de == null)
            ? const <int>[]
            : (eq.years.toSet().intersection(de.years.toSet()).toList()..sort());
        final minYear = overlapYears.isEmpty ? null : overlapYears.first;
        final maxYear = overlapYears.isEmpty ? null : overlapYears.last;

        return Scaffold(
          extendBodyBehindAppBar: true,
          appBar: AppBar(
            title: const Text('Corpus backtest', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
            backgroundColor: Colors.transparent,
            elevation: 0,
            actions: [
              TextButton(
                onPressed: _applyAndPop,
                child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w900)),
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
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  LiquidGlassPanel(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          goalMoney(m, _corpusBase, hide: hide),
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _corpusFromExpenses
                              ? 'From ${goalMoney(m, m.recurringExpensesMonthly, hide: hide)}/mo expenses'
                              : 'Custom corpus target',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: const Text(
                            'Corpus from expenses',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                          ),
                          value: _corpusFromExpenses,
                          onChanged: (on) => setState(() => _corpusFromExpenses = on),
                        ),
                        if (minYear != null && maxYear != null) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Text(
                                'Start year',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                  color: cs.onSurfaceVariant,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                (_startYear ?? minYear).toString(),
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  color: cs.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                          Slider(
                            value: ((_startYear ?? minYear) - minYear).toDouble(),
                            min: 0,
                            max: (maxYear - minYear).toDouble(),
                            divisions: (maxYear - minYear).clamp(1, 120),
                            label: (_startYear ?? minYear).toString(),
                            onChanged: (v) {
                              final year = (minYear + v.round()).clamp(minYear, maxYear);
                              setState(() => _startYear = year);
                              m.setCorpusBacktestStartYear(year);
                            },
                          ),
                          Text(
                            'Expenses grow with inflation ($inflation%/yr)',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: cs.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  LiquidGlassPanel(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                    child: GoalEditablePercentSlider(
                      label: 'Withdrawal rate',
                      value: _swr,
                      min: 1,
                      max: 10,
                      divisions: 18,
                      quantize: quantizeWithdrawalRatePct,
                      onChanged: (v) => setState(() => _swr = v),
                    ),
                  ),
                  const SizedBox(height: 12),
                  LiquidGlassPanel(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Text(
                            '$equityPct% equity · $debtPct% debt',
                            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface),
                          ),
                        ),
                        Slider(
                          value: m.corpusBacktestEquityPct.clamp(0, 100),
                          min: 0,
                          max: 100,
                          divisions: 20,
                          label: '$equityPct%',
                          onChanged: m.setCorpusBacktestEquityPct,
                        ),
                        const SizedBox(height: 8),
                        _SeriesDropdown(
                          label: 'Equity dataset',
                          valueId: m.corpusBacktestEquitySeriesId,
                          options: equityOptions,
                          onChanged: (id) => m.setCorpusBacktestSeriesIds(equityId: id),
                        ),
                        const SizedBox(height: 8),
                        _SeriesDropdown(
                          label: 'Debt dataset',
                          valueId: m.corpusBacktestDebtSeriesId,
                          options: debtOptions,
                          onChanged: (id) => m.setCorpusBacktestSeriesIds(debtId: id),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (result == null)
                    LiquidGlassPanel(
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        m.recurringExpensesMonthly <= 0 && _corpusFromExpenses
                            ? 'Add recurring expenses in Ledger to size the corpus.'
                            : 'Set a corpus target to run the backtest.',
                        style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
                      ),
                    )
                  else ...[
                    _OutcomeBanner(result: result),
                    const SizedBox(height: 12),
                    LiquidGlassPanel(
                      padding: const EdgeInsets.fromLTRB(8, 12, 8, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              '${result.years.length} years · ${result.equitySeriesName} + ${result.debtSeriesName}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: DataTable(
                              headingRowHeight: 36,
                              dataRowMinHeight: 32,
                              dataRowMaxHeight: 40,
                              columnSpacing: 16,
                              horizontalMargin: 8,
                              columns: const [
                                DataColumn(label: Text('Year', style: TextStyle(fontWeight: FontWeight.w800))),
                                DataColumn(label: Text('Expense/yr', style: TextStyle(fontWeight: FontWeight.w800))),
                                DataColumn(label: Text('Corpus start', style: TextStyle(fontWeight: FontWeight.w800))),
                                DataColumn(label: Text('Returns', style: TextStyle(fontWeight: FontWeight.w800))),
                                DataColumn(label: Text('Corpus end', style: TextStyle(fontWeight: FontWeight.w800))),
                                DataColumn(label: Text('Monthly', style: TextStyle(fontWeight: FontWeight.w800))),
                              ],
                              rows: [
                                for (final row in result.years)
                                  DataRow(
                                    color: row.depleted
                                        ? WidgetStatePropertyAll(cs.errorContainer.withValues(alpha: 0.35))
                                        : null,
                                    cells: [
                                      DataCell(Text('${row.year}')),
                                      DataCell(Text(goalMoney(m, row.expenseAnnual, hide: hide))),
                                      DataCell(Text(goalMoney(m, row.corpusStart, hide: hide))),
                                      DataCell(Text('${row.blendedReturnPct >= 0 ? "+" : ""}${row.blendedReturnPct.toStringAsFixed(1)}%')),
                                      DataCell(Text(goalMoney(m, row.corpusEnd, hide: hide))),
                                      DataCell(Text(goalMoney(m, row.monthlyExpense, hide: hide))),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    'Import or export return datasets in Settings → Data → Historical returns.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SeriesDropdown extends StatelessWidget {
  const _SeriesDropdown({
    required this.label,
    required this.valueId,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String valueId;
  final List<HistoricalReturnSeries> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final ids = options.map((s) => s.id).toSet();
    final value = ids.contains(valueId) ? valueId : (options.isNotEmpty ? options.first.id : null);
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        border: const OutlineInputBorder(),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          isDense: true,
          value: value,
          items: [
            for (final s in options)
              DropdownMenuItem(
                value: s.id,
                child: Text('${s.name} (${s.years.first}–${s.years.last})'),
              ),
          ],
          onChanged: value == null ? null : (id) {
            if (id != null) onChanged(id);
          },
        ),
      ),
    );
  }
}

class _OutcomeBanner extends StatelessWidget {
  const _OutcomeBanner({required this.result});

  final CorpusBacktestResult result;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final ok = result.survived;
    final bg = ok ? cs.primaryContainer : cs.errorContainer;
    final fg = ok ? cs.onPrimaryContainer : cs.onErrorContainer;
    final text = ok
        ? 'Corpus would have lasted all ${result.years.length} years at this draw.'
        : 'Corpus depleted in ${result.firstDepletionYear} — expenses exceeded balance that year.';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(ok ? Icons.check_circle_outline : Icons.warning_amber_rounded, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(fontWeight: FontWeight.w800, color: fg, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

/// Tap-to-edit percent with slider (withdrawal rate, etc.).
class GoalEditablePercentSlider extends StatefulWidget {
  const GoalEditablePercentSlider({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 100,
    this.divisions,
    this.quantize,
  });

  final String label;
  final double value;
  final ValueChanged<double> onChanged;
  final double min;
  final double max;
  final int? divisions;
  final double Function(double)? quantize;

  @override
  State<GoalEditablePercentSlider> createState() => _GoalEditablePercentSliderState();
}

class _GoalEditablePercentSliderState extends State<GoalEditablePercentSlider> {
  late final TextEditingController _pctCtrl;
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _pctCtrl = TextEditingController(text: _formatPct(widget.value));
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    _pctCtrl.dispose();
    super.dispose();
  }

  String _formatPct(double v) => v.toStringAsFixed(1);

  double _applyQuantize(double v) {
    final q = widget.quantize ?? (double x) => x;
    return q(v.clamp(widget.min, widget.max));
  }

  void _applyFromField({bool dismiss = false}) {
    final parsed = double.tryParse(_pctCtrl.text.trim().replaceAll('%', ''));
    if (parsed == null) return;
    final next = _applyQuantize(parsed);
    widget.onChanged(next);
    _pctCtrl.text = _formatPct(next);
    if (dismiss) _focus.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final editing = _focus.hasFocus;
    if (!editing && _pctCtrl.text != _formatPct(widget.value)) {
      _pctCtrl.text = _formatPct(widget.value);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(widget.label, style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 12)),
            const Spacer(),
            SizedBox(
              width: 52,
              child: TextField(
                controller: _pctCtrl,
                focusNode: _focus,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _applyFromField(dismiss: true),
                onEditingComplete: () => _applyFromField(dismiss: true),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, height: 1.2),
                textAlign: TextAlign.center,
                decoration: const InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  isCollapsed: true,
                ),
              ),
            ),
            Text('%', style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant)),
          ],
        ),
        Slider(
          value: widget.value.clamp(widget.min, widget.max),
          min: widget.min,
          max: widget.max,
          divisions: widget.divisions,
          label: '${widget.value.toStringAsFixed(1)}%',
          onChanged: (v) {
            final next = _applyQuantize(v);
            widget.onChanged(next);
            if (!_focus.hasFocus) _pctCtrl.text = _formatPct(next);
          },
        ),
      ],
    );
  }
}
