import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import '../../shared/theme/app_theme.dart';

enum ContextKind { asset, liability, bucket, month }

class ContextEditorPage extends StatefulWidget {
  const ContextEditorPage._({
    required this.model,
    required this.kind,
    required this.title,
    required this.initialMarkdown,
    required this.onSave,
  });

  factory ContextEditorPage.asset({required AppModel model, required String assetId}) {
    final a = model.assetById(assetId);
    final name = a == null ? 'Asset' : (a.name.trim().isEmpty ? a.type.label : a.name.trim());
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.asset,
      title: name,
      initialMarkdown: a?.contextMarkdown ?? '',
      onSave: (md) => model.setAssetContextMarkdown(assetId: assetId, markdown: md),
    );
  }

  factory ContextEditorPage.liability({required AppModel model, required String liabilityId}) {
    final l = model.liabilityById(liabilityId);
    final name = l == null ? 'Liability' : (l.name.trim().isEmpty ? l.type.label : l.name.trim());
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.liability,
      title: name,
      initialMarkdown: l?.contextMarkdown ?? '',
      onSave: (md) => model.setLiabilityContextMarkdown(liabilityId: liabilityId, markdown: md),
    );
  }

  factory ContextEditorPage.expenseBucket({required AppModel model, required String bucketKey}) {
    final label = presetForCountry(AppModel.expensePresetCountry).buckets[bucketKey]?.label ?? bucketKey;
    final md = model.expenseBucketContextMarkdown[bucketKey] ?? '';
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.bucket,
      title: label,
      initialMarkdown: md,
      onSave: (next) => model.setExpenseBucketContextMarkdown(bucketKey: bucketKey, markdown: next),
    );
  }

  factory ContextEditorPage.month({required AppModel model, required String monthKey}) {
    final e = model.monthlyEntryFor(monthKey);
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.month,
      title: AppModel.formatMonthKeyLabel(monthKey),
      initialMarkdown: e?.contextMarkdown ?? '',
      onSave: (md) {
        final ex = model.monthlyEntryFor(monthKey);
        if (ex == null) {
          model.upsertMonthlyCashflow(
            MonthlyCashflowEntry(
              monthKey: monthKey,
              outflowToCashFd: 0,
              outflowToInvested: 0,
              monthlySpending: 0,
              comment: '',
              contextMarkdown: md,
            ),
          );
        } else {
          model.setMonthlyEntryContextMarkdown(monthKey: monthKey, markdown: md);
        }
      },
    );
  }

  final AppModel model;
  final ContextKind kind;
  final String title;
  final String initialMarkdown;
  final void Function(String markdown) onSave;

  @override
  State<ContextEditorPage> createState() => _ContextEditorPageState();
}

