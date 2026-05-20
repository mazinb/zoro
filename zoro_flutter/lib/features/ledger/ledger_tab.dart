import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:dirham_symbol/dirham_symbol.dart';

import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/finance/goal_asset_buckets.dart';
import 'expense_donut_chart.dart';
import 'expense_estimates_editor_page.dart';
import 'ledger_import_page.dart';
import 'ledger_orchestrator_page.dart';

enum LedgerMode { assets, liabilities, cashflow }

String _ledgerFmtDate(DateTime? d) {
  if (d == null) return '—';
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${names[d.month - 1]} ${d.day}, ${d.year}';
}

String _ledgerDigitsOnly(String s) => s.replaceAll(RegExp(r'[^0-9]'), '');

double _ledgerParseGroupedDouble(String raw) {
  final d = _ledgerDigitsOnly(raw);
  if (d.isEmpty) return 0;
  return double.tryParse(d) ?? 0;
}

double? _ledgerParseGroupedDoubleOrNull(String raw) {
  final d = _ledgerDigitsOnly(raw);
  if (d.isEmpty) return null;
  return double.tryParse(d);
}

String _ledgerHomeAmount(AppModel m, double v) =>
    formatGroupedInteger(v.round(), currency: m.displayCurrency);

double? _ledgerParsePercent(String raw) {
  final t = raw.trim().replaceAll(',', '');
  if (t.isEmpty) return null;
  return double.tryParse(t);
}

/// Total balance + optional rate % on one row.
Widget _ledgerTotalAndPercentRow({
  required TextEditingController totalCtrl,
  required TextEditingController pctCtrl,
  required CurrencyCode currency,
  bool showRate = true,
  bool totalReadOnly = false,
  Widget? totalReadOnlyChild,
}) {
  final aedPrefix = currency == CurrencyCode.aed
      ? const Padding(
          padding: EdgeInsetsDirectional.only(start: 12, end: 8),
          child: DirhamIcon(size: 16),
        )
      : null;

  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        flex: 7,
        child: totalReadOnly && totalReadOnlyChild != null
            ? totalReadOnlyChild
            : TextField(
                controller: totalCtrl,
                readOnly: totalReadOnly,
                keyboardType: TextInputType.number,
                inputFormatters: [GroupedIntegerTextInputFormatter(currency: currency)],
                decoration: InputDecoration(
                  labelText: 'Total',
                  prefixText: currency == CurrencyCode.aed ? null : currency.symbol,
                  prefixIcon: aedPrefix,
                  prefixIconConstraints:
                      currency == CurrencyCode.aed ? const BoxConstraints(minWidth: 38) : null,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
      ),
      if (showRate) ...[
        const SizedBox(width: 10),
        Expanded(
          flex: 3,
          child: TextField(
            controller: pctCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
            ],
            decoration: const InputDecoration(
              labelText: 'Rate',
              suffixText: '%',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
      ],
    ],
  );
}

/// Single bottom row: Import with AI, optional Delete, Save (asset / liability editors).
Widget _ledgerRowEditorActions({
  required BuildContext context,
  required VoidCallback onImportWithAi,
  required bool canDelete,
  VoidCallback? onDelete,
  required VoidCallback onSave,
}) {
  final cs = Theme.of(context).colorScheme;
  return Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        child: TextButton.icon(
          onPressed: onImportWithAi,
          icon: const Icon(Icons.auto_awesome, size: 17),
          label: const Text(
            'Import with AI',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            alignment: Alignment.centerLeft,
          ),
        ),
      ),
      if (canDelete && onDelete != null) ...[
        TextButton(
          onPressed: onDelete,
          style: TextButton.styleFrom(
            foregroundColor: cs.error,
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Delete'),
        ),
        const SizedBox(width: 4),
      ],
      FilledButton(
        onPressed: onSave,
        style: FilledButton.styleFrom(
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        ),
        child: const Text('Save'),
      ),
    ],
  );
}

class LedgerTab extends StatefulWidget {
  const LedgerTab({
    super.key,
    required this.model,
    this.focusSection,
    this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final String? focusSection;
  final VoidCallback? onPrivacyInteractionDenied;

  @override
  State<LedgerTab> createState() => _LedgerTabState();
}

class _LedgerTabState extends State<LedgerTab> {
  LedgerMode _mode = LedgerMode.assets;
  final _scroll = ScrollController();

  final _incomeKey = GlobalKey();
  final _expensesKey = GlobalKey();
  final _allocKey = GlobalKey();

  /// 0 = income, 1 = Cash, 2 = expenses (default expenses when opening Cashflow).
  int _cashflowTabIndex = 2;

  void _privacyDenied() => widget.onPrivacyInteractionDenied?.call();

  @override
  void initState() {
    super.initState();
    widget.model.addListener(_onModelPrivacy);
  }

  @override
  void dispose() {
    widget.model.removeListener(_onModelPrivacy);
    _scroll.dispose();
    super.dispose();
  }

  void _onModelPrivacy() {
    if (!mounted) return;
    if (widget.model.privacyHideAmounts &&
        _mode == LedgerMode.cashflow &&
        _cashflowTabIndex == 0) {
      setState(() => _cashflowTabIndex = 2);
    }
  }

  Future<void> _openAssetEditor(BuildContext context, {int? index}) async {
    final m = widget.model;
    final isNew = index == null;
    final draft = switch (index) {
      null => LedgerAssetRow.blank(
        defaultCurrencyCountry: m.defaultLedgerCurrencyCountry,
      ),
      final i => m.assets[i].clone(),
    };
    final outcome =
        await showLiquidGlassModalBottomSheet<_RowEditorOutcome<LedgerAssetRow>>(
          context: context,
          showDragHandle: true,
          isScrollControlled: true,
          sizesToContent: true,
          builder: (ctx) => _AssetEditorSheet(
            draft: draft,
            allowCurrencyEdit: isNew,
            canDelete: !isNew && m.assets.length > 1,
            model: m,
            parentContext: context,
          ),
        );
    if (!context.mounted || outcome == null) return;
    if (outcome.delete && index != null) {
      m.removeAssetAt(index);
      return;
    }
    final row = outcome.row;
    if (row != null) {
      switch (index) {
        case null:
          m.addAsset(row);
        case final i:
          m.replaceAsset(i, row);
      }
    }
  }

  Future<void> _openLiabilityEditor(BuildContext context, {int? index}) async {
    final m = widget.model;
    final isNew = index == null;
    final draft = switch (index) {
      null => LedgerLiabilityRow.blank(
        defaultCurrencyCountry: m.defaultLedgerCurrencyCountry,
      ),
      final i => m.liabilities[i].clone(),
    };
    final outcome =
        await showLiquidGlassModalBottomSheet<_RowEditorOutcome<LedgerLiabilityRow>>(
          context: context,
          showDragHandle: true,
          isScrollControlled: true,
          sizesToContent: true,
          builder: (ctx) => _LiabilityEditorSheet(
            draft: draft,
            allowCurrencyEdit: isNew,
            canDelete: !isNew,
            model: m,
            parentContext: context,
          ),
        );
    if (!context.mounted || outcome == null) return;
    if (outcome.delete && index != null) {
      m.removeLiabilityAt(index);
      return;
    }
    final row = outcome.row;
    if (row != null) {
      switch (index) {
        case null:
          m.addLiability(row);
        case final i:
          m.replaceLiability(i, row);
      }
    }
  }

  void _onTapAdd() {
    switch (_mode) {
      case LedgerMode.assets:
        _openAssetEditor(context);
        return;
      case LedgerMode.liabilities:
        _openLiabilityEditor(context);
        return;
      case LedgerMode.cashflow:
        _openMonthlyCashflowSheet(context);
        return;
    }
  }

  Future<void> _openMonthlyCashflowSheet(
    BuildContext context, {
    String? initialMonthKey,
  }) async {
    final m = widget.model;
    final lockMonth = initialMonthKey != null;
    final month =
        initialMonthKey ?? AppModel.defaultCashflowEditorMonthKey();
    final entry = await Navigator.of(context).push<MonthlyCashflowEntry?>(
      MaterialPageRoute<MonthlyCashflowEntry?>(
        fullscreenDialog: true,
        builder: (ctx) => _MonthlyCashflowEditorPage(
          model: m,
          initialMonthKey: month,
          lockMonth: lockMonth,
        ),
      ),
    );
    if (!context.mounted) return;
    if (entry != null) m.upsertMonthlyCashflow(entry);
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      controller: _scroll,
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Text(
              'Ledger',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const Spacer(),
            IconButton.filledTonal(
              onPressed: () {
                Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    fullscreenDialog: true,
                    builder: (ctx) => LedgerOrchestratorPage(
                      model: widget.model,
                      onPickSection: (s) {
                        setState(() {
                          switch (s) {
                            case LedgerOrchestratorSection.assets:
                              _mode = LedgerMode.assets;
                              break;
                            case LedgerOrchestratorSection.liabilities:
                              _mode = LedgerMode.liabilities;
                              break;
                            case LedgerOrchestratorSection.expenses:
                              _mode = LedgerMode.cashflow;
                              _cashflowTabIndex = 2;
                              break;
                          }
                        });
                      },
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.auto_awesome),
              tooltip: 'Ledger assistant',
              style: IconButton.styleFrom(
                backgroundColor: widget.model.accentSoft,
                foregroundColor: widget.model.accent,
              ),
            ),
            const SizedBox(width: 10),
            if (_mode == LedgerMode.cashflow)
              IconButton.filledTonal(
                onPressed: () {
                  if (widget.model.privacyHideAmounts) {
                    _privacyDenied();
                    return;
                  }
                  _onTapAdd();
                },
                icon: const Icon(Icons.add),
                tooltip: 'Monthly cash flow entry',
                style: IconButton.styleFrom(
                  backgroundColor: widget.model.accentSoft,
                  foregroundColor: widget.model.accent,
                ),
              )
            else if (_mode != LedgerMode.cashflow)
              IconButton.filledTonal(
                onPressed: () {
                  if (widget.model.privacyHideAmounts) {
                    _privacyDenied();
                    return;
                  }
                  _onTapAdd();
                },
                icon: const Icon(Icons.add),
                tooltip: _mode == LedgerMode.assets
                    ? 'Add asset'
                    : 'Add liability',
              ),
          ],
        ),
        const SizedBox(height: 12),
        _Segmented(
          value: _mode,
          onChanged: (v) {
            setState(() {
              _mode = v;
              if (v == LedgerMode.cashflow) {
                _cashflowTabIndex = 2;
              }
            });
          },
          accent: widget.model.accent,
        ),
        const SizedBox(height: 16),
        if (_mode == LedgerMode.cashflow) ...[
          _CashflowPane(
            model: widget.model,
            incomeKey: _incomeKey,
            expensesKey: _expensesKey,
            allocationsKey: _allocKey,
            tabIndex: _cashflowTabIndex,
            onTabChanged: (i) => setState(() => _cashflowTabIndex = i),
            onMonthEntryTap: (mk) =>
                _openMonthlyCashflowSheet(context, initialMonthKey: mk),
            onPrivacyInteractionDenied: _privacyDenied,
          ),
        ] else if (_mode == LedgerMode.assets) ...[
          ...widget.model.assets.asMap().entries.map(
            (e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _LedgerAssetCard(
                model: widget.model,
                row: e.value,
                accent: widget.model.accent,
                displayCurrency: widget.model.displayCurrency,
                usdPerUnitOverrides: widget.model.fxUsdPerUnitResolved,
                privacyHideAmounts: widget.model.privacyHideAmounts,
                onTap: () {
                  if (widget.model.privacyHideAmounts) {
                    _privacyDenied();
                    return;
                  }
                  _openAssetEditor(context, index: e.key);
                },
              ),
            ),
          ),
          _AddLedgerRowCard(
            label: 'Add asset',
            accent: widget.model.accent,
            onTap: () {
              if (widget.model.privacyHideAmounts) {
                _privacyDenied();
                return;
              }
              _onTapAdd();
            },
          ),
        ] else ...[
          ...widget.model.liabilities.asMap().entries.map(
            (e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _LedgerLiabilityCard(
                row: e.value,
                accent: widget.model.accent,
                displayCurrency: widget.model.displayCurrency,
                usdPerUnitOverrides: widget.model.fxUsdPerUnitResolved,
                privacyHideAmounts: widget.model.privacyHideAmounts,
                onTap: () {
                  if (widget.model.privacyHideAmounts) {
                    _privacyDenied();
                    return;
                  }
                  _openLiabilityEditor(context, index: e.key);
                },
              ),
            ),
          ),
          _AddLedgerRowCard(
            label: 'Add liability',
            accent: widget.model.accent,
            onTap: () {
              if (widget.model.privacyHideAmounts) {
                _privacyDenied();
                return;
              }
              _onTapAdd();
            },
          ),
        ],
      ],
    );
  }

