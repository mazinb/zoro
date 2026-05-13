import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/import/document_ingest.dart';
import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/llm_client.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import '../../shared/widgets/context_markdown_view.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'context_planner_config.dart';
import 'context_planner_page.dart';

enum ContextKind { asset, liability, bucket, month }

enum _ContextAssistantAction { questions, photos, file }

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

  factory ContextEditorPage.asset({
    required AppModel model,
    required String assetId,
  }) {
    final a = model.assetById(assetId);
    final name = a == null
        ? 'Asset'
        : (a.name.trim().isEmpty ? a.type.label : a.name.trim());
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.asset,
      title: name,
      initialMarkdown: a?.contextMarkdown ?? '',
      onSave: (md) =>
          model.setAssetContextMarkdown(assetId: assetId, markdown: md),
      plannerAssetId: assetId,
    );
  }

  factory ContextEditorPage.liability({
    required AppModel model,
    required String liabilityId,
  }) {
    final l = model.liabilityById(liabilityId);
    final name = l == null
        ? 'Liability'
        : (l.name.trim().isEmpty ? l.type.label : l.name.trim());
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.liability,
      title: name,
      initialMarkdown: l?.contextMarkdown ?? '',
      onSave: (md) => model.setLiabilityContextMarkdown(
        liabilityId: liabilityId,
        markdown: md,
      ),
      plannerLiabilityId: liabilityId,
    );
  }

  factory ContextEditorPage.expenseBucket({
    required AppModel model,
    required String bucketKey,
  }) {
    final label =
        presetForCountry(
          AppModel.expensePresetCountry,
        ).buckets[bucketKey]?.label ??
        bucketKey;
    final md = model.expenseBucketContextMarkdown[bucketKey] ?? '';
    return ContextEditorPage._(
      model: model,
      kind: ContextKind.bucket,
      title: label,
      initialMarkdown: md,
      onSave: (next) => model.setExpenseBucketContextMarkdown(
        bucketKey: bucketKey,
        markdown: next,
      ),
      plannerBucketKey: bucketKey,
    );
  }

  factory ContextEditorPage.month({
    required AppModel model,
    required String monthKey,
  }) {
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
              openingBalance: 0,
              closingBalance: 0,
              outflowToCashFd: 0,
              outflowToInvested: 0,
              monthlySpending: 0,
              comment: '',
              contextMarkdown: md,
            ),
          );
          model.markContextNoteSaved(AppModel.contextKeyMonth(monthKey));
        } else {
          model.setMonthlyEntryContextMarkdown(
            monthKey: monthKey,
            markdown: md,
          );
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
      ContextKind.asset => ContextPlannerConfig.forAsset(
        model: m,
        assetId: plannerAssetId!,
        initialMarkdown: markdown,
      ),
      ContextKind.liability => ContextPlannerConfig.forLiability(
        model: m,
        liabilityId: plannerLiabilityId!,
        initialMarkdown: markdown,
      ),
      ContextKind.bucket => ContextPlannerConfig.forExpenseBucket(
        model: m,
        bucketKey: plannerBucketKey!,
        initialMarkdown: markdown,
      ),
      ContextKind.month => ContextPlannerConfig.forMonth(
        model: m,
        monthKey: plannerMonthKey!,
        initialMarkdown: markdown,
      ),
    };
  }

  @override
  State<ContextEditorPage> createState() => _ContextEditorPageState();
}

class _ContextEditorPageState extends State<ContextEditorPage> {
  late final TextEditingController _ctrl = TextEditingController(
    text: widget.initialMarkdown,
  );

  /// When false, shows rendered markdown; when true, plain editor + AI + Save.
  bool _editing = false;

  /// Text at last edit entry or after Save; used for unsaved-change prompts.
  String _editBaseline = '';

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  String _markdownFromModel() {
    final m = widget.model;
    return switch (widget.kind) {
      ContextKind.asset => m.assetById(widget.plannerAssetId!)?.contextMarkdown ?? '',
      ContextKind.liability =>
        m.liabilityById(widget.plannerLiabilityId!)?.contextMarkdown ?? '',
      ContextKind.bucket =>
        m.expenseBucketContextMarkdown[widget.plannerBucketKey!] ?? '',
      ContextKind.month =>
        m.monthlyEntryFor(widget.plannerMonthKey!)?.contextMarkdown ?? '',
    };
  }