class _ContextEditorPageState extends State<ContextEditorPage> {
  late final TextEditingController _ctrl = TextEditingController(text: widget.initialMarkdown);
  final List<String> _undoStack = [];
  bool _drafting = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _save() {
    widget.onSave(_ctrl.text.trim());
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Saved'), behavior: SnackBarBehavior.floating),
    );
  }

  void _undo() {
    if (_undoStack.isEmpty) return;
    final last = _undoStack.removeLast();
    _ctrl.text = last;
    setState(() {});
  }

  String _defaultDraft() {
    final title = widget.title.trim().isEmpty ? 'Context' : widget.title.trim();
    final existing = _ctrl.text.trim();

    String section(String heading, List<String> bullets) => '## $heading\n\n${bullets.map((b) => '- $b').join('\n')}\n';

    switch (widget.kind) {
      case ContextKind.asset:
        final bullets = [
          'What this is (account / property / platform)',
          'Currency and where the number comes from',
          'Top holdings (if relevant) and any restricted components',
          'Liquidity + expected inflows/outflows',
          'Update cadence (how often it changes)',
        ];
        return '## $title\n\n${section('Notes', bullets)}${existing.isEmpty ? '' : '\n---\n\n### Existing notes\n$existing\n'}';
      case ContextKind.liability:
        final bullets = [
          'Lender',
          'Original amount + current balance source',
          'Interest rate (fixed/variable) + fees',
          'Payment amount + due date',
          'Term / payoff plan',
          'Anything unusual (promo APR, balloon, refinance plan)',
        ];
        return '## $title\n\n${section('Terms', bullets)}${existing.isEmpty ? '' : '\n---\n\n### Existing notes\n$existing\n'}';
      case ContextKind.bucket:
        final bullets = [
          'What belongs in this bucket (examples)',
          'What does *not* belong here (edge cases)',
          'What would increase/decrease it month-to-month',
          'Any seasonality (travel, holidays, annual renewals)',
          'If it’s lumpy: typical one-offs to expect',
        ];
        return '## $title\n\n${section('What counts', bullets)}${existing.isEmpty ? '' : '\n---\n\n### Existing notes\n$existing\n'}';
      case ContextKind.month:
        final bullets = [
          'Big one-offs (amount + why)',
          'Travel / medical / moving (if any)',
          'Income changes',
          'What to adjust next month',
          'Anything the agent should remember for planning',
        ];
        return '## $title\n\n${section('What happened', bullets)}${existing.isEmpty ? '' : '\n---\n\n### Existing notes\n$existing\n'}';
    }
  }

  Future<void> _draftWithAI() async {
    if (_drafting) return;
    setState(() => _drafting = true);
    try {
      final previous = _ctrl.text;
      var draft = _defaultDraft();

      final edited = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (context) {
          final bottom = MediaQuery.of(context).viewInsets.bottom;
          final draftCtrl = TextEditingController(text: draft);
          return Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 16 + bottom),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Draft with AI',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 6),
                const Text('Edit the draft, then keep it (or cancel).', style: TextStyle(color: AppTheme.slate600)),
                const SizedBox(height: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 420),
                  child: TextField(
                    controller: draftCtrl,
                    maxLines: null,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                      labelText: 'Draft (Markdown)',
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                        label: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => Navigator.of(context).pop(draftCtrl.text),
                        icon: const Icon(Icons.check),
                        label: const Text('Keep draft'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      );

      if (!mounted) return;
      if (edited == null) return;

      // Apply and record undo.
      _undoStack.add(previous);
      _ctrl.text = edited;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Draft applied'),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Undo',
            onPressed: _undo,
          ),
        ),
      );
      setState(() {});
    } finally {
      if (mounted) setState(() => _drafting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final helperText = switch (widget.kind) {
      ContextKind.bucket => 'Tip: keep this focused on what belongs in this bucket and what would change it.',
      ContextKind.month => 'Tip: focus on what changed this month and what to adjust next.',
      ContextKind.asset => 'Tip: include where the number comes from and what could change it.',
      ContextKind.liability => 'Tip: include rate, payment, and payoff plan.',
    };

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Context (Markdown)',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  onPressed: _drafting ? null : _draftWithAI,
                  tooltip: 'Draft with AI',
                  icon: const Icon(Icons.auto_awesome),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: TextField(
                controller: _ctrl,
                expands: true,
                maxLines: null,
                textAlignVertical: TextAlignVertical.top,
                decoration: InputDecoration(
                  border: const OutlineInputBorder(),
                  alignLabelWithHint: true,
                  hintText: 'Add notes the chat/agents can use later…',
                  helperText: helperText,
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AnimatedPadding(
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(bottom: bottomInset),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilledButton.icon(
                  onPressed: _save,
                  icon: const Icon(Icons.save),
                  label: const Text('Save'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _undoStack.isEmpty ? null : _undo,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Theme.of(context).colorScheme.primary,
                          side: BorderSide(color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.35)),
                        ),
                        icon: const Icon(Icons.undo),
                        label: const Text('Undo'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