  @override
  void didUpdateWidget(covariant LedgerTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusSection != widget.focusSection &&
        widget.focusSection != null) {
      final section = widget.focusSection!;
      if (section == 'assets') {
        setState(() => _mode = LedgerMode.assets);
        WidgetsBinding.instance.addPostFrameCallback((_) => _focus(section));
        return;
      }
      if (section == 'liabilities') {
        setState(() => _mode = LedgerMode.liabilities);
        WidgetsBinding.instance.addPostFrameCallback((_) => _focus(section));
        return;
      }

      final nextTab = switch (section) {
        'expenses' => 2,
        'allocations' => 1,
        // 'cashflow' opens the cashflow pane (default: Expenses).
        'cashflow' => 2,
        _ => widget.model.privacyHideAmounts ? 2 : 0,
      };
      setState(() {
        _mode = LedgerMode.cashflow;
        _cashflowTabIndex = nextTab;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _focus(section));
    }
  }

  void _focus(String section) {
    if (section == 'assets' ||
        section == 'liabilities' ||
        section == 'cashflow') {
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
      return;
    }
    final ctx = switch (section) {
      'income' => _incomeKey.currentContext,
      'expenses' => _expensesKey.currentContext,
      'allocations' => _allocKey.currentContext,
      _ => null,
    };
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
    );
  }
}

class _RowEditorOutcome<T> {
  const _RowEditorOutcome({this.row, this.delete = false});

  final T? row;
  final bool delete;
}

class _MonthlyCashflowEditorPage extends StatefulWidget {
  const _MonthlyCashflowEditorPage({
    required this.model,
    required this.initialMonthKey,
    required this.lockMonth,
  });

  final AppModel model;
  final String initialMonthKey;
  final bool lockMonth;

  @override
  State<_MonthlyCashflowEditorPage> createState() =>
      _MonthlyCashflowEditorPageState();
}

