import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../shared/theme/app_theme.dart';
import 'expense_donut_chart.dart';
import 'expense_estimates_editor_page.dart';
import 'ledger_orchestrator_page.dart';

enum LedgerMode { assets, liabilities, cashflow }

String _ledgerFmtDate(DateTime? d) {
  if (d == null) return '—';
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${names[d.month - 1]} ${d.day}, ${d.year}';
}

String _allocationShareLabel(double part, double total) {
  if (total <= 0) return '—';
  return '${((part / total) * 100).round()}%';
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

class LedgerTab extends StatefulWidget {
  const LedgerTab({super.key, required this.model, this.focusSection, this.onPrivacyInteractionDenied});

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
  /// 0 = income, 1 = Split, 2 = expenses (default expenses when opening Cashflow).
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
    if (widget.model.privacyHideAmounts && _mode == LedgerMode.cashflow && _cashflowTabIndex == 0) {
      setState(() => _cashflowTabIndex = 2);
    }
  }

  Future<void> _openAssetEditor(BuildContext context, {int? index}) async {
    final m = widget.model;
    final isNew = index == null;
    final draft = switch (index) {
      null => LedgerAssetRow.blank(defaultCurrencyCountry: m.defaultLedgerCurrencyCountry),
      final i => m.assets[i].clone(),
    };
    final outcome = await showModalBottomSheet<_RowEditorOutcome<LedgerAssetRow>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => _AssetEditorSheet(
        draft: draft,
        allowCurrencyEdit: isNew,
        canDelete: !isNew && m.assets.length > 1,
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
      null => LedgerLiabilityRow.blank(defaultCurrencyCountry: m.defaultLedgerCurrencyCountry),
      final i => m.liabilities[i].clone(),
    };
    final outcome = await showModalBottomSheet<_RowEditorOutcome<LedgerLiabilityRow>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) => _LiabilityEditorSheet(
        draft: draft,
        allowCurrencyEdit: isNew,
        canDelete: !isNew,
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

  Future<void> _openMonthlyCashflowSheet(BuildContext context, {String? initialMonthKey}) async {
    final m = widget.model;
    final lockMonth = initialMonthKey != null;
    var month = initialMonthKey ?? AppModel.monthKeyFor(DateTime.now());
    final openingCtrl = TextEditingController();
    final closingCtrl = TextEditingController();
    final cashFdCtrl = TextEditingController();
    final invCtrl = TextEditingController();
    final commentCtrl = TextEditingController();

    double? parseNumOrNull(TextEditingController c) => _ledgerParseGroupedDoubleOrNull(c.text);

    double? calcSpendingOrNull() {
      final opening = parseNumOrNull(openingCtrl) ?? 0;
      final closing = parseNumOrNull(closingCtrl);
      if (closing == null) return null;
      final saved = parseNumOrNull(cashFdCtrl) ?? 0;
      final invested = parseNumOrNull(invCtrl) ?? 0;
      // Spending is what left your balances after saving/investing:
      // closing - opening - saved - invested
      return closing - opening - saved - invested;
    }

    void loadMonth(String mk) {
      final ex = m.monthlyEntryFor(mk);
      if (ex != null) {
        final dc = m.displayCurrency;
        openingCtrl.text = formatGroupedInteger(ex.openingBalance.round(), currency: dc);
        closingCtrl.text = formatGroupedInteger(ex.closingBalance.round(), currency: dc);
        cashFdCtrl.text = formatGroupedInteger(ex.outflowToCashFd.round(), currency: dc);
        invCtrl.text = formatGroupedInteger(ex.outflowToInvested.round(), currency: dc);
        commentCtrl.text = ex.comment;
      } else {
        final prevKey = AppModel.previousMonthKey(mk);
        final prevClose = prevKey == null ? null : m.monthlyEntryFor(prevKey)?.closingBalance;
        final suggestedOpening = prevClose ?? 0;
        openingCtrl.text = formatGroupedInteger(suggestedOpening.round(), currency: m.displayCurrency);
        closingCtrl.clear();
        cashFdCtrl.text = formatGroupedInteger(0, currency: m.displayCurrency);
        invCtrl.text = formatGroupedInteger(0, currency: m.displayCurrency);
        commentCtrl.clear();
      }
    }

    loadMonth(month);

    final entry = await showModalBottomSheet<MonthlyCashflowEntry?>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        final bottom = MediaQuery.of(ctx).viewInsets.bottom;
        const dense = InputDecoration(
          border: OutlineInputBorder(),
          isDense: true,
        );
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + bottom),
          child: StatefulBuilder(
            builder: (ctx, setModal) {
              final hasSaved = m.monthlyEntryFor(month) != null;
              final prevKey = AppModel.previousMonthKey(month);
              final prevClose = prevKey == null ? null : m.monthlyEntryFor(prevKey)?.closingBalance;
              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      hasSaved
                          ? 'Edit ${AppModel.formatMonthKeyLabel(month)}'
                          : 'Monthly cash flow entry',
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 12),
                    if (lockMonth)
                      InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Month',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        child: Text(AppModel.formatMonthKeyLabel(month), style: const TextStyle(fontWeight: FontWeight.w600)),
                      )
                    else
                      DropdownButtonFormField<String>(
                        key: ValueKey(month),
                        initialValue: month,
                        decoration: const InputDecoration(
                          labelText: 'Month',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          for (final mk in AppModel.recentMonthKeys())
                            DropdownMenuItem(value: mk, child: Text(AppModel.formatMonthKeyLabel(mk))),
                        ],
                        onChanged: (v) {
                          if (v == null) return;
                          setModal(() {
                            month = v;
                            loadMonth(v);
                          });
                        },
                      ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: openingCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
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
                            controller: closingCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
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
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: cashFdCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
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
                            controller: invCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              GroupedIntegerTextInputFormatter(currency: m.displayCurrency),
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
                      animation: Listenable.merge([openingCtrl, closingCtrl, cashFdCtrl, invCtrl]),
                      builder: (ctx, _) {
                        final spending = calcSpendingOrNull();
                        final ok = spending == null ? true : spending >= -0.5; // allow tiny negatives from rounding
                        final txt = spending == null
                            ? '—'
                            : _ledgerHomeAmount(m, spending.abs() < 0.005 ? 0.0 : spending);
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: ok ? AppTheme.slate50 : Theme.of(ctx).colorScheme.errorContainer.withValues(alpha: 0.35),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: ok ? AppTheme.slate100 : Theme.of(ctx).colorScheme.error.withValues(alpha: 0.25)),
                          ),
                          child: Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Spending',
                                  style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.slate600),
                                ),
                              ),
                              Text(
                                txt,
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 18,
                                  color: ok ? AppTheme.slate900 : Theme.of(ctx).colorScheme.error,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: commentCtrl,
                      minLines: 3,
                      maxLines: 5,
                      decoration: dense.copyWith(
                        labelText: 'Note',
                        alignLabelWithHint: true,
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        final opening = _ledgerParseGroupedDouble(openingCtrl.text);
                        if (_ledgerDigitsOnly(closingCtrl.text).isEmpty) {
                          showDialog<void>(
                            context: ctx,
                            builder: (dctx) => AlertDialog(
                              title: const Text('Closing balance required'),
                              content: const Text('Enter a closing balance before saving.'),
                              actions: [
                                TextButton(onPressed: () => Navigator.of(dctx).pop(), child: const Text('Edit')),
                              ],
                            ),
                          );
                          return;
                        }
                        final closing = _ledgerParseGroupedDouble(closingCtrl.text);
                        final cf = _ledgerParseGroupedDouble(cashFdCtrl.text);
                        final iv = _ledgerParseGroupedDouble(invCtrl.text);
                        final sp = calcSpendingOrNull() ?? 0;
                        if (prevClose != null && opening.round() != prevClose.round()) {
                          showDialog<void>(
                            context: ctx,
                            builder: (dctx) => AlertDialog(
                              title: const Text('Opening balance mismatch'),
                              content: Text(
                                'This month’s opening balance should equal last month’s closing balance.\n\n'
                                'Last month closing: ${_ledgerHomeAmount(m, prevClose)}\n'
                                'Your opening: ${_ledgerHomeAmount(m, opening)}\n\n'
                                'Please correct it before saving.',
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.of(dctx).pop(), child: const Text('Edit')),
                              ],
                            ),
                          );
                          return;
                        }
                        if (sp < 0) {
                          showDialog<void>(
                            context: ctx,
                            builder: (dctx) => AlertDialog(
                              title: const Text('Spending can’t be negative'),
                              content: Text(
                                'Your inputs imply negative spending (${_ledgerHomeAmount(m, sp)}).\n\n'
                                'Double-check Opening, Closing, Saved, and Invested.',
                              ),
                              actions: [
                                TextButton(onPressed: () => Navigator.of(dctx).pop(), child: const Text('Edit')),
                              ],
                            ),
                          );
                          return;
                        }
                        FocusManager.instance.primaryFocus?.unfocus();
                        Navigator.of(ctx).pop(
                          MonthlyCashflowEntry(
                            monthKey: month,
                            openingBalance: opening,
                            closingBalance: closing,
                            outflowToCashFd: cf,
                            outflowToInvested: iv,
                            monthlySpending: sp,
                            comment: commentCtrl.text.trim(),
                            contextMarkdown: m.monthlyEntryFor(month)?.contextMarkdown,
                          ),
                        );
                      },
                      child: const Text('Save'),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );

    // On some platforms, the bottom sheet route can still be animating out after the Future resolves.
    // Disposing controllers immediately can trip assertions like `_dependents.isEmpty`.
    Future<void>.delayed(const Duration(milliseconds: 350), () {
      openingCtrl.dispose();
      closingCtrl.dispose();
      cashFdCtrl.dispose();
      invCtrl.dispose();
      commentCtrl.dispose();
    });

    if (!context.mounted) return;
    if (entry != null) {
      m.upsertMonthlyCashflow(entry);
    }
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
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
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
                            case LedgerOrchestratorSection.income:
                              _mode = LedgerMode.cashflow;
                              _cashflowTabIndex = 0;
                              break;
                            case LedgerOrchestratorSection.expenses:
                              _mode = LedgerMode.cashflow;
                              _cashflowTabIndex = 2;
                              break;
                            case LedgerOrchestratorSection.allocations:
                              _mode = LedgerMode.cashflow;
                              _cashflowTabIndex = 1;
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
                tooltip: _mode == LedgerMode.assets ? 'Add asset' : 'Add liability',
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
            onMonthEntryTap: (mk) => _openMonthlyCashflowSheet(context, initialMonthKey: mk),
            onPrivacyInteractionDenied: _privacyDenied,
          ),
        ] else if (_mode == LedgerMode.assets) ...[
          ...widget.model.assets.asMap().entries.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _LedgerAssetCard(
                    row: e.value,
                    accent: widget.model.accent,
                    displayCurrency: widget.model.displayCurrency,
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
    if (oldWidget.focusSection != widget.focusSection && widget.focusSection != null) {
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
    if (section == 'assets' || section == 'liabilities' || section == 'cashflow') {
      _scroll.animateTo(0, duration: const Duration(milliseconds: 260), curve: Curves.easeOut);
      return;
    }
    final ctx = switch (section) {
      'income' => _incomeKey.currentContext,
      'expenses' => _expensesKey.currentContext,
      'allocations' => _allocKey.currentContext,
      _ => null,
    };
    if (ctx == null) return;
    Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 260), curve: Curves.easeOut);
  }
}

