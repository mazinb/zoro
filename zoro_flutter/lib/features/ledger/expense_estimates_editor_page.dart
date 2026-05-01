import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/state/app_model.dart';
import '../../core/finance/currency.dart';
import '../../shared/theme/app_theme.dart';

/// Full-screen editor for monthly expense estimate buckets (sliders + fields).
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
              style: TextStyle(color: AppTheme.slate600, fontSize: 13),
            ),
            const SizedBox(height: 20),
            const Text('Monthly buckets', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            const SizedBox(height: 12),
            ...recurringExpenseBucketKeys.map((k) {
              final b = preset.buckets[k]!;
              final defaultV = convertCurrency(value: b.value, from: presetCurrency, to: displayCurrency);
              final min = convertCurrency(value: b.min, from: presetCurrency, to: displayCurrency);
              final max = convertCurrency(value: b.max, from: presetCurrency, to: displayCurrency);
              final step = _niceStep(convertCurrency(value: b.step, from: presetCurrency, to: displayCurrency));
              final v = model.expenseBuckets[k] ?? defaultV;
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _EditorBucketRow(
                  key: ValueKey('ed-$k'),
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

class _EditorBucketRow extends StatefulWidget {
  const _EditorBucketRow({
    super.key,
    required this.label,
    required this.displayCurrency,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
  });

  final String label;
  final CurrencyCode displayCurrency;
  final double value;
  final double min;
  final double max;
  final double step;
  final ValueChanged<double> onChanged;

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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w800))),
            SizedBox(
              width: 132,
              child: TextField(
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
                  prefixText: widget.displayCurrency.symbol,
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Slider(
          min: widget.min,
          max: widget.max,
          divisions: ((widget.max - widget.min) / widget.step).round().clamp(1, 5000),
          value: widget.value.clamp(widget.min, widget.max),
          onChanged: widget.onChanged,
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(money(widget.min, currency: widget.displayCurrency), style: const TextStyle(color: AppTheme.slate600, fontSize: 12)),
            Text(money(widget.max, currency: widget.displayCurrency), style: const TextStyle(color: AppTheme.slate600, fontSize: 12)),
          ],
        ),
      ],
    );
  }
}