class _MonthlyCashflowEditorPageState
    extends State<_MonthlyCashflowEditorPage> {
  late String _monthKey = widget.initialMonthKey;

  final _openingCtrl = TextEditingController();
  final _closingCtrl = TextEditingController();
  final _earnedCtrl = TextEditingController();
  final _cashFdCtrl = TextEditingController();
  final _invCtrl = TextEditingController();
  final _commentCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadMonth(_monthKey);
  }

  @override
  void dispose() {
    _openingCtrl.dispose();
    _closingCtrl.dispose();
    _earnedCtrl.dispose();
    _cashFdCtrl.dispose();
    _invCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  double? _parseNumOrNull(TextEditingController c) =>
      _ledgerParseGroupedDoubleOrNull(c.text);

  double? _calcSpendingOrNull() {
    final opening = _parseNumOrNull(_openingCtrl) ?? 0;
    final closing = _parseNumOrNull(_closingCtrl);
    if (closing == null) return null;
    final earned = _parseNumOrNull(_earnedCtrl) ?? 0;
    final saved = _parseNumOrNull(_cashFdCtrl) ?? 0;
    final invested = _parseNumOrNull(_invCtrl) ?? 0;
    if (earned > 0) {
      return opening + earned - closing - saved - invested;
    }
    return closing - opening - saved - invested;
  }

  void _loadMonth(String mk) {
    final m = widget.model;
    final ex = m.monthlyEntryFor(mk);
    if (ex != null) {
      final dc = m.displayCurrency;
      _openingCtrl.text = formatGroupedInteger(
        ex.openingBalance.round(),
        currency: dc,
      );
      _closingCtrl.text = formatGroupedInteger(
        ex.closingBalance.round(),
        currency: dc,
      );
      _earnedCtrl.text = ex.monthlyEarned > 0
          ? formatGroupedInteger(ex.monthlyEarned.round(), currency: dc)
          : '';
      _cashFdCtrl.text = formatGroupedInteger(
        ex.outflowToCashFd.round(),
        currency: dc,
      );
      _invCtrl.text = formatGroupedInteger(
        ex.outflowToInvested.round(),
        currency: dc,
      );
      _commentCtrl.text = ex.comment;
      return;
    }
    final prevKey = AppModel.previousMonthKey(mk);
    final prevClose = prevKey == null
        ? null
        : m.monthlyEntryFor(prevKey)?.closingBalance;
    final suggestedOpening = prevClose ?? 0;
    _openingCtrl.text = formatGroupedInteger(
      suggestedOpening.round(),
      currency: m.displayCurrency,
    );
    _closingCtrl.clear();
    _earnedCtrl.clear();
    _cashFdCtrl.text = formatGroupedInteger(0, currency: m.displayCurrency);
    _invCtrl.text = formatGroupedInteger(0, currency: m.displayCurrency);
    _commentCtrl.clear();
  }

  Future<void> _openAiImport() async {
    final importedMonth = await Navigator.of(context).push<String?>(
      MaterialPageRoute<String?>(
        fullscreenDialog: true,
        builder: (ctx) => LedgerImportPage(
          model: widget.model,
          kind: LedgerImportKind.cashflow,
          cashflowEditorHintMonthKey: _monthKey,
        ),
      ),
    );
    if (!mounted) return;
    if ((importedMonth ?? '').isEmpty) return;
    setState(() {
      _monthKey = importedMonth!;
      _loadMonth(importedMonth);
    });
  }

  void _save() {
    final m = widget.model;
    final opening = _ledgerParseGroupedDouble(_openingCtrl.text);
    if (_ledgerDigitsOnly(_closingCtrl.text).isEmpty) {
      showDialog<void>(
        context: context,
        builder: (dctx) => AlertDialog(
          title: const Text('Closing balance required'),
          content: const Text('Enter a closing balance before saving.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dctx).pop(),
              child: const Text('Edit'),
            ),
          ],
        ),
      );
      return;
    }
    final closing = _ledgerParseGroupedDouble(_closingCtrl.text);
    final earned = _ledgerParseGroupedDouble(_earnedCtrl.text);
    final cf = _ledgerParseGroupedDouble(_cashFdCtrl.text);
    final iv = _ledgerParseGroupedDouble(_invCtrl.text);
    final sp = _calcSpendingOrNull() ?? 0;

    final prevKey = AppModel.previousMonthKey(_monthKey);
    final prevClose = prevKey == null
        ? null
        : m.monthlyEntryFor(prevKey)?.closingBalance;
    if (prevClose != null && opening.round() != prevClose.round()) {
      showDialog<void>(
        context: context,
        builder: (dctx) => AlertDialog(
          title: const Text('Opening balance mismatch'),
          content: Text(
            'This month’s opening balance should equal last month’s closing balance.\n\n'
            'Last month closing: ${_ledgerHomeAmount(m, prevClose)}\n'
            'Your opening: ${_ledgerHomeAmount(m, opening)}\n\n'
            'Please correct it before saving.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dctx).pop(),
              child: const Text('Edit'),
            ),
          ],
        ),
      );
      return;
    }
    if (sp < 0) {
      showDialog<void>(
        context: context,
        builder: (dctx) => AlertDialog(
          title: const Text('Spending can’t be negative'),
          content: Text(
            'Your inputs imply negative spending (${_ledgerHomeAmount(m, sp)}).\n\n'
            'Double-check Opening, Closing, Earned, Saved, and Invested.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dctx).pop(),
              child: const Text('Edit'),
            ),
          ],
        ),
      );
      return;
    }
    final prev = m.monthlyEntryFor(_monthKey);
    if (prev != null &&
        ((prev.outflowToInvested - iv).abs() > 0.51 ||
            (iv < 0.005 && prev.outflowToInvested > 0.005))) {
      m.reverseInvestmentCreditsForMonth(_monthKey);
    }
    if (prev != null &&
        ((prev.outflowToCashFd - cf).abs() > 0.51 ||
            (cf < 0.005 && prev.outflowToCashFd > 0.005))) {
      m.reverseSavingsCreditsForMonth(_monthKey);
    }
    final reconciled = reconcileInvestmentLinesForMonthlySave(
      newInvested: iv,
      previous: prev?.investmentLines ?? const [],
    );
    final reconciledSav = reconcileSavingsLinesForMonthlySave(
      newSaved: cf,
      previous: prev?.savingsLines ?? const [],
    );
    FocusManager.instance.primaryFocus?.unfocus();
    Navigator.of(context).pop(
      MonthlyCashflowEntry(
        monthKey: _monthKey,
        openingBalance: opening,
        closingBalance: closing,
        monthlyEarned: earned,
        outflowToCashFd: cf,
        outflowToInvested: iv,
        monthlySpending: sp,
        comment: _commentCtrl.text.trim(),
        contextMarkdown: m.monthlyEntryFor(_monthKey)?.contextMarkdown,
        investmentLines: reconciled,
        savingsLines: reconciledSav,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final monthDate = DateTime.tryParse('$_monthKey-01') ?? DateTime.now();
    final selectedYear = monthDate.year;
    final selectedMonth = monthDate.month;
    final nowYear = DateTime.now().year;
    final years = <int>[for (var y = nowYear; y >= (nowYear - 5); y--) y];
    const monthLabels = <int, String>{
      1: 'Jan',
      2: 'Feb',
      3: 'Mar',
      4: 'Apr',
      5: 'May',
      6: 'Jun',
      7: 'Jul',
      8: 'Aug',
      9: 'Sep',
      10: 'Oct',
      11: 'Nov',
      12: 'Dec',
    };

    const dense = InputDecoration(border: OutlineInputBorder(), isDense: true);

    final hasSaved = m.monthlyEntryFor(_monthKey) != null;
    final prevKey = AppModel.previousMonthKey(_monthKey);
    final prevClose = prevKey == null
        ? null
        : m.monthlyEntryFor(prevKey)?.closingBalance;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          hasSaved
              ? 'Edit ${AppModel.formatMonthKeyLabel(_monthKey)}'
              : 'Monthly cash flow entry',
        ),
        actions: [
          TextButton.icon(
            onPressed: _openAiImport,
            icon: const Icon(Icons.auto_awesome, size: 18),
            label: const Text('Import with AI'),
          ),
          TextButton(onPressed: _save, child: const Text('Save')),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.lockMonth)
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Month',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                child: Text(
                  AppModel.formatMonthKeyLabel(_monthKey),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: selectedMonth,
                      decoration: dense.copyWith(labelText: 'Month'),
                      items: [
                        for (var i = 1; i <= 12; i++)
                          DropdownMenuItem<int>(
                            value: i,
                            child: Text(monthLabels[i] ?? '$i'),
                          ),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        final mk = AppModel.monthKeyFor(
                          DateTime(selectedYear, v, 1),
                        );
                        setState(() {
                          _monthKey = mk;
                          _loadMonth(mk);
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      initialValue: selectedYear,
                      decoration: dense.copyWith(labelText: 'Year'),
                      items: [
                        for (final y in years)
                          DropdownMenuItem<int>(value: y, child: Text('$y')),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        final mk = AppModel.monthKeyFor(
                          DateTime(v, selectedMonth, 1),
                        );
                        setState(() {
                          _monthKey = mk;
                          _loadMonth(mk);
                        });
                      },
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _openingCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(
                        currency: m.displayCurrency,
                      ),
                    ],
                    decoration: dense.copyWith(
                      labelText: 'Opening',
                      helperText: prevClose == null
                          ? 'Verify'
                          : 'Should match ${_ledgerHomeAmount(m, prevClose)}',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _closingCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(
                        currency: m.displayCurrency,
                      ),
                    ],
                    decoration: dense.copyWith(
                      labelText: 'Closing',
                      helperText: 'End of month',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _earnedCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [
                GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
              ],
              decoration: dense.copyWith(
                labelText: 'Earned',
                helperText: 'Take-home this month (optional)',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cashFdCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(
                        currency: m.displayCurrency,
                      ),
                    ],
                    decoration: dense.copyWith(
                      labelText: 'Saved',
                      helperText: '0 if none',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _invCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(
                        currency: m.displayCurrency,
                      ),
                    ],
                    decoration: dense.copyWith(
                      labelText: 'Invested',
                      helperText: '0 if none',
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AnimatedBuilder(
              animation: Listenable.merge([
                _openingCtrl,
                _closingCtrl,
                _earnedCtrl,
                _cashFdCtrl,
                _invCtrl,
              ]),
              builder: (ctx, _) {
                final spending = _calcSpendingOrNull();
                final ok = spending == null ? true : spending >= -0.5;
                final txt = spending == null
                    ? '—'
                    : _ledgerHomeAmount(
                        m,
                        spending.abs() < 0.005 ? 0.0 : spending,
                      );
                final cs = Theme.of(ctx).colorScheme;
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: ok
                        ? cs.surfaceContainerHighest
                        : cs.errorContainer.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: ok
                          ? cs.outlineVariant
                          : cs.error.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Spending',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                      ),
                      Text(
                        txt,
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          color: ok
                              ? cs.onSurface
                              : cs.error,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentCtrl,
              minLines: 3,
              maxLines: 6,
              decoration: dense.copyWith(
                labelText: 'Note',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: _save, child: const Text('Save')),
          ],
        ),
      ),
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({
    required this.value,
    required this.onChanged,
    required this.accent,
  });

  final LedgerMode value;
  final ValueChanged<LedgerMode> onChanged;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SegmentedButton<LedgerMode>(
      segments: const [
        ButtonSegment(
          value: LedgerMode.assets,
          label: Text('Assets'),
          icon: Icon(Icons.savings),
        ),
        ButtonSegment(
          value: LedgerMode.liabilities,
          label: Text('Liabilities'),
          icon: Icon(Icons.credit_card),
        ),
        ButtonSegment(
          value: LedgerMode.cashflow,
          label: Text('Cashflow'),
          icon: Icon(Icons.swap_vert),
        ),
      ],
      selected: {value},
      onSelectionChanged: (s) => onChanged(s.first),
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return accent.withValues(alpha: 0.12);
          }
          return cs.surfaceContainerHigh;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent;
          return cs.onSurfaceVariant;
        }),
        side: WidgetStatePropertyAll(
          BorderSide(color: cs.outlineVariant),
        ),
      ),
    );
  }
}

class _LedgerAssetCard extends StatelessWidget {
  const _LedgerAssetCard({
    required this.model,
    required this.row,
    required this.accent,
    required this.displayCurrency,
    required this.usdPerUnitOverrides,
    required this.privacyHideAmounts,
    required this.onTap,
  });

  final AppModel model;
  final LedgerAssetRow row;
  final Color accent;
  final CurrencyCode displayCurrency;
  final Map<CurrencyCode, double> usdPerUnitOverrides;
  final bool privacyHideAmounts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final displayValue = model.assetDisplayValue(row);
    final grouped = formatGroupedInteger(
      displayValue.round(),
      currency: displayCurrency,
    );
    final amountText = privacyHideAmounts
        ? maskSensitiveNumberString(grouped)
        : grouped;
    final title = row.name.trim().isEmpty ? row.type.label : row.name;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(row.type.icon, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurface),
                    ),
                    if (row.comment.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        row.comment.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: cs.outline,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                amountText,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, color: cs.outline),
            ],
          ),
        ),
      ),
    );
  }
}

class _LedgerLiabilityCard extends StatelessWidget {
  const _LedgerLiabilityCard({
    required this.row,
    required this.accent,
    required this.displayCurrency,
    required this.usdPerUnitOverrides,
    required this.privacyHideAmounts,
    required this.onTap,
  });