class _RowEditorOutcome<T> {
  const _RowEditorOutcome({this.row, this.delete = false});

  final T? row;
  final bool delete;
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
    return SegmentedButton<LedgerMode>(
      segments: const [
        ButtonSegment(value: LedgerMode.assets, label: Text('Assets'), icon: Icon(Icons.savings)),
        ButtonSegment(value: LedgerMode.liabilities, label: Text('Liabilities'), icon: Icon(Icons.credit_card)),
        ButtonSegment(value: LedgerMode.cashflow, label: Text('Cashflow'), icon: Icon(Icons.swap_vert)),
      ],
      selected: {value},
      onSelectionChanged: (s) => onChanged(s.first),
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent.withValues(alpha: 0.12);
          return Colors.white;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent;
          return AppTheme.slate600;
        }),
        side: const WidgetStatePropertyAll(BorderSide(color: AppTheme.slate100)),
      ),
    );
  }
}

class _LedgerAssetCard extends StatelessWidget {
  const _LedgerAssetCard({
    required this.row,
    required this.accent,
    required this.displayCurrency,
    required this.privacyHideAmounts,
    required this.onTap,
  });

  final LedgerAssetRow row;
  final Color accent;
  final CurrencyCode displayCurrency;
  final bool privacyHideAmounts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final native = currencyCodeForPresetCountry(row.currencyCountry);
    final displayValue = convertCurrency(value: row.total, from: native, to: displayCurrency);
    final grouped = formatGroupedInteger(displayValue.round(), currency: displayCurrency);
    final amountText =
        privacyHideAmounts ? maskSensitiveNumberString(grouped) : grouped;
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
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (row.comment.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        row.comment.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppTheme.slate500, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                amountText,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppTheme.slate500),
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
    required this.privacyHideAmounts,
    required this.onTap,
  });

  final LedgerLiabilityRow row;
  final Color accent;
  final CurrencyCode displayCurrency;
  final bool privacyHideAmounts;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final native = currencyCodeForPresetCountry(row.currencyCountry);
    final displayValue = convertCurrency(value: row.total, from: native, to: displayCurrency);
    final grouped = formatGroupedInteger(displayValue.round(), currency: displayCurrency);
    final amountText =
        privacyHideAmounts ? maskSensitiveNumberString(grouped) : grouped;
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
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (row.comment.trim().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        row.comment.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: AppTheme.slate500, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                amountText,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppTheme.slate500),
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
    return Card(
      elevation: 0,
      color: AppTheme.slate50,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppTheme.slate100, style: BorderStyle.solid),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
          child: Row(
            children: [
              Icon(Icons.add_circle_outline, color: accent),
              const SizedBox(width: 10),
              Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: accent)),
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
  });

  final LedgerAssetRow draft;
  final bool allowCurrencyEdit;
  final bool canDelete;

  @override
  State<_AssetEditorSheet> createState() => _AssetEditorSheetState();
}

