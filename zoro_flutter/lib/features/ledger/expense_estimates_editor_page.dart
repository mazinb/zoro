import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/state/app_model.dart';
import '../../core/finance/currency.dart';
import '../../shared/widgets/liquid_glass.dart';

Future<void> openSingleExpenseBucketEditorSheet({
  required BuildContext context,
  required AppModel model,
  required String bucketKey,
}) async {
  final preset = presetForCountry(AppModel.expensePresetCountry);
  final b = preset.buckets[bucketKey];
  if (b == null) return;
  final presetCurrency = currencyCodeForPresetCountry(AppModel.expensePresetCountry);
  final displayCurrency = model.displayCurrency;
  final fx = model.fxUsdPerUnitResolved;

  final defaultV = convertCurrency(
    value: b.value,
    from: presetCurrency,
    to: displayCurrency,
    usdPerUnitOverrides: fx,
  );
  final min = convertCurrency(
    value: b.min,
    from: presetCurrency,
    to: displayCurrency,
    usdPerUnitOverrides: fx,
  );
  final max = convertCurrency(
    value: b.max,
    from: presetCurrency,
    to: displayCurrency,
    usdPerUnitOverrides: fx,
  );
  final v = model.expenseBuckets[bucketKey] ?? defaultV;

  await _openSingleBucketEditor(
    context,
    bucketKey: bucketKey,
    label: b.label,
    currency: displayCurrency,
    initialValue: v,
    min: min,
    max: max,
    onApply: (nv) => model.setExpenseBucket(bucketKey, nv),
  );
}

Future<void> openExpenseEstimatesEditorSheet({
  required BuildContext context,
  required AppModel model,
}) async {
  await showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => ExpenseEstimatesEditorSheet(model: model, presentingContext: context),
  );
}

/// Full-screen editor for monthly expense estimate buckets.
class ExpenseEstimatesEditorPage extends StatefulWidget {
  const ExpenseEstimatesEditorPage({super.key, required this.model});

  final AppModel model;

  @override
  State<ExpenseEstimatesEditorPage> createState() => _ExpenseEstimatesEditorPageState();
}

class _ExpenseEstimatesEditorPageState extends State<ExpenseEstimatesEditorPage> {
  var _dirty = false;

  double _niceStep(double v) {
    if (v <= 0) return 1;
    // Snap to 1/2/5 * 10^n.
    final exp = v == 0 ? 0 : (math.log(v.abs()) / math.ln10).floor();
    final base = mathPow10(exp);
    final scaled = v / base;
    final snapped = scaled <= 1 ? 1 : (scaled <= 2 ? 2 : (scaled <= 5 ? 5 : 10));
    return snapped * base;
  }