  final LedgerLiabilityRow row;
  final Color accent;
  final CurrencyCode displayCurrency;
  final Map<CurrencyCode, double> usdPerUnitOverrides;
  final bool privacyHideAmounts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final native = currencyCodeForPresetCountry(row.currencyCountry);
    final displayValue = convertCurrency(
      value: row.total,
      from: native,
      to: displayCurrency,
      usdPerUnitOverrides: usdPerUnitOverrides,
    );
    final grouped = formatGroupedInteger(
      displayValue.round(),
      currency: displayCurrency,
    );
    final amountText = privacyHideAmounts
        ? maskSensitiveNumberString(grouped)
        : grouped;
    final title = row.name.trim().isEmpty ? row.type.label : row.name;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(row.type.icon, color: accent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurface),
                    ),
                    if (row.comment.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        row.comment.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: cs.outline,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                amountText,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, color: cs.outline),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddLedgerRowCard extends StatelessWidget {
  const _AddLedgerRowCard({
    required this.label,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 2),
          child: Row(
            children: [
              Icon(Icons.add_circle_outline, color: accent),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(fontWeight: FontWeight.w800, color: accent),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AssetEditorSheet extends StatefulWidget {
  const _AssetEditorSheet({
    required this.draft,
    required this.allowCurrencyEdit,
    required this.canDelete,
    required this.model,
    required this.parentContext,
  });

  final LedgerAssetRow draft;
  final bool allowCurrencyEdit;
  final bool canDelete;
  final AppModel model;
  final BuildContext parentContext;

  @override
  State<_AssetEditorSheet> createState() => _AssetEditorSheetState();
}

class _AssetEditorSheetState extends State<_AssetEditorSheet> {
  late LedgerAssetRow _row;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _labelCtrl;
  late final TextEditingController _totalCtrl;
  late final TextEditingController _rateCtrl;
  late final TextEditingController _commentCtrl;

  @override
  void initState() {
    super.initState();
    _row = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _row.name);
    _labelCtrl = TextEditingController(text: _row.label);
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    _totalCtrl = TextEditingController(
      text: _row.total == 0
          ? ''
          : formatGroupedInteger(_row.total.round(), currency: native),
    );
    _rateCtrl = TextEditingController(
      text: _row.returnRatePct > 0
          ? _row.returnRatePct.toStringAsFixed(
              _row.returnRatePct == _row.returnRatePct.roundToDouble() ? 0 : 1,
            )
          : '',
    );
    _commentCtrl = TextEditingController(text: _row.comment);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _labelCtrl.dispose();
    _totalCtrl.dispose();
    _rateCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _row.name = _nameCtrl.text;
    _row.label = _labelCtrl.text;
    _row.returnRatePct = _ledgerParsePercent(_rateCtrl.text) ?? 0;
    if (!widget.model.primaryCashBalanceIsMirrored(_row)) {
      _row.comment = _commentCtrl.text;
      _row.total = _ledgerParseGroupedDouble(_totalCtrl.text);
    }
    Navigator.of(context).pop(_RowEditorOutcome(row: _row));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    final maxH = (MediaQuery.sizeOf(context).height * 0.88 - bottom).clamp(220.0, 4000.0);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxH),
        child: ListView(
          shrinkWrap: true,
          physics: const ClampingScrollPhysics(),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    widget.allowCurrencyEdit ? 'New asset' : 'Edit asset',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 6),
            DropdownButtonFormField<LedgerAssetType>(
              initialValue: _row.type,
              decoration: const InputDecoration(
                labelText: 'Type',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final t in LedgerAssetType.values)
                  DropdownMenuItem(value: t, child: Text(t.label)),
              ],
              onChanged: widget.model.primaryCashBalanceIsMirrored(_row)
                  ? null
                  : (v) {
                      if (v == null) return;
                      setState(() => _row.type = v);
                    },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              readOnly: widget.model.primaryCashBalanceIsMirrored(_row),
              decoration: InputDecoration(
                labelText: 'Name',
                hintText: 'e.g. Main savings',
                border: const OutlineInputBorder(),
                helperText: widget.model.primaryCashBalanceIsMirrored(_row)
                    ? 'Rename from Ledger → Cash tab'
                    : null,
              ),
            ),
            const SizedBox(height: 12),
            if (widget.allowCurrencyEdit)
              DropdownButtonFormField<String>(
                initialValue: _row.currencyCountry,
                decoration: const InputDecoration(
                  labelText: 'Currency (country)',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final c in countryPresets)
                    DropdownMenuItem(
                      value: c.name,
                      child: Text('${c.flag} ${c.name} (${c.currencySymbol})'),
                    ),
                ],
                onChanged: widget.model.primaryCashBalanceIsMirrored(_row)
                    ? null
                    : (v) {
                        if (v == null) return;
                        setState(() {
                          _row.currencyCountry = v;
                          final cc = currencyCodeForPresetCountry(v);
                          final digits = _totalCtrl.text.replaceAll(
                            RegExp(r'[^0-9]'),
                            '',
                          );
                          if (digits.isNotEmpty) {
                            _totalCtrl.text = formatGroupedInteger(
                              int.parse(digits),
                              currency: cc,
                            );
                          }
                        });
                      },
              )
            else
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Currency (locked after save)',
                  border: OutlineInputBorder(),
                  helperText: 'Add a new row to pick a different currency.',
                ),
                child: Row(
                  children: [
                    Text(presetForCountry(_row.currencyCountry).flag),
                    const SizedBox(width: 8),
                    Text(
                      '${_row.currencyCountry} (${presetForCountry(_row.currencyCountry).currencySymbol})',
                    ),
                  ],
                ),
              ),
            if (_row.type == LedgerAssetType.other) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _labelCtrl,
                readOnly: widget.model.primaryCashBalanceIsMirrored(_row),
                decoration: const InputDecoration(
                  labelText: 'Label',
                  hintText: 'e.g. Other assets',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            _ledgerTotalAndPercentRow(
              totalCtrl: _totalCtrl,
              pctCtrl: _rateCtrl,
              currency: native,
              totalReadOnly: widget.model.primaryCashBalanceIsMirrored(_row),
              totalReadOnlyChild: widget.model.primaryCashBalanceIsMirrored(_row)
                  ? InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Balance',
                        border: OutlineInputBorder(),
                        helperText: 'Latest month closing (Cash tab).',
                        isDense: true,
                      ),
                      child: Text(
                        formatGroupedInteger(
                          (widget.model.latestCashClosingBalanceDisplay ?? 0).round(),
                          currency: widget.model.displayCurrency,
                        ),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 12),
            if (widget.model.primaryCashBalanceIsMirrored(_row))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  'Balance from cashflow -> cash section',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              )
            else
              TextField(
                controller: _commentCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Comment (optional)',
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(),
                ),
              ),
            if (!widget.model.primaryCashBalanceIsMirrored(_row)) ...[
              const SizedBox(height: 14),
              _ledgerRowEditorActions(
                context: context,
                onImportWithAi: () {
                  Navigator.of(context).pop();
                  Navigator.of(widget.parentContext).push<void>(
                    MaterialPageRoute<void>(
                      fullscreenDialog: true,
                      builder: (ctx) => LedgerImportPage(
                        model: widget.model,
                        kind: LedgerImportKind.asset,
                        editAssetId:
                            widget.allowCurrencyEdit ? null : widget.draft.id,
                      ),
                    ),
                  );
                },
                canDelete: widget.canDelete,
                onDelete: widget.canDelete
                    ? () => Navigator.of(context).pop(
                          const _RowEditorOutcome<LedgerAssetRow>(delete: true),
                        )
                    : null,
                onSave: _save,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LiabilityEditorSheet extends StatefulWidget {
  const _LiabilityEditorSheet({
    required this.draft,
    required this.allowCurrencyEdit,
    required this.canDelete,
    required this.model,
    required this.parentContext,
  });

  final LedgerLiabilityRow draft;
  final bool allowCurrencyEdit;
  final bool canDelete;
  final AppModel model;
  final BuildContext parentContext;

  @override
  State<_LiabilityEditorSheet> createState() => _LiabilityEditorSheetState();
}

class _LiabilityEditorSheetState extends State<_LiabilityEditorSheet> {
  late LedgerLiabilityRow _row;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _totalCtrl;
  late final TextEditingController _interestCtrl;
  late final TextEditingController _commentCtrl;

  @override
  void initState() {
    super.initState();
    _row = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _row.name);
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    _totalCtrl = TextEditingController(
      text: _row.total == 0
          ? ''
          : formatGroupedInteger(_row.total.round(), currency: native),
    );
    _interestCtrl = TextEditingController(
      text: _row.interestRatePct > 0 ? _row.interestRatePct.toStringAsFixed(_row.interestRatePct == _row.interestRatePct.roundToDouble() ? 0 : 1) : '',
    );
    _commentCtrl = TextEditingController(text: _row.comment);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _totalCtrl.dispose();
    _interestCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _row.name = _nameCtrl.text;
    _row.comment = _commentCtrl.text;
    _row.total = _ledgerParseGroupedDouble(_totalCtrl.text);
    _row.interestRatePct = _ledgerParsePercent(_interestCtrl.text) ?? 0;
    Navigator.of(context).pop(_RowEditorOutcome(row: _row));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    final maxH = (MediaQuery.sizeOf(context).height * 0.88 - bottom).clamp(220.0, 4000.0);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxH),
        child: ListView(
          shrinkWrap: true,
          physics: const ClampingScrollPhysics(),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    widget.allowCurrencyEdit ? 'New liability' : 'Edit liability',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 6),
            DropdownButtonFormField<LedgerLiabilityType>(
              initialValue: _row.type,
              decoration: const InputDecoration(
                labelText: 'Type',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final t in LedgerLiabilityType.values)
                  DropdownMenuItem(value: t, child: Text(t.label)),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() => _row.type = v);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            if (widget.allowCurrencyEdit)
              DropdownButtonFormField<String>(
                initialValue: _row.currencyCountry,
                decoration: const InputDecoration(
                  labelText: 'Currency (country)',
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final c in countryPresets)
                    DropdownMenuItem(
                      value: c.name,
                      child: Text('${c.flag} ${c.name} (${c.currencySymbol})'),
                    ),
                ],
                onChanged: (v) {
                  if (v == null) return;
                  setState(() {
                    _row.currencyCountry = v;
                    final cc = currencyCodeForPresetCountry(v);
                    final digits = _totalCtrl.text.replaceAll(
                      RegExp(r'[^0-9]'),
                      '',
                    );
                    if (digits.isNotEmpty) {
                      _totalCtrl.text = formatGroupedInteger(
                        int.parse(digits),
                        currency: cc,
                      );
                    }
                  });
                },
              )
            else
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Currency (locked after save)',
                  border: OutlineInputBorder(),
                  helperText: 'Add a new row to pick a different currency.',
                ),
                child: Row(
                  children: [
                    Text(presetForCountry(_row.currencyCountry).flag),
                    const SizedBox(width: 8),
                    Text(
                      '${_row.currencyCountry} (${presetForCountry(_row.currencyCountry).currencySymbol})',
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            _ledgerTotalAndPercentRow(
              totalCtrl: _totalCtrl,
              pctCtrl: _interestCtrl,
              currency: native,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Comment (optional)',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            _ledgerRowEditorActions(
              context: context,
              onImportWithAi: () {
                Navigator.of(context).pop();
                Navigator.of(widget.parentContext).push<void>(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (ctx) => LedgerImportPage(
                      model: widget.model,
                      kind: LedgerImportKind.liability,
                      editLiabilityId:
                          widget.allowCurrencyEdit ? null : widget.draft.id,
                    ),
                  ),
                );
              },
              canDelete: widget.canDelete,
              onDelete: widget.canDelete
                  ? () => Navigator.of(context).pop(
                        const _RowEditorOutcome<LedgerLiabilityRow>(delete: true),
                      )
                  : null,
              onSave: _save,
            ),
          ],
        ),
      ),
    );
  }
}

class _CashflowPane extends StatelessWidget {
  const _CashflowPane({
    required this.model,
    required this.incomeKey,
    required this.expensesKey,
    required this.allocationsKey,
    required this.tabIndex,
    required this.onTabChanged,
    required this.onMonthEntryTap,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final GlobalKey incomeKey;
  final GlobalKey expensesKey;
  final GlobalKey allocationsKey;
  final int tabIndex;
  final ValueChanged<int> onTabChanged;
  final void Function(String monthKey) onMonthEntryTap;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final accent = model.accent;
    final privacy = model.privacyHideAmounts;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CashflowTabToggle(
              tabIndex: tabIndex,
              accent: accent,
              privacyHideAmounts: privacy,
              onChanged: onTabChanged,
              onPrivacyInteractionDenied: onPrivacyInteractionDenied,
            ),
            const SizedBox(height: 16),
            if (tabIndex == 0)
              _IncomeSection(model: model, key: incomeKey)
            else if (tabIndex == 1)
              _CashTabSection(
                model: model,
                key: allocationsKey,
                onMonthEntryTap: onMonthEntryTap,
                onPrivacyInteractionDenied: onPrivacyInteractionDenied,
              )
            else
              _ExpensesSection(
                model: model,
                key: expensesKey,
                onMonthEntryTap: onMonthEntryTap,
                onPrivacyInteractionDenied: onPrivacyInteractionDenied,
              ),
          ],
        ),
      ),
    );
  }
}

