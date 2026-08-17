import 'package:flutter/material.dart';

import '../../core/agent/document_store.dart';
import '../../core/agent/hermes_home_paths.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/context_markdown_view.dart';

class RetirementPlanEditorPage extends StatefulWidget {
  const RetirementPlanEditorPage({super.key, required this.model});

  final AppModel model;

  @override
  State<RetirementPlanEditorPage> createState() => _RetirementPlanEditorPageState();
}

class _RetirementPlanEditorPageState extends State<RetirementPlanEditorPage> {
  late final TextEditingController _ctrl;
  late final TextEditingController _reasonCtrl;
  bool _preview = true;
  bool _busy = false;
  List<DocRevisionMeta> _revs = [];

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.model.retirementMarkdownCache);
    _reasonCtrl = TextEditingController(text: 'manual edit');
    _loadRevs();
  }

  Future<void> _loadRevs() async {
    final revs = await widget.model.agentWorkspace.documents?.listRevs(HermesHomePaths.retirementDocId) ?? [];
    if (mounted) setState(() => _revs = revs);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final reason = _reasonCtrl.text.trim().isEmpty ? 'manual edit' : _reasonCtrl.text.trim();
      await widget.model.commitRetirementPlan(markdown: _ctrl.text, reason: reason);
      await _loadRevs();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Plan saved as a new revision.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openRev(DocRevisionMeta meta) async {
    final store = widget.model.agentWorkspace.documents;
    if (store == null) return;
    final body = await store.readRev(HermesHomePaths.retirementDocId, meta.rev) ??
        (meta.rev == (await store.entryFor(HermesHomePaths.retirementDocId))?.headRev
            ? await store.readHead(HermesHomePaths.retirementDocId)
            : null);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Revision ${meta.rev}'),
        content: SizedBox(
          width: 480,
          height: 420,
          child: SingleChildScrollView(
            child: SelectableText(body ?? '(missing file)'),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
          if ((body ?? '').trim().isNotEmpty)
            TextButton(
              onPressed: () {
                _ctrl.text = body!;
                Navigator.pop(ctx);
                setState(() => _preview = false);
              },
              child: const Text('Restore into editor'),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Retirement plan'),
        actions: [
          IconButton(
            tooltip: _preview ? 'Edit' : 'Preview',
            onPressed: () => setState(() => _preview = !_preview),
            icon: Icon(_preview ? Icons.edit_outlined : Icons.visibility_outlined),
          ),
          TextButton(
            onPressed: _busy ? null : _save,
            child: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          TextField(
            controller: _reasonCtrl,
            decoration: const InputDecoration(
              labelText: 'Why this change',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (_preview)
            ContextMarkdownView(markdown: _ctrl.text)
          else
            TextField(
              controller: _ctrl,
              maxLines: 22,
              minLines: 14,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 13, height: 1.4),
              decoration: const InputDecoration(border: OutlineInputBorder(), alignLabelWithHint: true),
            ),
          const SizedBox(height: 20),
          Text('History', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
          const SizedBox(height: 8),
          if (_revs.isEmpty)
            Text('No prior revisions.', style: TextStyle(color: cs.onSurfaceVariant))
          else
            for (final r in _revs)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text('Rev ${r.rev} · ${r.author}', style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                  '${r.reason}\n${r.utc.toLocal()}',
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
                ),
                isThreeLine: true,
                onTap: () => _openRev(r),
              ),
        ],
      ),
    );
  }
}
