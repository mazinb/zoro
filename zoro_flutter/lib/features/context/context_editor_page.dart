import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import 'context_planner_config.dart';
import 'context_planner_page.dart';

enum ContextKind { asset, liability, bucket, month }

class ContextEditorPage extends StatefulWidget {
  const ContextEditorPage._({
    required this.model,
    required this.kind,
    required this.title,
    required this.initialMarkdown,
    required this.onSave,
    this.plannerAssetId,
    this.plannerLiabilityId,
    this.plannerBucketKey,
    this.plannerMonthKey,
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
      plannerAssetId: assetId,
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
      plannerLiabilityId: liabilityId,
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
      plannerBucketKey: bucketKey,
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
          model.markContextNoteSaved(AppModel.contextKeyMonth(monthKey));
        } else {
          model.setMonthlyEntryContextMarkdown(monthKey: monthKey, markdown: md);
        }
      },
      plannerMonthKey: monthKey,
    );
  }

  final AppModel model;
  final ContextKind kind;
  final String title;
  final String initialMarkdown;
  final void Function(String markdown) onSave;

  final String? plannerAssetId;
  final String? plannerLiabilityId;
  final String? plannerBucketKey;
  final String? plannerMonthKey;

  bool get _hasPlanner =>
      plannerAssetId != null ||
      plannerLiabilityId != null ||
      plannerBucketKey != null ||
      plannerMonthKey != null;

  String get _plannerAgentId => switch (kind) {
        ContextKind.asset => InternalAppAgentIds.assetContext,
        ContextKind.liability => InternalAppAgentIds.liabilityContext,
        ContextKind.bucket => InternalAppAgentIds.expenseBucketContext,
        ContextKind.month => InternalAppAgentIds.monthCashflowContext,
      };

  ContextPlannerConfig _plannerConfig(String markdown) {
    final m = model;
    return switch (kind) {
      ContextKind.asset => ContextPlannerConfig.forAsset(model: m, assetId: plannerAssetId!, initialMarkdown: markdown),
      ContextKind.liability =>
        ContextPlannerConfig.forLiability(model: m, liabilityId: plannerLiabilityId!, initialMarkdown: markdown),
      ContextKind.bucket =>
        ContextPlannerConfig.forExpenseBucket(model: m, bucketKey: plannerBucketKey!, initialMarkdown: markdown),
      ContextKind.month =>
        ContextPlannerConfig.forMonth(model: m, monthKey: plannerMonthKey!, initialMarkdown: markdown),
    };
  }

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

  Future<void> _openPlanner() async {
    final res = await Navigator.of(context).push<ContextPlannerResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => ContextPlannerPage(
          model: widget.model,
          config: widget._plannerConfig(_ctrl.text),
        ),
      ),
    );
    if (!mounted || res == null) return;
    setState(() => _ctrl.text = res.contextMarkdown);
    widget.model.recordInternalAgentRun(widget._plannerAgentId, res.structured);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          if (widget._hasPlanner)
            IconButton(
              tooltip: 'Assistant',
              icon: const Icon(Icons.auto_awesome),
              onPressed: _openPlanner,
            ),
          TextButton(
            onPressed: _save,
            child: const Text('Save'),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: SizedBox.expand(
            child: TextField(
              controller: _ctrl,
              expands: true,
              maxLines: null,
              minLines: null,
              keyboardType: TextInputType.multiline,
              textAlignVertical: TextAlignVertical.top,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'Add notes the chat/agents can use later…',
                contentPadding: EdgeInsets.all(12),
                isDense: false,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