class _CashflowTabToggle extends StatelessWidget {
  const _CashflowTabToggle({
    required this.tabIndex,
    required this.accent,
    required this.privacyHideAmounts,
    required this.onChanged,
    required this.onPrivacyInteractionDenied,
  });

  final int tabIndex;
  final Color accent;
  final bool privacyHideAmounts;
  final ValueChanged<int> onChanged;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SegmentedButton<int>(
      showSelectedIcon: false,
      segments: [
        ButtonSegment<int>(
          value: 0,
          label: Opacity(
            opacity: privacyHideAmounts ? 0.45 : 1,
            child: const Text('Income'),
          ),
        ),
        const ButtonSegment<int>(
          value: 1,
          label: Text('Cash'),
          tooltip: 'Balances & investments',
        ),
        const ButtonSegment<int>(value: 2, label: Text('Expenses')),
      ],
      selected: {tabIndex},
      onSelectionChanged: (s) {
        if (s.isEmpty) return;
        final v = s.first;
        if (v == 0 && privacyHideAmounts) {
          onPrivacyInteractionDenied();
          return;
        }
        onChanged(v);
      },
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        side: WidgetStatePropertyAll(
          BorderSide(color: cs.outlineVariant),
        ),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return accent.withValues(alpha: 0.12);
          }
          return cs.surfaceContainerHigh;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent;
          return cs.onSurfaceVariant;
        }),
      ),
    );
  }
}

class _IncomeLineCurrencyField extends StatelessWidget {
  const _IncomeLineCurrencyField({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final CurrencyCode value;
  final ValueChanged<CurrencyCode> onChanged;

  @override
  Widget build(BuildContext context) {
    final selected = kDisplayCurrencyPickerOptions.contains(value)
        ? value
        : CurrencyCode.usd;
    return DropdownButtonFormField<CurrencyCode>(
      initialValue: selected,
      decoration: const InputDecoration(
        labelText: 'Currency',
        border: OutlineInputBorder(),
        isDense: true,
      ),
      items: [
        for (final c in kDisplayCurrencyPickerOptions)
          DropdownMenuItem(value: c, child: Text('${c.flag} ${c.code}')),
      ],
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    );
  }
}

class _IncomeSection extends StatelessWidget {
  const _IncomeSection({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Income sources',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: cs.onSurface),
        ),
        const SizedBox(height: 4),
        Text(
          'Last updated ${_ledgerFmtDate(model.incomeLastUpdated)}',
          style: TextStyle(
            fontSize: 12,
            color: cs.outline,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        if (model.incomeLines.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'No lines yet — add one per source (salary, bonus, rent, …). You can add as many as you need.',
              style: TextStyle(
                fontSize: 13,
                color: cs.onSurfaceVariant,
                height: 1.35,
              ),
            ),
          ),
        ...model.incomeLines.asMap().entries.map((e) {
          final i = e.key;
          final line = e.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: ValueKey('inc-label-${line.id}'),
                        initialValue: line.label,
                        onChanged: (v) {
                          line.label = v;
                          model.notifyIncomeChanged();
                        },
                        decoration: const InputDecoration(
                          labelText: 'Name',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () => model.removeIncomeLineAt(i),
                      icon: const Icon(Icons.remove_circle_outline),
                      tooltip: 'Remove',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: _GroupedIntField(
                        key: ValueKey('inc-amt-${line.id}'),
                        initialInt: line.annualAmount == 0
                            ? null
                            : line.annualAmount.round(),
                        currency: currencyCodeForIncomeLineCurrency(
                          line.currencyCountry,
                        ),
                        labelText: 'Annual amount',
                        onChanged: (v) {
                          line.annualAmount = (v ?? 0).toDouble();
                          model.notifyIncomeChanged();
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _IncomeLineCurrencyField(
                        key: ValueKey('inc-ccy-${line.id}'),
                        value: currencyCodeForIncomeLineCurrency(
                          line.currencyCountry,
                        ),
                        onChanged: (v) {
                          line.currencyCountry = v.code;
                          model.notifyIncomeChanged();
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => model.addIncomeLine(),
            child: const Text('Add income source'),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: model.effectiveTaxRatePct?.toStringAsFixed(0) ?? '',
          keyboardType: TextInputType.number,
          onChanged: (raw) =>
              model.setEffectiveTaxRatePct(double.tryParse(raw)),
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

class _ExpensesSection extends StatelessWidget {
  const _ExpensesSection({
    super.key,
    required this.model,
    required this.onMonthEntryTap,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final void Function(String monthKey) onMonthEntryTap;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final preset = presetForCountry(AppModel.expensePresetCountry);
    final predicted = model.totalExpensesMonthly;
    final segments = expenseDonutSegmentsFromPreset(
      preset,
      model.expenseBuckets,
    );
    final privacy = model.privacyHideAmounts;
    final dataMonths = model.monthKeysWithCashflowData();
    final monthKeysForTable = privacy ? null : dataMonths;
    final centerTitle = privacy
        ? maskSensitiveNumberString(
            formatGroupedInteger(
              predicted.round(),
              currency: model.displayCurrency,
            ),
          )
        : formatGroupedInteger(
            predicted.round(),
            currency: model.displayCurrency,
          );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: ExpenseDonutChart(
              segments: segments,
              centerTitle: centerTitle,
              centerSubtitle: 'est. / month',
              size: 220,
              strokeWidth: 38,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 12,
          runSpacing: 8,
          children: [
            for (final s in segments)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: s.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    s.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Text(
                _ledgerFmtDate(model.expenseEstimatesLastUpdated),
                style: TextStyle(
                  fontSize: 12,
                  color: cs.outline,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton.icon(
              onPressed: privacy
                  ? onPrivacyInteractionDenied
                  : () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          fullscreenDialog: true,
                          builder: (ctx) =>
                              ExpenseEstimatesEditorPage(model: model),
                        ),
                      );
                    },
              icon: Icon(
                Icons.tune,
                size: 18,
                color: privacy ? cs.outline : null,
              ),
              label: Text(
                'Edit estimates',
                style: TextStyle(color: privacy ? cs.outline : null),
              ),
            ),
          ],
        ),
        if (monthKeysForTable != null) ...[
          const SizedBox(height: 20),
          const Text(
            'Month by month',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
          ),
          const SizedBox(height: 12),
          if (monthKeysForTable.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'No months saved yet. Tap + to add any month (YYYY-MM or calendar).',
                style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: cs.outlineVariant),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const _MonthTableHeader(),
                  for (var i = 0; i < monthKeysForTable.length; i++)
                    _MonthTotalRow(
                      model: model,
                      monthKey: monthKeysForTable[i],
                      predicted: predicted,
                      showDivider: i < monthKeysForTable.length - 1,
                      onMonthEntryTap: onMonthEntryTap,
                      onPrivacyInteractionDenied: onPrivacyInteractionDenied,
                      privacyHideAmounts: privacy,
                    ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

class _MonthTableHeader extends StatelessWidget {
  const _MonthTableHeader();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          cs.primary.withValues(alpha: 0.07),
          cs.surfaceContainerHigh,
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
        border: Border(
          bottom: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.85)),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              'Month',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: cs.onSurface),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Predicted',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Actual',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Δ',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MonthTotalRow extends StatelessWidget {
  const _MonthTotalRow({
    required this.model,
    required this.monthKey,
    required this.predicted,
    required this.showDivider,
    required this.onMonthEntryTap,
    required this.onPrivacyInteractionDenied,
    required this.privacyHideAmounts,
  });

  final AppModel model;
  final String monthKey;
  final double predicted;
  final bool showDivider;
  final void Function(String monthKey) onMonthEntryTap;
  final VoidCallback onPrivacyInteractionDenied;
  final bool privacyHideAmounts;

  String _homeAmt(double v) =>
      formatGroupedInteger(v.round(), currency: model.displayCurrency);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final lineActual = model.actualSpendForMonth(monthKey);
    final hasRowData = lineActual > 0;
    final actual = lineActual;
    final delta = actual - predicted;
    final inBand =
        hasRowData &&
        predicted > 0 &&
        (delta.abs() / predicted) <= AppModel.spendVarianceBandPct;
    final predictedTxt = privacyHideAmounts
        ? maskSensitiveNumberString(_homeAmt(predicted))
        : _homeAmt(predicted);
    final actualTxt = !hasRowData
        ? '—'
        : (privacyHideAmounts
              ? maskSensitiveNumberString(_homeAmt(actual))
              : _homeAmt(actual));
    final deltaTxt = !hasRowData
        ? '—'
        : (privacyHideAmounts
              ? maskSensitiveNumberString(_homeAmt(delta))
              : _homeAmt(delta));
    final child = Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: showDivider ? cs.outlineVariant : Colors.transparent,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              AppModel.formatMonthKeyLabel(monthKey),
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: cs.onSurface),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              predictedTxt,
              textAlign: TextAlign.end,
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              actualTxt,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 12,
                color: AppModel.spendVsPredictedColor(
                  actual: actual,
                  predicted: predicted,
                  hasData: hasRowData,
                ),
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              deltaTxt,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: !hasRowData
                    ? AppModel.spendNoDataColor
                    : inBand
                    ? AppModel.spendInBandColor
                    : (delta > 0
                          ? AppModel.spendOverColor
                          : AppModel.spendUnderColor),
              ),
            ),
          ),
        ],
      ),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (privacyHideAmounts) {
            onPrivacyInteractionDenied();
            return;
          }
          onMonthEntryTap(monthKey);
        },
        child: child,
      ),
    );
  }
}

bool _monthInvestmentNeedsAction(AppModel model, String monthKey) {
  final e = model.monthlyEntryFor(monthKey);
  if (e == null || e.outflowToInvested <= 0.005) return false;
  return !monthlyInvestmentLinkingComplete(e);
}

bool _monthSavingsNeedsAction(AppModel model, String monthKey) {
  final e = model.monthlyEntryFor(monthKey);
  if (e == null || e.outflowToCashFd <= 0.005) return false;
  return !monthlySavingsLinkingComplete(e);
}

Future<void> _showMonthInvestmentLinkSheet(
  BuildContext context,
  AppModel model,
  String monthKey,
) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SafeArea(
        child: _MonthInvestmentLinkSheet(
          model: model,
          monthKey: monthKey,
        ),
      ),
    ),
  );
}

Future<void> _showMonthSavingsLinkSheet(
  BuildContext context,
  AppModel model,
  String monthKey,
) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: SafeArea(
        child: _MonthSavingsLinkSheet(
          model: model,
          monthKey: monthKey,
        ),
      ),
    ),
  );
}