  double mathPow10(int exp) {
    var out = 1.0;
    for (var i = 0; i < exp; i++) {
      out *= 10;
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model;
    final preset = presetForCountry(AppModel.expensePresetCountry);
    final presetCurrency = currencyCodeForPresetCountry(AppModel.expensePresetCountry);
    final displayCurrency = model.displayCurrency;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop && _dirty) {
          model.markExpenseEstimatesUpdated();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Edit expense estimates'),
          actions: [
            TextButton(
              onPressed: () {
                if (_dirty) model.markExpenseEstimatesUpdated();
                Navigator.of(context).pop();
              },
              child: const Text('Done'),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'These are your planned monthly budgets. Changes apply immediately to the Sankey and donut chart.',
              style: TextStyle(color: muted, fontSize: 13),
            ),
            const SizedBox(height: 20),
            const Text('Monthly buckets', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            const SizedBox(height: 12),
            ...recurringExpenseBucketKeys.map((k) {
              final b = preset.buckets[k]!;
              final fx = model.fxUsdPerUnitResolved;
              final defaultV = convertCurrency(
                value: b.value,
                from: presetCurrency,
                to: displayCurrency,
                usdPerUnitOverrides: fx,
              );
              final min = convertCurrency(
                value: b.min,
                from: presetCurrency,
                to: displayCurrency,
                usdPerUnitOverrides: fx,
              );
              final max = convertCurrency(
                value: b.max,
                from: presetCurrency,
                to: displayCurrency,
                usdPerUnitOverrides: fx,
              );
              final step = _niceStep(
                convertCurrency(
                  value: b.step,
                  from: presetCurrency,
                  to: displayCurrency,
                  usdPerUnitOverrides: fx,
                ),
              );
              final v = model.expenseBuckets[k] ?? defaultV;
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _EditorBucketRow(
                  key: ValueKey('ed-$k'),
                  bucketKey: k,
                  label: b.label,
                  displayCurrency: displayCurrency,
                  value: v,
                  min: min,
                  max: max,
                  step: step,
                  onChanged: (nv) {
                    setState(() => _dirty = true);
                    model.setExpenseBucket(k, nv);
                  },
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet editor (liquid glass) for monthly buckets.
class ExpenseEstimatesEditorSheet extends StatefulWidget {
  const ExpenseEstimatesEditorSheet({
    super.key,
    required this.model,
    required this.presentingContext,
  });

  final AppModel model;
  final BuildContext presentingContext;

  @override
  State<ExpenseEstimatesEditorSheet> createState() => _ExpenseEstimatesEditorSheetState();
}

class _ExpenseEstimatesEditorSheetState extends State<ExpenseEstimatesEditorSheet> {
  var _dirty = false;

  double _niceStep(double v) {
    if (v <= 0) return 1;
    final exp = v == 0 ? 0 : (math.log(v.abs()) / math.ln10).floor();
    final base = _pow10(exp);
    final scaled = v / base;
    final snapped = scaled <= 1 ? 1 : (scaled <= 2 ? 2 : (scaled <= 5 ? 5 : 10));
    return snapped * base;
  }

  double _pow10(int exp) {
    var out = 1.0;
    for (var i = 0; i < exp; i++) {
      out *= 10;
    }
    return out;
  }

  void _close() {
    if (_dirty) widget.model.markExpenseEstimatesUpdated();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model;
    final preset = presetForCountry(AppModel.expensePresetCountry);
    final presetCurrency = currencyCodeForPresetCountry(AppModel.expensePresetCountry);
    final displayCurrency = model.displayCurrency;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;

    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop && _dirty) model.markExpenseEstimatesUpdated();
      },
      child: Padding(
        padding: EdgeInsets.only(
          left: 14,
          right: 14,
          top: 6,
          bottom: 14 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text('Expense estimates', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                ),
                IconButton(
                  onPressed: _close,
                  icon: const Icon(Icons.close),
                  tooltip: 'Close',
                ),
              ],
            ),
            Text(
              'Planned monthly budgets. Changes apply immediately.',
              style: TextStyle(color: muted, fontSize: 13, height: 1.35),
            ),
            const SizedBox(height: 14),
            ConstrainedBox(
              // Cap to a sensible sheet height without tying it to screen %.
              // If content is shorter, the sheet stays compact (sizesToContent).
              constraints: BoxConstraints(
                maxHeight: math.min(MediaQuery.of(context).size.height - 220, 520),
              ),
              child: ListView(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                children: [
                  for (final k in recurringExpenseBucketKeys) ...[
                    Builder(
                      builder: (ctx) {
                        final b = preset.buckets[k]!;
                        final fx = model.fxUsdPerUnitResolved;
                        final defaultV = convertCurrency(
                          value: b.value,
                          from: presetCurrency,
                          to: displayCurrency,
                          usdPerUnitOverrides: fx,
                        );
                        final min = convertCurrency(
                          value: b.min,
                          from: presetCurrency,
                          to: displayCurrency,
                          usdPerUnitOverrides: fx,
                        );
                        final max = convertCurrency(
                          value: b.max,
                          from: presetCurrency,
                          to: displayCurrency,
                          usdPerUnitOverrides: fx,
                        );
                        final step = _niceStep(
                          convertCurrency(
                            value: b.step,
                            from: presetCurrency,
                            to: displayCurrency,
                            usdPerUnitOverrides: fx,
                          ),
                        );
                        final v = model.expenseBuckets[k] ?? defaultV;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _EditorBucketRow(
                            key: ValueKey('sheet-$k'),
                            bucketKey: k,
                            label: b.label,
                            displayCurrency: displayCurrency,
                            value: v,
                            min: min,
                            max: max,
                            step: step,
                            onChanged: (nv) {
                              setState(() => _dirty = true);
                              model.setExpenseBucket(k, nv);
                            },
                            onLongPressEdit: () async {
                              // Replace the full list sheet with a compact single-bucket sheet.
                              _close();
                              await Future<void>.delayed(const Duration(milliseconds: 140));
                              if (!widget.presentingContext.mounted) return;
                              await _openSingleBucketEditor(
                                widget.presentingContext,
                                bucketKey: k,
                                label: b.label,
                                currency: displayCurrency,
                                initialValue: v,
                                min: min,
                                max: max,
                                onApply: (nv) {
                                  setState(() => _dirty = true);
                                  model.setExpenseBucket(k, nv);
                                },
                              );
                            },
                          ),
                        );
                      },
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: _close,
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditorBucketRow extends StatefulWidget {
  const _EditorBucketRow({
    super.key,
    required this.bucketKey,
    required this.label,
    required this.displayCurrency,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
    this.onLongPressEdit,
  });

  final String bucketKey;
  final String label;
  final CurrencyCode displayCurrency;
  final double value;
  final double min;
  final double max;
  final double step;
  final ValueChanged<double> onChanged;
  final VoidCallback? onLongPressEdit;

  @override
  State<_EditorBucketRow> createState() => _EditorBucketRowState();
}

class _EditorBucketRowState extends State<_EditorBucketRow> {
  late final TextEditingController _ctrl = TextEditingController(text: _fmt(widget.value));
  final _focus = FocusNode();

  String _fmt(double v) => formatGroupedInteger(v.round(), currency: widget.displayCurrency);

  int _parse(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return 0;
    return int.tryParse(digits) ?? 0;
  }

  @override
  void didUpdateWidget(covariant _EditorBucketRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && !_focus.hasFocus) {
      final next = _fmt(widget.value);
      if (_ctrl.text != next) _ctrl.text = next;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onLongPress: () async {
          if (widget.onLongPressEdit != null) {
            widget.onLongPressEdit!.call();
            return;
          }
          if (!context.mounted) return;
          await _openSingleBucketEditor(
            context,
            bucketKey: widget.bucketKey,
            label: widget.label,
            currency: widget.displayCurrency,
            initialValue: widget.value,
            min: widget.min,
            max: widget.max,
            onApply: widget.onChanged,
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _ctrl,
                focusNode: _focus,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  GroupedIntegerTextInputFormatter(currency: widget.displayCurrency),
                ],
                onChanged: (raw) {
                  final n = _parse(raw).toDouble().clamp(widget.min, widget.max);
                  widget.onChanged(n);
                },
                decoration: InputDecoration(
                  labelText: widget.label,
                  prefixText: widget.displayCurrency.symbol,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> _openSingleBucketEditor(
  BuildContext context, {
  required String bucketKey,
  required String label,
  required CurrencyCode currency,
  required double initialValue,
  required double min,
  required double max,
  required ValueChanged<double> onApply,
}) async {
  final ctrl = TextEditingController(text: formatGroupedInteger(initialValue.round(), currency: currency));
  final focus = FocusNode();
  int parse(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return 0;
    return int.tryParse(digits) ?? 0;
  }

  await showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 14,
        right: 14,
        top: 10,
        bottom: 14 + MediaQuery.of(ctx).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Intentionally compact: one field + Done.
          TextField(
            controller: ctrl,
            focusNode: focus,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [GroupedIntegerTextInputFormatter(currency: currency)],
            decoration: InputDecoration(
              labelText: label,
              prefixText: currency.symbol,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: (raw) {
              final n = parse(raw).toDouble().clamp(min, max);
              onApply(n);
            },
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    ),
  );

  ctrl.dispose();
  focus.dispose();
  // ignore: unused_local_variable
  bucketKey; // reserved for future per-bucket context editing.
}
