import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_context_page.dart';
import 'goal_widgets.dart';
import 'goals_guide_flow.dart';

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

class _GoalEditorSheet extends StatefulWidget {
  const _GoalEditorSheet({required this.model, required this.goalId});

  final AppModel model;
  final String goalId;

  @override
  State<_GoalEditorSheet> createState() => _GoalEditorSheetState();
}

class _GoalEditorSheetState extends State<_GoalEditorSheet> {
  late TextEditingController _nameCtrl;
  late TextEditingController _targetCtrl;
  late Set<String> _linked;
  DateTime? _targetDate;
  bool _fundsProjects = false;

  FinancialGoal? get _goal => widget.model.financialGoalById(widget.goalId);

  @override
  void initState() {
    super.initState();
    final g = _goal;
    _nameCtrl = TextEditingController(text: g?.name ?? '');
    _targetCtrl = TextEditingController(
      text: g != null && g.targetAmount > 0 ? g.targetAmount.round().toString() : '',
    );
    _linked = Set<String>.from(g?.linkedAssetIds ?? []);
    _targetDate = g?.targetDate;
    _fundsProjects = g?.fundsProjects ?? false;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _targetCtrl.dispose();
    super.dispose();
  }

  double _parseTarget() {
    final t = _targetCtrl.text.replaceAll(RegExp(r'[,\s]'), '');
    return double.tryParse(t) ?? 0;
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

  void _save() {
    final g = _goal;
    if (g == null) return;
    widget.model.upsertFinancialGoal(
      g.copyWith(
        name: _nameCtrl.text.trim().isEmpty ? g.name : _nameCtrl.text.trim(),
        targetAmount: _parseTarget(),
        targetDate: _targetDate,
        clearTargetDate: _targetDate == null,
        linkedAssetIds: _linked.toList(),
        fundsProjects: _fundsProjects,
      ),
    );
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _adjustCorpus(double delta) async {
    widget.model.adjustRetirementCorpus(delta);
    if (mounted) setState(() {});
  }

  Future<double?> _promptAmount(String title, {String? hint}) async {
    final ctrl = TextEditingController();
    final v = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.,\-]'))],
          decoration: InputDecoration(hintText: hint ?? 'Amount'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final t = ctrl.text.replaceAll(RegExp(r'[,\s]'), '');
              Navigator.pop(ctx, double.tryParse(t));
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    return v;
  }

  @override
  Widget build(BuildContext context) {
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

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isRetirement ? 'Retirement' : 'Target goal',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 14),
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
            TextField(
              controller: _targetCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.,]'))],
              decoration: InputDecoration(
                labelText: isRetirement ? 'Target corpus' : 'Target amount',
                isDense: true,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.event_outlined, size: 18),
              label: Text(goalDateLabel(_targetDate), style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
            if (isRetirement) ...[
              const SizedBox(height: 16),
              Text(
                'Corpus adjustment',
                style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 13),
              ),
              const SizedBox(height: 6),
              Text(
                'On top of linked investments — contributions or withdrawals not in asset totals.',
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant.withValues(alpha: 0.9)),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      goalMoney(m, g.corpusAdjustment, hide: hide),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: () => _adjustCorpus(-1000),
                    icon: const Icon(Icons.remove),
                    tooltip: '−1k',
                  ),
                  const SizedBox(width: 6),
                  IconButton.filledTonal(
                    onPressed: () => _adjustCorpus(1000),
                    icon: const Icon(Icons.add),
                    tooltip: '+1k',
                  ),
                  IconButton(
                    onPressed: () async {
                      final v = await _promptAmount('Adjust corpus', hint: '+ add / − withdraw');
                      if (v != null && v != 0) _adjustCorpus(v);
                    },
                    icon: const Icon(Icons.edit_outlined),
                    tooltip: 'Custom',
                  ),
                ],
              ),
            ],
            if (!isRetirement) ...[
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Funds projects', style: TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                  'Uses your savings slice for near-term projects.',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
                value: _fundsProjects,
                onChanged: (v) => setState(() => _fundsProjects = v),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Text('Linked assets', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                const Spacer(),
                Text(
                  '${_linked.length}',
                  style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...m.assets.map((a) {
              final name = a.name.trim().isEmpty ? a.type.label : a.name.trim();
              final selected = _linked.contains(a.id);
              final val = goalMoney(m, m.assetDisplayValue(a), hide: hide);
              return CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                secondary: Icon(a.type.icon, color: m.accent, size: 22),
                title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(val, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                value: selected,
                onChanged: (on) {
                  setState(() {
                    if (on == true) {
                      _linked.add(a.id);
                    } else {
                      _linked.remove(a.id);
                    }
                  });
                },
              );
            }),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () {
                Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (ctx) => GoalContextPage(model: m, goalId: g.id),
                  ),
                );
              },
              icon: const Icon(Icons.description_outlined, size: 18),
              label: const Text('Context notes', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
            TextButton.icon(
              onPressed: () async {
                Navigator.of(context).pop();
                await openGoalsGuideLauncher(
                  context: context,
                  model: m,
                );
              },
              icon: const Icon(Icons.auto_awesome, size: 18),
              label: const Text('Run guide', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (!isRetirement)
                  TextButton(
                    onPressed: () {
                      m.removeFinancialGoal(g.id);
                      Navigator.of(context).pop();
                    },
                    child: Text('Delete', style: TextStyle(color: cs.error, fontWeight: FontWeight.w800)),
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
  }
}
