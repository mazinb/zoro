import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';

/// View / edit per-goal context notes (used by agents and future MCQ guide).
class GoalContextPage extends StatefulWidget {
  const GoalContextPage({super.key, required this.model, required this.goalId});

  final AppModel model;
  final String goalId;

  @override
  State<GoalContextPage> createState() => _GoalContextPageState();
}

class _GoalContextPageState extends State<GoalContextPage> {
  late final TextEditingController _ctrl;
  bool _dirty = false;

  @override
  void initState() {
    super.initState();
    final g = widget.model.financialGoalById(widget.goalId);
    _ctrl = TextEditingController(text: g?.contextMarkdown ?? '');
    _ctrl.addListener(() => _dirty = true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _save() {
    final g = widget.model.financialGoalById(widget.goalId);
    if (g == null) return;
    widget.model.upsertFinancialGoal(g.copyWith(contextMarkdown: _ctrl.text.trim()));
    _dirty = false;
    if (mounted) Navigator.of(context).pop();
  }

  Future<bool> _confirmDiscard() async {
    if (!_dirty) return true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard changes?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Discard')),
          FilledButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep editing')),
        ],
      ),
    );
    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.model.financialGoalById(widget.goalId);
    final title = g == null || g.name.trim().isEmpty ? 'Goal context' : '${g.name} context';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          leading: BackButton(
            onPressed: () async {
              if (await _confirmDiscard() && context.mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
          actions: [
            TextButton(
              onPressed: _save,
              child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: TextField(
            controller: _ctrl,
            maxLines: null,
            expands: true,
            textAlignVertical: TextAlignVertical.top,
            decoration: const InputDecoration(
              hintText: 'Assumptions, constraints, notes…',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
        ),
      ),
    );
  }
}