class _MonthInvestmentLinkSheet extends StatefulWidget {
  const _MonthInvestmentLinkSheet({
    required this.model,
    required this.monthKey,
  });

  final AppModel model;
  final String monthKey;

  @override
  State<_MonthInvestmentLinkSheet> createState() =>
      _MonthInvestmentLinkSheetState();
}

class _MonthInvestmentLinkSheetState extends State<_MonthInvestmentLinkSheet> {
  late List<MonthlyInvestmentLine> _lines;
  final Map<String, TextEditingController> _amountCtrls = {};

  double get _target =>
      widget.model.monthlyEntryFor(widget.monthKey)?.outflowToInvested ?? 0;

  @override
  void initState() {
    super.initState();
    final e = widget.model.monthlyEntryFor(widget.monthKey)!;
    _lines = [for (final l in e.investmentLines) l.clone()];
    if (_lines.isEmpty && e.outflowToInvested > 0.005) {
      _lines.add(MonthlyInvestmentLine.blank()..amount = e.outflowToInvested);
    }
    for (final l in _lines) {
      _amountCtrls[l.id] = TextEditingController(
        text: l.amount <= 0.005
            ? ''
            : formatGroupedInteger(
                l.amount.round(),
                currency: widget.model.displayCurrency,
              ),
      );
    }
  }

  @override
  void dispose() {
    for (final c in _amountCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(MonthlyInvestmentLine line) {
    return _amountCtrls.putIfAbsent(
      line.id,
      () => TextEditingController(
        text: line.amount <= 0.005
            ? ''
            : formatGroupedInteger(
                line.amount.round(),
                currency: widget.model.displayCurrency,
              ),
      ),
    );
  }

  void _syncAmountsFromFields() {
    for (final l in _lines) {
      final c = _amountCtrls[l.id];
      if (c != null) {
        l.amount = _ledgerParseGroupedDouble(c.text);
      }
    }
  }

  void _addSplit() {
    setState(() {
      final n = MonthlyInvestmentLine.blank();
      _lines.add(n);
      _amountCtrls[n.id] = TextEditingController();
    });
  }

  void _removeAt(int i) {
    final line = _lines[i];
    setState(() {
      _lines.removeAt(i);
      final c = _amountCtrls.remove(line.id);
      c?.dispose();
    });
  }

  void _save(BuildContext context) {
    _syncAmountsFromFields();
    final m = widget.model;
    final target = _target;
    if (target <= 0.005) {
      Navigator.of(context).pop();
      return;
    }
    final filtered = <MonthlyInvestmentLine>[];
    for (final l in _lines) {
      if (l.amount > 0.005) {
        filtered.add(l);
      }
    }
    if (filtered.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one amount.')),
      );
      return;
    }
    final sum = sumMonthlyInvestmentAmounts(filtered);
    if ((sum - target).abs() > 0.51) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Allocated total must match invested (${formatGroupedInteger(target.round(), currency: m.displayCurrency)}).',
          ),
        ),
      );
      return;
    }
    for (final l in filtered) {
      if ((l.assetId ?? '').isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose an asset for each line.')),
        );
        return;
      }
    }
    final complete =
        m.commitMonthInvestmentLinking(widget.monthKey, filtered);
    if (!context.mounted) return;
    Navigator.of(context).pop();
    if (complete) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Asset value updated, import to update context'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final dc = m.displayCurrency;
    final cs = Theme.of(context).colorScheme;
    const edge = EdgeInsets.fromLTRB(20, 8, 20, 24);
    return ListenableBuilder(
      listenable: m,
      builder: (ctx, _) {
        _syncAmountsFromFields();
        final target = _target;
        final sum = sumMonthlyInvestmentAmounts(_lines);
        final match = target > 0.005 && (sum - target).abs() <= 0.51;
        final targetTxt = formatGroupedInteger(target.round(), currency: dc);
        final sumTxt = formatGroupedInteger(sum.round(), currency: dc);
        return SingleChildScrollView(
          padding: edge,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppModel.formatMonthKeyLabel(widget.monthKey),
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Invested this month: $targetTxt',
                style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Allocated: $sumTxt',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: match ? Colors.green.shade700 : cs.onSurface,
                      ),
                    ),
                  ),
                  if (match)
                    Icon(Icons.check_circle, color: Colors.green.shade600, size: 22),
                ],
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < _lines.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _MonthInvestmentSplitRow(
                    model: m,
                    line: _lines[i],
                    amountController: _controllerFor(_lines[i]),
                    canRemove: _lines.length > 1,
                    onRemove: () => _removeAt(i),
                    onAmountChanged: () => setState(() {}),
                    onAssetChanged: (id) =>
                        setState(() => _lines[i].assetId = id),
                  ),
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _addSplit,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add split'),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => _save(context),
                child: const Text('Save'),
              ),
            ],
          ),
        );
      },
    );
  }
}

String? _savingsLineLinkKey(MonthlySavingsLine line) {
  if ((line.assetId ?? '').isNotEmpty) return 'a:${line.assetId}';
  if ((line.liabilityId ?? '').isNotEmpty) return 'l:${line.liabilityId}';
  return null;
}

void _applySavingsLineLinkKey(MonthlySavingsLine line, String? key) {
  line.assetId = null;
  line.liabilityId = null;
  if (key == null || key.isEmpty) return;
  if (key.startsWith('a:')) {
    line.assetId = key.substring(2);
  } else if (key.startsWith('l:')) {
    line.liabilityId = key.substring(2);
  }
}

class _MonthSavingsLinkSheet extends StatefulWidget {
  const _MonthSavingsLinkSheet({
    required this.model,
    required this.monthKey,
  });

  final AppModel model;
  final String monthKey;

  @override
  State<_MonthSavingsLinkSheet> createState() => _MonthSavingsLinkSheetState();
}

class _MonthSavingsLinkSheetState extends State<_MonthSavingsLinkSheet> {
  late List<MonthlySavingsLine> _lines;
  final Map<String, TextEditingController> _amountCtrls = {};

  double get _target =>
      widget.model.monthlyEntryFor(widget.monthKey)?.outflowToCashFd ?? 0;

  @override
  void initState() {
    super.initState();
    final e = widget.model.monthlyEntryFor(widget.monthKey)!;
    _lines = [for (final l in e.savingsLines) l.clone()];
    if (_lines.isEmpty && e.outflowToCashFd > 0.005) {
      _lines.add(MonthlySavingsLine.blank()..amount = e.outflowToCashFd);
    }
    for (final l in _lines) {
      _amountCtrls[l.id] = TextEditingController(
        text: l.amount <= 0.005
            ? ''
            : formatGroupedInteger(
                l.amount.round(),
                currency: widget.model.displayCurrency,
              ),
      );
    }
  }