class _AssetEditorSheetState extends State<_AssetEditorSheet> {
  late LedgerAssetRow _row;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _labelCtrl;
  late final TextEditingController _totalCtrl;
  late final TextEditingController _commentCtrl;

  @override
  void initState() {
    super.initState();
    _row = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _row.name);
    _labelCtrl = TextEditingController(text: _row.label);
    _totalCtrl = TextEditingController(
      text: _row.total == 0 ? '' : formatGroupedInteger(_row.total.round(), currency: currencyCodeForPresetCountry(_row.currencyCountry)),
    );
    _commentCtrl = TextEditingController(text: _row.comment);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _labelCtrl.dispose();
    _totalCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _row.name = _nameCtrl.text;
    _row.label = _labelCtrl.text;
    _row.comment = _commentCtrl.text;
    final digits = _totalCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    final t = double.tryParse(digits);
    _row.total = t ?? 0;
    Navigator.of(context).pop(_RowEditorOutcome(row: _row));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.allowCurrencyEdit ? 'New asset' : 'Edit asset',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<LedgerAssetType>(
              initialValue: _row.type,
              decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
              items: [
                for (final t in LedgerAssetType.values)
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
                hintText: 'e.g. Main savings',
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
                    final digits = _totalCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
                    if (digits.isNotEmpty) {
                      _totalCtrl.text = formatGroupedInteger(int.parse(digits), currency: cc);
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
                    Text('${_row.currencyCountry} (${presetForCountry(_row.currencyCountry).currencySymbol})'),
                  ],
                ),
              ),
            if (_row.type == LedgerAssetType.other) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _labelCtrl,
                decoration: const InputDecoration(
                  labelText: 'Label',
                  hintText: 'e.g. Other assets',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _totalCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [
                GroupedIntegerTextInputFormatter(currency: native),
              ],
              decoration: InputDecoration(
                labelText: 'Total',
                prefixText: native.symbol,
                border: const OutlineInputBorder(),
              ),
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
            const SizedBox(height: 16),
            Row(
              children: [
                if (widget.canDelete)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(const _RowEditorOutcome<LedgerAssetRow>(delete: true)),
                    child: const Text('Delete'),
                  ),
                const Spacer(),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(onPressed: _save, child: const Text('Save')),
              ],
            ),
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
  });

  final LedgerLiabilityRow draft;
  final bool allowCurrencyEdit;
  final bool canDelete;

  @override
  State<_LiabilityEditorSheet> createState() => _LiabilityEditorSheetState();
}

