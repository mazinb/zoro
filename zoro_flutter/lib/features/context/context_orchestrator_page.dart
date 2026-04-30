import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_json.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/theme/app_theme.dart';
import 'context_editor_page.dart';

class ContextOrchestratorPage extends StatefulWidget {
  const ContextOrchestratorPage({super.key, required this.model});

  final AppModel model;

  @override
  State<ContextOrchestratorPage> createState() => _ContextOrchestratorPageState();
}

class _ContextOrchestratorPageState extends State<ContextOrchestratorPage> {
  final _llm = LlmClient();
  bool _loading = true;
  String? _error;
  String? _message;

  String? _targetKind; // asset | liability | bucket | month
  String? _targetId; // id or key

  static const _system = '''
You are the Context orchestrator in a personal finance app.

Reply with ONE JSON object only:
{
  "targetKind": "asset" | "liability" | "bucket" | "month",
  "targetId": "<id or key>",
  "message": "one short sentence explaining why"
}

Rules:
- Pick ONE best next context note to improve.\n- Prefer missing basics: brokerage breakdown, missing loan rate/payment, unclear bucket boundaries, or a recent month with no note.\n- Use contextLastUpdated times to find what is stale.\n''';

  @override
  void initState() {
    super.initState();
    _run();
  }

  Map<String, Object?> _payload() {
    final m = widget.model;
    return {
      'privacyHideAmounts': m.privacyHideAmounts,
      'assets': [
        for (final a in m.assets)
          {
            'id': a.id,
            'type': a.type.apiValue,
            'name': a.name,
            'total': a.total,
            'contextMarkdown': (a.contextMarkdown ?? '').trim(),
            'contextLastUpdated': m.contextNoteLastUpdatedIso(AppModel.contextKeyAsset(a.id)),
          }
      ],
      'liabilities': [
        for (final l in m.liabilities)
          {
            'id': l.id,
            'type': l.type.apiValue,
            'name': l.name,
            'total': l.total,
            'contextMarkdown': (l.contextMarkdown ?? '').trim(),
            'contextLastUpdated': m.contextNoteLastUpdatedIso(AppModel.contextKeyLiability(l.id)),
          }
      ],
      'expenseBuckets': [
        for (final k in m.expenseBucketContextMarkdown.keys)
          {
            'key': k,
            'contextMarkdown': (m.expenseBucketContextMarkdown[k] ?? '').trim(),
            'contextLastUpdated': m.contextNoteLastUpdatedIso(AppModel.contextKeyBucket(k)),
          }
      ],
      'months': [
        for (final mk in AppModel.recentMonthKeys())
          {
            'monthKey': mk,
            'contextMarkdown': (m.monthlyEntryFor(mk)?.contextMarkdown ?? '').trim(),
            'contextLastUpdated': m.contextNoteLastUpdatedIso(AppModel.contextKeyMonth(mk)),
          }
      ],
    };
  }

  String _systemPrompt() {
    final user = widget.model.internalAgentSystemPrompt(InternalAppAgentIds.contextOrchestrator).trim();
    return '$_system\n\n---\n\nUser instructions:\n$user\n';
  }

  Future<void> _run() async {
    final provider = widget.model.activeLlmProvider;
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      setState(() {
        _loading = false;
        _error = 'Add an API key in Settings → Permissions';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final raw = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: widget.model.modelFor(provider),
        system: _systemPrompt(),
        user: jsonEncode(_payload()),
        maxOutputTokens: 1300,
        preferJsonObjectOutput: provider == LlmProvider.openai,
      );

      final obj = decodeLlmJsonObject(raw);
      final kind = obj['targetKind']?.toString().trim().toLowerCase();
      final id = obj['targetId']?.toString().trim();
      final message = obj['message']?.toString().trim();

      if (kind == null || id == null || id.isEmpty) {
        setState(() {
          _loading = false;
          _error = 'Unexpected reply. Try again.';
        });
        return;
      }

      widget.model.recordInternalAgentRun(InternalAppAgentIds.contextOrchestrator, {
        'summary': message ?? '',
      });

      setState(() {
        _loading = false;
        _targetKind = kind;
        _targetId = id;
        _message = message ?? 'Suggested next update.';
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _go() {
    final kind = _targetKind;
    final id = _targetId;
    if (kind == null || id == null) return;

    Widget? page;
    switch (kind) {
      case 'asset':
        page = ContextEditorPage.asset(model: widget.model, assetId: id);
        break;
      case 'liability':
        page = ContextEditorPage.liability(model: widget.model, liabilityId: id);
        break;
      case 'bucket':
        page = ContextEditorPage.expenseBucket(model: widget.model, bucketKey: id);
        break;
      case 'month':
        page = ContextEditorPage.month(model: widget.model, monthKey: id);
        break;
    }

    if (page == null) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_message ?? 'Ok'), behavior: SnackBarBehavior.floating),
    );
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (ctx) => page!),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Context helper'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _run, child: const Text('Try again')),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _message ?? '',
                        style: const TextStyle(color: AppTheme.slate900, fontWeight: FontWeight.w800, height: 1.35),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _go, child: const Text('Go')),
                    ],
                  ),
      ),
    );
  }
}

