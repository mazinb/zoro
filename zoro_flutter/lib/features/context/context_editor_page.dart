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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          TextButton(onPressed: _save, child: const Text('Save')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Context (Markdown)',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: null,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Draft with AI'),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ctrl,
            maxLines: 18,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
              hintText: 'Add notes the chat/agents can use later…',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _save,
            icon: const Icon(Icons.save),
            label: const Text('Save'),
          ),
          const SizedBox(height: 10),
          if (widget.kind == ContextKind.bucket)
            const Text(
              'Tip: keep this focused on what belongs in this bucket and what would change it.',
              style: TextStyle(color: AppTheme.slate600),
            ),
        ],
      ),
    );
  }
}