  void _openEdit() {
    setState(() {
      _editing = true;
      _ctrl.text = _markdownFromModel();
      _editBaseline = _ctrl.text.trim();
    });
  }

  Future<void> _leaveEditIfAllowed() async {
    if (_ctrl.text.trim() == _editBaseline) {
      setState(() => _editing = false);
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text(
          'You have unsaved edits. Leave the editor and discard them?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (!mounted || discard != true) return;
    setState(() => _editing = false);
  }

  void _save() {
    widget.onSave(_ctrl.text.trim());
    _editBaseline = _ctrl.text.trim();
    setState(() => _editing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Saved'),
        behavior: SnackBarBehavior.floating,
      ),
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
    widget.onSave(res.contextMarkdown);
    widget.model.recordInternalAgentRun(widget._plannerAgentId, res.structured);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          (res.structured['summary']?.toString().trim().isNotEmpty ?? false)
              ? 'Saved: ${res.structured['summary']}'
              : 'Context saved from planner',
        ),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
      ),
    );
  }

  Future<void> _openAssistantOptions() async {
    final action = await showLiquidGlassModalBottomSheet<_ContextAssistantAction>(
      context: context,
      showDragHandle: true,
      sizesToContent: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Update context with AI',
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                ListTile(
                  leading: const Icon(Icons.auto_awesome),
                  title: const Text(
                    'Ask follow-up questions',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'Use the existing guided question flow.',
                  ),
                  onTap: () =>
                      Navigator.of(ctx).pop(_ContextAssistantAction.questions),
                ),
                ListTile(
                  leading: const Icon(Icons.image_outlined),
                  title: const Text(
                    'Upload photos / images',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text('Images are sent directly to the LLM.'),
                  onTap: () =>
                      Navigator.of(ctx).pop(_ContextAssistantAction.photos),
                ),
                ListTile(
                  leading: const Icon(Icons.attach_file),
                  title: const Text(
                    'Upload file / PDF',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: const Text(
                    'PDFs are parsed locally first; password PDFs stay local.',
                  ),
                  onTap: () =>
                      Navigator.of(ctx).pop(_ContextAssistantAction.file),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || action == null) return;
    switch (action) {
      case _ContextAssistantAction.questions:
        await _openPlanner();
      case _ContextAssistantAction.photos:
        await _pickAndUpdateContext(photosOnly: true);
      case _ContextAssistantAction.file:
        await _pickAndUpdateContext(photosOnly: false);
    }
  }

  Future<void> _pickAndUpdateContext({required bool photosOnly}) async {
    final result = await FilePicker.pickFiles(
      withData: true,
      allowMultiple: photosOnly,
      type: photosOnly ? FileType.image : FileType.any,
    );
    if (!mounted || result == null || result.files.isEmpty) return;
    await _updateContextFromFiles(List<PlatformFile>.from(result.files));
  }

  Future<void> _updateContextFromFiles(List<PlatformFile> files) async {
    final m = widget.model;
    final key = m.apiKeyFor(m.activeLlmProvider);
    if (key == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add an API key in Settings → API keys first.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Reading file locally…'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 1),
      ),
    );

    try {
      final bundle = await ingestPlatformFiles(
        files: files,
        requestPdfPassword: _requestPdfPassword,
      );

      final def = internalAppAgentDefinitionById(widget._plannerAgentId);
      final userInstructions = m
          .internalAgentSystemPrompt(widget._plannerAgentId)
          .trim();
      final hints = def?.modelDomainHints.trim() ?? '';
      final system = [
        'You update one context note inside a personal finance app. Reply with ONE JSON object only.',
        'Shape: {"contextMarkdown":"<full updated markdown note>","structured":{"summary":"<short summary>","warnings":["optional strings"]}}',
        'Use the uploaded file/image information to improve the note. Merge with useful existing text; do not discard good prior context.',
        'If the file is not relevant, keep the old note and explain that in structured.summary.',
        '---',
        'User instructions:',
        userInstructions,
        if (hints.isNotEmpty) ...['---', 'Extra hints:', hints],
      ].join('\n');

      final payload = widget
          ._plannerConfig(_ctrl.text)
          .buildPayload(m, const []);
      final user = [
        'Subject/context payload:',
        const JsonEncoder.withIndent('  ').convert(payload),
        '',
        'Uploaded local extraction / image notes:',
        bundle.promptText,
      ].join('\n');

      final raw = await LlmClient().complete(
        provider: m.activeLlmProvider,
        apiKey: key,
        model: m.modelFor(m.activeLlmProvider),
        system: system,
        user: user,
        attachments: bundle.attachments,
        maxOutputTokens: 1800,
        preferJsonObjectOutput: m.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(m, raw);
      final md = obj['contextMarkdown']?.toString().trim();
      if (md == null || md.isEmpty) {
        throw const FormatException(
          'The model did not return contextMarkdown.',
        );
      }
      final structuredRaw = obj['structured'];
      final structured = structuredRaw is Map
          ? Map<String, Object?>.from(structuredRaw)
          : <String, Object?>{'summary': 'Updated from uploaded file.'};

      if (!mounted) return;
      setState(() => _ctrl.text = md);
      widget.onSave(md);
      widget.model.recordInternalAgentRun(widget._plannerAgentId, structured);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            structured['summary']?.toString().trim().isNotEmpty == true
                ? 'Saved: ${structured['summary']}'
                : 'Context updated and saved',
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 5),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<String?> _requestPdfPassword(String fileName) async {
    final ctrl = TextEditingController();
    try {
      return showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) {
          return AlertDialog(
            title: const Text('PDF password'),
            content: TextField(
              controller: ctrl,
              autofocus: true,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Password for $fileName',
                helperText: 'The PDF is decrypted locally on this device.',
              ),
              onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(ctrl.text.trim()),
                child: const Text('Continue'),
              ),
            ],
          );
        },
      );
    } finally {
      ctrl.dispose();
    }
  }

  String get _fieldHint => switch (widget.kind) {
    ContextKind.month =>
      'Monthly story for this calendar month — linked to Ledger → Cashflow (same entry as Split / month rows). '
          'Use this so assistants and future-you understand what drove spending.',
    ContextKind.asset ||
    ContextKind.liability ||
    ContextKind.bucket => 'Add notes the chat/agents can use later…',
  };

  Widget _buildPreviewBody() {
    final md = _markdownFromModel();
    final theme = Theme.of(context);
    if (md.trim().isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.article_outlined,
                size: 48,
                color: theme.colorScheme.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No context note yet',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Add notes assistants can use when helping with this item.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _openEdit,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Add note'),
              ),
            ],
          ),
        ),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: ContextMarkdownView(markdown: md),
    );
  }

  Widget _previewAssistantBar() {
    if (!widget._hasPlanner) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _openAssistantOptions,
              icon: const Icon(Icons.auto_awesome_outlined, size: 18),
              label: const Text('Update with AI'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _openEdit,
              icon: const Icon(Icons.edit_outlined, size: 18),
              label: const Text('Edit'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.model,
      builder: (context, _) {
        return PopScope(
          canPop: !_editing,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop || !_editing) return;
            _leaveEditIfAllowed();
          },
          child: Scaffold(
            resizeToAvoidBottomInset: true,
            appBar: AppBar(
              leading: _editing
                  ? IconButton(
                      icon: const Icon(Icons.arrow_back),
                      onPressed: _leaveEditIfAllowed,
                    )
                  : null,
              title: Text(widget.title),
              actions: _editing
                  ? [
                      if (widget._hasPlanner)
                        IconButton(
                          tooltip: 'Assistant',
                          icon: const Icon(Icons.auto_awesome),
                          onPressed: _openAssistantOptions,
                        ),
                      TextButton(onPressed: _save, child: const Text('Save')),
                    ]
                  : [
                      TextButton(onPressed: _openEdit, child: const Text('Edit')),
                    ],
            ),
            body: SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: _editing
                        ? Padding(
                            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                            child: SizedBox.expand(
                              child: TextField(
                                controller: _ctrl,
                                expands: true,
                                maxLines: null,
                                minLines: null,
                                keyboardType: TextInputType.multiline,
                                textAlignVertical: TextAlignVertical.top,
                                decoration: InputDecoration(
                                  border: const OutlineInputBorder(),
                                  hintText: _fieldHint,
                                  contentPadding: const EdgeInsets.all(12),
                                  isDense: false,
                                ),
                              ),
                            ),
                          )
                        : _buildPreviewBody(),
                  ),
                  if (!_editing) _previewAssistantBar(),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