  @override
  void dispose() {
    for (final c in _amountCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(MonthlySavingsLine line) {
    return _amountCtrls.putIfAbsent(
      line.id,
      () => TextEditingController(
        text: line.amount <= 0.005
            ? ''
            : formatGroupedInteger(
                line.amount.round(),
                currency: widget.model.displayCurrency,
              ),
      ),
    );
  }

  void _syncAmountsFromFields() {
    for (final l in _lines) {
      final c = _amountCtrls[l.id];
      if (c != null) {
        l.amount = _ledgerParseGroupedDouble(c.text);
      }
    }
  }

  void _addSplit() {
    setState(() {
      final n = MonthlySavingsLine.blank();
      _lines.add(n);
      _amountCtrls[n.id] = TextEditingController();
    });
  }

  void _removeAt(int i) {
    final line = _lines[i];
    setState(() {
      _lines.removeAt(i);
      final c = _amountCtrls.remove(line.id);
      c?.dispose();
    });
  }

  void _save(BuildContext context) {
    _syncAmountsFromFields();
    final m = widget.model;
    final target = _target;
    if (target <= 0.005) {
      Navigator.of(context).pop();
      return;
    }
    final filtered = <MonthlySavingsLine>[];
    for (final l in _lines) {
      if (l.amount > 0.005) filtered.add(l);
    }
    if (filtered.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one amount.')),
      );
      return;
    }
    final sum = sumMonthlySavingsAmounts(filtered);
    if ((sum - target).abs() > 0.51) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Allocated total must match saved (${formatGroupedInteger(target.round(), currency: m.displayCurrency)}).',
          ),
        ),
      );
      return;
    }
    for (final l in filtered) {
      final hasAsset = (l.assetId ?? '').isNotEmpty;
      final hasLiab = (l.liabilityId ?? '').isNotEmpty;
      if (!hasAsset && !hasLiab) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose an asset or loan for each line.')),
        );
        return;
      }
      if (hasAsset && hasLiab) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Pick only one target per line.')),
        );
        return;
      }
    }
    final complete = m.commitMonthSavingsLinking(widget.monthKey, filtered);
    if (!context.mounted) return;
    Navigator.of(context).pop();
    if (complete) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Balances updated from savings link'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final dc = m.displayCurrency;
    final cs = Theme.of(context).colorScheme;
    const edge = EdgeInsets.fromLTRB(20, 8, 20, 24);
    final savAssets =
        savingsPoolAssets(m.assets, m.assetsGoalsPolicy).toList();
    return ListenableBuilder(
      listenable: m,
      builder: (ctx, _) {
        _syncAmountsFromFields();
        final target = _target;
        final sum = sumMonthlySavingsAmounts(_lines);
        final match = target > 0.005 && (sum - target).abs() <= 0.51;
        final targetTxt = formatGroupedInteger(target.round(), currency: dc);
        final sumTxt = formatGroupedInteger(sum.round(), currency: dc);
        return SingleChildScrollView(
          padding: edge,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppModel.formatMonthKeyLabel(widget.monthKey),
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: cs.onSurface,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Saved this month: $targetTxt',
                style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Allocated: $sumTxt',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        color: match ? Colors.green.shade700 : cs.onSurface,
                      ),
                    ),
                  ),
                  if (match)
                    Icon(Icons.check_circle, color: Colors.green.shade600, size: 22),
                ],
              ),
              const SizedBox(height: 14),
              for (var i = 0; i < _lines.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _MonthSavingsSplitRow(
                    model: m,
                    line: _lines[i],
                    savingsAssets: savAssets,
                    amountController: _controllerFor(_lines[i]),
                    canRemove: _lines.length > 1,
                    onRemove: () => _removeAt(i),
                    onAmountChanged: () => setState(() {}),
                    onLinkChanged: (key) => setState(() {
                      _applySavingsLineLinkKey(_lines[i], key);
                    }),
                  ),
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _addSplit,
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add split'),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => _save(context),
                child: const Text('Save'),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _MonthSavingsSplitRow extends StatelessWidget {
  const _MonthSavingsSplitRow({
    required this.model,
    required this.line,
    required this.savingsAssets,
    required this.amountController,
    required this.canRemove,
    required this.onRemove,
    required this.onAmountChanged,
    required this.onLinkChanged,
  });

  final AppModel model;
  final MonthlySavingsLine line;
  final List<LedgerAssetRow> savingsAssets;
  final TextEditingController amountController;
  final bool canRemove;
  final VoidCallback onRemove;
  final VoidCallback onAmountChanged;
  final ValueChanged<String?> onLinkChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dc = model.displayCurrency;
    final linkKey = _savingsLineLinkKey(line);
    final linkItems = <DropdownMenuItem<String?>>[
      const DropdownMenuItem<String?>(
        value: null,
        child: Text('Choose target'),
      ),
      for (final a in savingsAssets)
        DropdownMenuItem<String?>(
          value: 'a:${a.id}',
          child: Text(
            a.name.trim().isEmpty ? a.type.label : a.name.trim(),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      for (final l in model.liabilities)
        DropdownMenuItem<String?>(
          value: 'l:${l.id}',
          child: Text(
            l.name.trim().isEmpty ? l.type.label : l.name.trim(),
            overflow: TextOverflow.ellipsis,
          ),
        ),
    ];
    final validKeys = linkItems.map((e) => e.value).whereType<String>().toSet();
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: cs.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(currency: dc),
                    ],
                    decoration: InputDecoration(
                      labelText: 'Amount',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      prefixText: dc == CurrencyCode.aed ? null : dc.symbol,
                    ),
                    onChanged: (_) => onAmountChanged(),
                  ),
                ),
                if (canRemove)
                  IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.remove_circle_outline),
                    tooltip: 'Remove',
                  ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String?>(
              key: ValueKey('sav-lnk-${line.id}-$linkKey'),
              initialValue: linkKey != null && validKeys.contains(linkKey) ? linkKey : null,
              decoration: const InputDecoration(
                labelText: 'Link to asset or loan',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: linkItems,
              onChanged: onLinkChanged,
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthInvestmentSplitRow extends StatelessWidget {
  const _MonthInvestmentSplitRow({
    required this.model,
    required this.line,
    required this.amountController,
    required this.canRemove,
    required this.onRemove,
    required this.onAmountChanged,
    required this.onAssetChanged,
  });

  final AppModel model;
  final MonthlyInvestmentLine line;
  final TextEditingController amountController;
  final bool canRemove;
  final VoidCallback onRemove;
  final VoidCallback onAmountChanged;
  final ValueChanged<String?> onAssetChanged;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dc = model.displayCurrency;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: cs.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      GroupedIntegerTextInputFormatter(currency: dc),
                    ],
                    decoration: InputDecoration(
                      labelText: 'Amount',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      prefixText: dc == CurrencyCode.aed ? null : dc.symbol,
                    ),
                    onChanged: (_) => onAmountChanged(),
                  ),
                ),
                if (canRemove)
                  IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.remove_circle_outline),
                    tooltip: 'Remove',
                  ),
              ],
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String?>(
              key: ValueKey('lnk-${line.id}-${line.assetId}-${model.assets.length}'),
              initialValue: line.assetId != null &&
                      model.assetById(line.assetId!) != null
                  ? line.assetId
                  : null,
              decoration: const InputDecoration(
                labelText: 'Link to asset',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              items: [
                const DropdownMenuItem<String?>(
                  value: null,
                  child: Text('Choose asset'),
                ),
                for (final a in model.assets)
                  DropdownMenuItem<String?>(
                    value: a.id,
                    child: Text(
                      a.name.trim().isEmpty ? a.type.label : a.name.trim(),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: onAssetChanged,
            ),
          ],
        ),
      ),
    );
  }
}

class _CashPrimaryCashBar extends StatefulWidget {
  const _CashPrimaryCashBar({required this.model});

  final AppModel model;

  @override
  State<_CashPrimaryCashBar> createState() => _CashPrimaryCashBarState();
}

class _CashPrimaryCashBarState extends State<_CashPrimaryCashBar> {
  late final TextEditingController _createNameCtrl;
  bool _editingName = false;
  TextEditingController? _editNameCtrl;

  @override
  void initState() {
    super.initState();
    _createNameCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _createNameCtrl.dispose();
    _editNameCtrl?.dispose();
    super.dispose();
  }

  void _commitCreate() {
    final name = _createNameCtrl.text.trim();
    if (name.isEmpty) return;
    final row = LedgerAssetRow.blank(
      defaultCurrencyCountry: widget.model.defaultLedgerCurrencyCountry,
    );
    row.type = LedgerAssetType.savings;
    row.name = name;
    row.total = 0;
    widget.model.registerPrimaryCashAsset(row);
    _createNameCtrl.clear();
  }

  void _startRename(LedgerAssetRow asset) {
    _editNameCtrl?.dispose();
    _editNameCtrl = TextEditingController(text: asset.name);
    setState(() => _editingName = true);
  }

  void _commitRename(LedgerAssetRow asset) {
    final raw = _editNameCtrl?.text.trim() ?? '';
    asset.name = raw.isEmpty ? asset.type.label : raw;
    _editNameCtrl?.dispose();
    _editNameCtrl = null;
    setState(() => _editingName = false);
    widget.model.touchAssetsChanged();
  }

