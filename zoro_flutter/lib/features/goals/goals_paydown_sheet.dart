import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_widgets.dart';

Future<void> openGoalsPaydownSheet({
  required BuildContext context,
  required AppModel model,
  required String liabilityId,
}) {
  return showLiquidGlassModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    sizesToContent: true,
    builder: (ctx) => _GoalsPaydownSheet(
      key: ValueKey<String>('paydown-$liabilityId'),
      model: model,
      liabilityId: liabilityId,
    ),
  );
}

class _GoalsPaydownSheet extends StatefulWidget {
  const _GoalsPaydownSheet({
    super.key,
    required this.model,
    required this.liabilityId,
  });

  final AppModel model;
  final String liabilityId;

  @override
  State<_GoalsPaydownSheet> createState() => _GoalsPaydownSheetState();
}

class _GoalsPaydownSheetState extends State<_GoalsPaydownSheet> {
  late double _monthly;
  late TextEditingController _textCtrl;
  bool _syncing = false;

  LedgerLiabilityRow? get _liability => widget.model.liabilityById(widget.liabilityId);

  double get _maxMonthly => widget.model.availableAfterExpensesMonthly;

  @override
  void initState() {
    super.initState();
    _textCtrl = TextEditingController();
    _loadFromLiability();
  }

  @override
  void didUpdateWidget(covariant _GoalsPaydownSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.liabilityId != widget.liabilityId) {
      _loadFromLiability();
    }
  }

  void _loadFromLiability() {
    _monthly = _liability?.paydownMonthly ?? 0;
    _syncing = true;
    _textCtrl.text = _formatInput(_monthly);
    _textCtrl.selection = TextSelection.collapsed(offset: _textCtrl.text.length);
    _syncing = false;
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  String _formatInput(double v) {
    if (v <= 0) return '';
    final rounded = (v * 100).round() / 100;
    if (rounded == rounded.roundToDouble()) return rounded.round().toString();
    return rounded.toStringAsFixed(0);
  }

  void _setMonthly(double v) {
    final clamped = v.clamp(0, _maxMonthly).toDouble();
    if ((clamped - _monthly).abs() < 0.005) return;
    setState(() {
      _monthly = clamped;
      _syncing = true;
      _textCtrl.text = _formatInput(clamped);
      _textCtrl.selection = TextSelection.collapsed(offset: _textCtrl.text.length);
      _syncing = false;
    });
  }

  void _onTextChanged(String raw) {
    if (_syncing) return;
    final parsed = double.tryParse(raw.replaceAll(',', '').trim());
    if (parsed == null) {
      if (raw.trim().isEmpty) _setMonthly(0);
      return;
    }
    _setMonthly(parsed);
  }

  void _save() {
    widget.model.setLiabilityPaydownMonthly(widget.liabilityId, _monthly);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final l = _liability;
    if (l == null) {
      return const Padding(padding: EdgeInsets.all(16), child: Text('Debt not found'));
    }

    final hide = m.privacyHideAmounts;
    final cs = Theme.of(context).colorScheme;
    final name = l.name.trim().isEmpty ? l.type.label : l.name.trim();
    final balance = m.liabilityDisplayValue(l);
    final max = _maxMonthly;
    final payoff = goalLiabilityPayoffDateLabel(m, l);

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: 12 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          Text(
            '${goalMoney(m, balance, hide: hide)} owed${payoff != null ? ' · $payoff' : ''}',
            style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _textCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.,]'))],
            decoration: InputDecoration(
              labelText: 'Monthly paydown',
              isDense: true,
              prefixText: '${m.displayCurrencySymbol} ',
              suffixText: '/mo',
            ),
            onChanged: _onTextChanged,
          ),
          Slider(
            value: max <= 0 ? 0 : _monthly.clamp(0, max),
            min: 0,
            max: max <= 0 ? 1 : max,
            onChanged: max <= 0 ? null : _setMonthly,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: _save,
              child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }
}