class _LiabilityEditorSheetState extends State<_LiabilityEditorSheet> {
  late LedgerLiabilityRow _row;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _totalCtrl;
  late final TextEditingController _commentCtrl;

  @override
  void initState() {
    super.initState();
    _row = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _row.name);
    _totalCtrl = TextEditingController(
      text: _row.total == 0 ? '' : formatGroupedInteger(_row.total.round(), currency: currencyCodeForPresetCountry(_row.currencyCountry)),
    );
    _commentCtrl = TextEditingController(text: _row.comment);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _totalCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _row.name = _nameCtrl.text;
    _row.comment = _commentCtrl.text;
    final digits = _totalCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    final t = double.tryParse(digits);
    _row.total = t ?? 0;
    Navigator.of(context).pop(_RowEditorOutcome(row: _row));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final native = currencyCodeForPresetCountry(_row.currencyCountry);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.allowCurrencyEdit ? 'New liability' : 'Edit liability',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<LedgerLiabilityType>(
              initialValue: _row.type,
              decoration: const InputDecoration(labelText: 'Type', border: OutlineInputBorder()),
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
                    final digits = _totalCtrl.text.replaceAll(RegExp(r'[^0-9]'), '');
                    if (digits.isNotEmpty) {
                      _totalCtrl.text = formatGroupedInteger(int.parse(digits), currency: cc);
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
                    Text('${_row.currencyCountry} (${presetForCountry(_row.currencyCountry).currencySymbol})'),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _totalCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [
                GroupedIntegerTextInputFormatter(currency: native),
              ],
              decoration: InputDecoration(
                labelText: 'Total',
                prefixText: native.symbol,
                border: const OutlineInputBorder(),
              ),
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
            const SizedBox(height: 16),
            Row(
              children: [
                if (widget.canDelete)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(const _RowEditorOutcome<LedgerLiabilityRow>(delete: true)),
                    child: const Text('Delete'),
                  ),
                const Spacer(),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(onPressed: _save, child: const Text('Save')),
              ],
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
              _AllocateTabSection(
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
        const ButtonSegment<int>(value: 1, label: Text('Split'), tooltip: 'Cash vs invest'),
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
        side: const WidgetStatePropertyAll(BorderSide(color: AppTheme.slate100)),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return accent.withValues(alpha: 0.12);
          }
          return Colors.white;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return accent;
          return AppTheme.slate600;
        }),
      ),
    );
  }
}