  void _cancelRename() {
    _editNameCtrl?.dispose();
    _editNameCtrl = null;
    setState(() => _editingName = false);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListenableBuilder(
      listenable: widget.model,
      builder: (ctx, _) {
        final m = widget.model;
        final iid = m.primaryIncomeAssetId;
        final asset = iid == null ? null : m.assetById(iid);
        final linked = asset != null;

        if (!linked) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _createNameCtrl,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      hintText: 'Cash account',
                      isDense: true,
                      border: OutlineInputBorder(
                        borderSide: BorderSide(color: cs.outlineVariant),
                      ),
                    ),
                    onSubmitted: (_) => _commitCreate(),
                  ),
                ),
                IconButton(
                  tooltip: 'Save',
                  onPressed: _commitCreate,
                  icon: Icon(Icons.check, color: cs.primary),
                ),
              ],
            ),
          );
        }

        final label =
            asset.name.trim().isEmpty ? asset.type.label : asset.name.trim();

        if (_editingName && _editNameCtrl != null) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _editNameCtrl,
                    autofocus: true,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(
                        borderSide: BorderSide(color: cs.outlineVariant),
                      ),
                    ),
                    onSubmitted: (_) => _commitRename(asset),
                  ),
                ),
                IconButton(
                  tooltip: 'Save',
                  onPressed: () => _commitRename(asset),
                  icon: Icon(Icons.check, color: cs.primary),
                ),
                IconButton(
                  tooltip: 'Cancel',
                  onPressed: _cancelRename,
                  icon: Icon(Icons.close, color: cs.onSurfaceVariant),
                ),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Material(
            color: cs.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsetsDirectional.only(start: 4, end: 0, top: 4, bottom: 4),
              child: Row(
                children: [
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 8),
                    child: Icon(
                      Icons.account_balance_wallet_outlined,
                      size: 20,
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: cs.onSurface,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Edit name',
                    icon: Icon(Icons.edit_outlined, size: 20, color: cs.onSurfaceVariant),
                    onPressed: () => _startRename(asset),
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

class _CashTabSection extends StatelessWidget {
  const _CashTabSection({
    super.key,
    required this.model,
    required this.onMonthEntryTap,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final void Function(String monthKey) onMonthEntryTap;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final privacy = model.privacyHideAmounts;
    final monthKeysForTable = model.monthKeysWithCashflowData();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CashPrimaryCashBar(model: model),
        if (monthKeysForTable.isEmpty)
          const SizedBox(height: 4)
        else
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              border: Border.all(color: cs.outlineVariant),
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _MonthlyCashflowSplitTableHeader(),
                for (var i = 0; i < monthKeysForTable.length; i++)
                  _MonthlyCashflowSplitTableRow(
                    model: model,
                    monthKey: monthKeysForTable[i],
                    showDivider: i < monthKeysForTable.length - 1,
                    privacyHideAmounts: privacy,
                    onPrivacyInteractionDenied: onPrivacyInteractionDenied,
                    onTap: () => onMonthEntryTap(monthKeysForTable[i]),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        _MonthSavingsSection(
          model: model,
          onPrivacyInteractionDenied: onPrivacyInteractionDenied,
        ),
        _MonthInvestmentsSection(
          model: model,
          onPrivacyInteractionDenied: onPrivacyInteractionDenied,
        ),
      ],
    );
  }
}

class _MonthSavingsSection extends StatelessWidget {
  const _MonthSavingsSection({
    required this.model,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final months = model.monthKeysWithCashflowData();
    final savingsMonths = <String>[];
    for (final mk in months) {
      final e = model.monthlyEntryFor(mk);
      if (e != null && e.outflowToCashFd > 0.005) {
        savingsMonths.add(mk);
      }
    }
    if (savingsMonths.isEmpty) return const SizedBox.shrink();

    final needsAttention =
        savingsMonths.any((mk) => _monthSavingsNeedsAction(model, mk));

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        initiallyExpanded: needsAttention,
        title: Text(
          'Savings',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 14,
            color: cs.onSurface,
          ),
        ),
        subtitle: Text(
          needsAttention ? 'Link to assets or loans' : 'Linked by month',
          style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
        ),
        children: [
          for (final mk in savingsMonths)
            _MonthSavingsMonthTile(
              model: model,
              monthKey: mk,
              onPrivacyInteractionDenied: onPrivacyInteractionDenied,
            ),
        ],
      ),
    );
  }
}

class _MonthSavingsMonthTile extends StatelessWidget {
  const _MonthSavingsMonthTile({
    required this.model,
    required this.monthKey,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final String monthKey;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final e = model.monthlyEntryFor(monthKey);
    if (e == null) return const SizedBox.shrink();
    final privacy = model.privacyHideAmounts;
    final dc = model.displayCurrency;
    final saved = e.outflowToCashFd;
    final complete = monthlySavingsLinkingComplete(e);
    final needs = _monthSavingsNeedsAction(model, monthKey);
    final savedTxt = privacy
        ? maskSensitiveNumberString(
            formatGroupedInteger(saved.round(), currency: dc),
          )
        : formatGroupedInteger(saved.round(), currency: dc);
    final Widget leading = complete
        ? Icon(Icons.check_circle, color: Colors.green.shade600, size: 22)
        : Icon(
            Icons.flag_outlined,
            color: needs ? Colors.orange.shade800 : cs.onSurfaceVariant,
            size: 22,
          );
    return ListTile(
      dense: true,
      leading: leading,
      title: Text(
        AppModel.formatMonthKeyLabel(monthKey),
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
          color: cs.onSurface,
        ),
      ),
      subtitle: Text(
        savedTxt,
        style: TextStyle(
          fontSize: 12,
          color: cs.onSurfaceVariant,
          height: 1.3,
        ),
      ),
      onTap: privacy
          ? onPrivacyInteractionDenied
          : () => _showMonthSavingsLinkSheet(context, model, monthKey),
    );
  }
}

class _MonthInvestmentsSection extends StatelessWidget {
  const _MonthInvestmentsSection({
    required this.model,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final months = model.monthKeysWithCashflowData();
    final investMonths = <String>[];
    for (final mk in months) {
      final e = model.monthlyEntryFor(mk);
      if (e != null && e.outflowToInvested > 0.005) {
        investMonths.add(mk);
      }
    }
    if (investMonths.isEmpty) {
      return const SizedBox.shrink();
    }
    final needsAttention =
        investMonths.any((mk) => _monthInvestmentNeedsAction(model, mk));
    return ExpansionTile(
      initiallyExpanded: needsAttention,
      title: Text(
        'Invest',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 14,
          color: cs.onSurface,
        ),
      ),
      subtitle: Text(
        needsAttention ? 'Link to assets' : 'Linked by month',
        style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
      ),
      children: [
        for (final mk in investMonths)
          _MonthInvestmentMonthTile(
            model: model,
            monthKey: mk,
            onPrivacyInteractionDenied: onPrivacyInteractionDenied,
          ),
      ],
    );
  }
}

class _MonthInvestmentMonthTile extends StatelessWidget {
  const _MonthInvestmentMonthTile({
    required this.model,
    required this.monthKey,
    required this.onPrivacyInteractionDenied,
  });

  final AppModel model;
  final String monthKey;
  final VoidCallback onPrivacyInteractionDenied;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final e = model.monthlyEntryFor(monthKey);
    if (e == null) return const SizedBox.shrink();
    final privacy = model.privacyHideAmounts;
    final dc = model.displayCurrency;
    final inv = e.outflowToInvested;
    final complete = monthlyInvestmentLinkingComplete(e);
    final needs = _monthInvestmentNeedsAction(model, monthKey);
    final invTxt = privacy
        ? maskSensitiveNumberString(
            formatGroupedInteger(inv.round(), currency: dc),
          )
        : formatGroupedInteger(inv.round(), currency: dc);
    final Widget leading = complete
        ? Icon(Icons.check_circle, color: Colors.green.shade600, size: 22)
        : Icon(
            Icons.flag_outlined,
            color: needs ? Colors.orange.shade800 : cs.onSurfaceVariant,
            size: 22,
          );
    return ListTile(
      dense: true,
      leading: leading,
      title: Text(
        AppModel.formatMonthKeyLabel(monthKey),
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
          color: cs.onSurface,
        ),
      ),
      subtitle: Text(
        invTxt,
        style: TextStyle(
          fontSize: 12,
          color: cs.onSurfaceVariant,
          height: 1.3,
        ),
      ),
      onTap: privacy
          ? onPrivacyInteractionDenied
          : () => _showMonthInvestmentLinkSheet(context, model, monthKey),
    );
  }
}

class _MonthlyCashflowSplitTableHeader extends StatelessWidget {
  const _MonthlyCashflowSplitTableHeader();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          cs.primary.withValues(alpha: 0.07),
          cs.surfaceContainerHigh,
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
        border: Border(
          bottom: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.85)),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(
              'Month',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: cs.onSurface),
            ),
          ),
          Expanded(
            child: Text(
              'Earned',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 11,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              'Saved',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 11,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              'Invested',
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 11,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MonthlyCashflowSplitTableRow extends StatelessWidget {
  const _MonthlyCashflowSplitTableRow({
    required this.model,
    required this.monthKey,
    required this.showDivider,
    required this.privacyHideAmounts,
    required this.onPrivacyInteractionDenied,
    required this.onTap,
  });

  final AppModel model;
  final String monthKey;
  final bool showDivider;
  final bool privacyHideAmounts;
  final VoidCallback onPrivacyInteractionDenied;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final e = model.monthlyEntryFor(monthKey);
    final dc = model.displayCurrency;

    final earnedTxt = e == null
        ? '—'
        : e.monthlyEarned > 0
        ? (privacyHideAmounts
              ? maskSensitiveNumberString(
                  formatGroupedInteger(e.monthlyEarned.round(), currency: dc),
                )
              : formatGroupedInteger(e.monthlyEarned.round(), currency: dc))
        : '—';

    final savedTxt = e == null || e.outflowToCashFd <= 0
        ? '—'
        : (privacyHideAmounts
              ? maskSensitiveNumberString(
                  formatGroupedInteger(e.outflowToCashFd.round(), currency: dc),
                )
              : formatGroupedInteger(e.outflowToCashFd.round(), currency: dc));

    final investedTxt = e == null || e.outflowToInvested <= 0
        ? '—'
        : (privacyHideAmounts
              ? maskSensitiveNumberString(
                  formatGroupedInteger(
                    e.outflowToInvested.round(),
                    currency: dc,
                  ),
                )
              : formatGroupedInteger(
                  e.outflowToInvested.round(),
                  currency: dc,
                ));

    final delta = e == null ? null : e.closingBalance - e.openingBalance;
    final deltaTxt = delta == null || delta.abs() <= 0.5
        ? null
        : (privacyHideAmounts
              ? maskSensitiveNumberString(
                  formatGroupedInteger(delta.round(), currency: dc),
                )
              : formatGroupedInteger(delta.round(), currency: dc));

    final child = Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: showDivider ? cs.outlineVariant : Colors.transparent,
          ),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(
              AppModel.formatMonthKeyLabel(monthKey),
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: cs.onSurface),
            ),
          ),
          Expanded(
            child: Text(
              earnedTxt,
              textAlign: TextAlign.end,
              style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  savedTxt,
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                if (deltaTxt != null && delta != null)
                  Text(
                    '${delta > 0 ? '+' : ''}$deltaTxt',
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: delta >= 0 ? const Color(0xFF10B981) : cs.error,
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Text(
              investedTxt,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: cs.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (privacyHideAmounts) {
            onPrivacyInteractionDenied();
            return;
          }
          onTap();
        },
        child: child,
      ),
    );
  }
}

class _GroupedIntField extends StatefulWidget {
  const _GroupedIntField({
    super.key,
    required this.initialInt,
    required this.currency,
    required this.onChanged,
    this.labelText,
  });

  final int? initialInt;
  final CurrencyCode currency;
  final ValueChanged<int?> onChanged;
  final String? labelText;

  @override
  State<_GroupedIntField> createState() => _GroupedIntFieldState();
}

class _GroupedIntFieldState extends State<_GroupedIntField> {
  late final TextEditingController _ctrl;

  String _fmt(int? v) {
    if (v == null) return '';
    return formatGroupedInteger(v, currency: widget.currency);
  }

  int? _parse(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return null;
    return int.tryParse(digits);
  }

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: _fmt(widget.initialInt));
  }

  @override
  void didUpdateWidget(covariant _GroupedIntField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currency != widget.currency ||
        oldWidget.initialInt != widget.initialInt) {
      final next = _fmt(widget.initialInt);
      if (_ctrl.text != next) _ctrl.text = next;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _ctrl,
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      onEditingComplete: () => FocusManager.instance.primaryFocus?.unfocus(),
      onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
      inputFormatters: [
        GroupedIntegerTextInputFormatter(currency: widget.currency),
      ],
      onChanged: (raw) => widget.onChanged(_parse(raw)),
      decoration: InputDecoration(
        labelText: widget.labelText,
        border: const OutlineInputBorder(),
        isDense: true,
        prefixText: widget.currency == CurrencyCode.aed
            ? null
            : widget.currency.symbol,
        prefixIcon: widget.currency == CurrencyCode.aed
            ? const Padding(
                padding: EdgeInsetsDirectional.only(start: 12, end: 8),
                child: DirhamIcon(size: 16),
              )
            : null,
        prefixIconConstraints: widget.currency == CurrencyCode.aed
            ? const BoxConstraints(minWidth: 38)
            : null,
      ),
    );
  }
}

/// Open Ledger liability editor (rate % is edited here, not on Goals).
Future<void> openLedgerLiabilityEditor({
  required BuildContext context,
  required AppModel model,
  required String liabilityId,
}) async {
  final index = model.liabilities.indexWhere((l) => l.id == liabilityId);
  if (index < 0) return;
  final outcome = await showLiquidGlassModalBottomSheet<_RowEditorOutcome<LedgerLiabilityRow>>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => _LiabilityEditorSheet(
      draft: model.liabilities[index].clone(),
      allowCurrencyEdit: false,
      canDelete: true,
      model: model,
      parentContext: context,
    ),
  );
  if (!context.mounted || outcome == null) return;
  if (outcome.delete) {
    model.removeLiabilityAt(index);
    return;
  }
  final row = outcome.row;
  if (row != null) model.replaceLiability(index, row);
}