class _IncomeSection extends StatelessWidget {
  const _IncomeSection({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Income sources', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
        const SizedBox(height: 4),
        Text(
          'Last updated ${_ledgerFmtDate(model.incomeLastUpdated)}',
          style: const TextStyle(fontSize: 12, color: AppTheme.slate500, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
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
                    if (model.incomeLines.length > 1)
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
                        initialInt: line.annualAmount == 0 ? null : line.annualAmount.round(),
                        currency: currencyCodeForPresetCountry(line.currencyCountry),
                        labelText: 'Annual amount',
                        onChanged: (v) {
                          line.annualAmount = (v ?? 0).toDouble();
                          model.notifyIncomeChanged();
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        key: ValueKey('inc-ccy-${line.id}'),
                        initialValue: line.currencyCountry,
                        decoration: const InputDecoration(
                          labelText: 'Currency',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: [
                          for (final c in countryPresets)
                            DropdownMenuItem(value: c.name, child: Text('${c.flag} ${c.currencySymbol}')),
                        ],
                        onChanged: (v) {
                          if (v == null) return;
                          line.currencyCountry = v;
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
          child: TextButton.icon(
            onPressed: () => model.addIncomeLine(),
            icon: const Icon(Icons.add),
            label: const Text('Add income source'),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: model.effectiveTaxRatePct?.toStringAsFixed(0) ?? '',
          keyboardType: TextInputType.number,
          onChanged: (raw) => model.setEffectiveTaxRatePct(double.tryParse(raw)),
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
    final preset = presetForCountry(AppModel.expensePresetCountry);
    final predicted = model.totalExpensesMonthly;
    final segments = expenseDonutSegmentsFromPreset(preset, model.expenseBuckets);
    final privacy = model.privacyHideAmounts;
    final dataMonths = model.monthKeysWithCashflowData();
    final monthKeysForTable =
        privacy ? null : (dataMonths.isEmpty ? AppModel.recentMonthKeys() : dataMonths);
    final centerTitle = privacy
        ? maskSensitiveNumberString(
            formatGroupedInteger(predicted.round(), currency: model.displayCurrency),
          )
        : formatGroupedInteger(predicted.round(), currency: model.displayCurrency);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: ExpenseDonutChart(
            segments: segments,
            centerTitle: centerTitle,
            centerSubtitle: 'est. / month',
            size: 220,
            strokeWidth: 38,
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
                    decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    s.label,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.slate600),
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
                style: const TextStyle(fontSize: 12, color: AppTheme.slate500, fontWeight: FontWeight.w600),
              ),
            ),
            TextButton.icon(
              onPressed: privacy
                  ? onPrivacyInteractionDenied
                  : () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          fullscreenDialog: true,
                          builder: (ctx) => ExpenseEstimatesEditorPage(model: model),
                        ),
                      );
                    },
              icon: Icon(Icons.tune, size: 18, color: privacy ? AppTheme.slate500 : null),
              label: Text('Edit estimates', style: TextStyle(color: privacy ? AppTheme.slate500 : null)),
            ),
          ],
        ),
        if (monthKeysForTable != null) ...[
          const SizedBox(height: 20),
          const Text('Month by month', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.slate100),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: const BoxDecoration(
        color: AppTheme.slate50,
        borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
      ),
      child: Row(
        children: [
          const Expanded(
            flex: 3,
            child: Text('Month', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Predicted',
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppTheme.slate600),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Actual',
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppTheme.slate600),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'Δ',
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppTheme.slate600),
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
    final lineActual = model.actualSpendForMonth(monthKey);
    final hasRowData = lineActual > 0;
    final actual = lineActual;
    final delta = actual - predicted;
    final inBand = hasRowData &&
        predicted > 0 &&
        (delta.abs() / predicted) <= AppModel.spendVarianceBandPct;
    final predictedTxt =
        privacyHideAmounts ? maskSensitiveNumberString(_homeAmt(predicted)) : _homeAmt(predicted);
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
          bottom: BorderSide(color: showDivider ? AppTheme.slate100 : Colors.transparent),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              AppModel.formatMonthKeyLabel(monthKey),
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              predictedTxt,
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 12, color: AppTheme.slate600),
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
                        : (delta > 0 ? AppModel.spendOverColor : AppModel.spendUnderColor),
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

class _AllocateTabSection extends StatelessWidget {
  const _AllocateTabSection({
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
    final privacy = model.privacyHideAmounts;
    final avail = model.availableAfterExpensesMonthly;
    final inv = model.allocInvestmentsMonthly;
    final cash = model.allocSavingsMonthly;
    final recent = model.monthKeysWithCashflowData();
    final monthKeysForTable = recent.isEmpty ? AppModel.recentMonthKeys() : recent;
    final monthsTracked = recent.where((mk) => model.monthlyEntryFor(mk) != null).toList();
    final lastN = monthsTracked.take(3).toList();
    final actualShare = model.actualInvestShareAmongOutflows(lastN);
    final avgs = model.averageAllocationOutflows(lastN);
    final targetPct = (model.allocInvestFraction * 100).round();
    final actualPct = actualShare != null ? (actualShare * 100).round() : null;
    String g(double v) => formatGroupedInteger(v.round(), currency: model.displayCurrency);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Target last updated ${_ledgerFmtDate(model.allocationTargetLastUpdated)}',
          style: const TextStyle(fontSize: 12, color: AppTheme.slate500, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.slate50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.slate100),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Actual vs expected split', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              const SizedBox(height: 6),
              if (lastN.isEmpty) ...[
                const Text(
                  'Use + to add a monthly cash flow entry — then you can see how your real split compares to the target.',
                  style: TextStyle(color: AppTheme.slate600, fontSize: 13),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: _SummaryStat(
                      label: 'Target invested',
                      value: '$targetPct%',
                      sub: privacy ? '—' : '${g(inv)} / mo',
                    ),
                  ),
                  Expanded(
                    child: _SummaryStat(
                      label: 'Actual invested',
                      value: actualPct != null ? '$actualPct%' : '—',
                      sub: privacy
                          ? '—'
                          : (avgs != null ? '${g(avgs.invested)} / mo avg' : '—'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _SummaryStat(
                      label: 'Target cash / FDs',
                      value: '${(100 - targetPct)}%',
                      sub: privacy ? '—' : '${g(cash)} / mo',
                    ),
                  ),
                  Expanded(
                    child: _SummaryStat(
                      label: 'Actual cash / FDs',
                      value: actualPct != null ? '${100 - actualPct}%' : '—',
                      sub: privacy
                          ? '—'
                          : (avgs != null ? '${g(avgs.cashFd)} / mo avg' : '—'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('After expenses (target)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
        const SizedBox(height: 6),
        Text(
          privacy
              ? 'Unspent net income hidden — percentages only below.'
              : 'Unspent net income: ${g(avail)} / mo',
          style: const TextStyle(color: AppTheme.slate600, fontSize: 13),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                privacy
                    ? 'Cash / FDs\n—'
                    : 'Cash / FDs\n${g(cash)} / mo',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, height: 1.25),
              ),
            ),
            Expanded(
              child: Text(
                privacy ? 'Invested\n—' : 'Invested\n${g(inv)} / mo',
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, height: 1.25),
              ),
            ),
          ],
        ),
        Slider(
          value: avail <= 0 ? 0.0 : model.allocInvestFraction.clamp(0.0, 1.0),
          divisions: 20,
          onChanged: avail <= 0 ? null : model.setAllocInvestFraction,
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('All cash / FDs', style: TextStyle(fontSize: 12, color: AppTheme.slate600)),
            Text('All invested', style: TextStyle(fontSize: 12, color: AppTheme.slate600)),
          ],
        ),
        const SizedBox(height: 24),
        const Text('Each month', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            border: Border.all(color: AppTheme.slate100),
            borderRadius: BorderRadius.circular(12),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _MonthlyCashflowSplitTableHeader(privacyOnlyPercents: privacy),
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
      ],
    );
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({required this.label, required this.value, required this.sub});

  final String label;
  final String value;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.slate600, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        Text(sub, style: const TextStyle(fontSize: 11, color: AppTheme.slate500, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _MonthlyCashflowSplitTableHeader extends StatelessWidget {
  const _MonthlyCashflowSplitTableHeader({this.privacyOnlyPercents = false});

  final bool privacyOnlyPercents;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: const BoxDecoration(
        color: AppTheme.slate50,
        borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 72, child: Text('Month', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11))),
          Expanded(
            child: Text(
              privacyOnlyPercents ? 'Cash / FDs\n%' : 'Cash / FDs\n· %',
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, height: 1.2, color: AppTheme.slate600),
            ),
          ),
          Expanded(
            child: Text(
              privacyOnlyPercents ? 'Invested\n%' : 'Invested\n· %',
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, height: 1.2, color: AppTheme.slate600),
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
    final e = model.monthlyEntryFor(monthKey);
    final cash = e?.outflowToCashFd ?? 0;
    final inv = e?.outflowToInvested ?? 0;
    final total = cash + inv;
    final dc = model.displayCurrency;
    final cashTxt = e != null
        ? (privacyHideAmounts
            ? _allocationShareLabel(cash, total)
            : '${formatGroupedInteger(cash.round(), currency: dc)} · ${_allocationShareLabel(cash, total)}')
        : '—';
    final invTxt = e != null
        ? (privacyHideAmounts
            ? _allocationShareLabel(inv, total)
            : '${formatGroupedInteger(inv.round(), currency: dc)} · ${_allocationShareLabel(inv, total)}')
        : '—';

    final child = Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: showDivider ? AppTheme.slate100 : Colors.transparent)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(AppModel.formatMonthKeyLabel(monthKey), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          Expanded(child: Text(cashTxt, textAlign: TextAlign.end, style: const TextStyle(fontSize: 11))),
          Expanded(child: Text(invTxt, textAlign: TextAlign.end, style: const TextStyle(fontSize: 11))),
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
    if (oldWidget.currency != widget.currency || oldWidget.initialInt != widget.initialInt) {
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
      inputFormatters: [
        GroupedIntegerTextInputFormatter(currency: widget.currency),
      ],
      onChanged: (raw) => widget.onChanged(_parse(raw)),
      decoration: InputDecoration(
        labelText: widget.labelText,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
    );
  }
}

