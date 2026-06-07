import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
enum LedgerOrchestratorSection { assets, liabilities, expenses }

class LedgerOrchestratorPage extends StatefulWidget {
  const LedgerOrchestratorPage({
    super.key,
    required this.model,
    required this.onPickSection,
  });

  final AppModel model;
  final void Function(LedgerOrchestratorSection section) onPickSection;

  @override
  State<LedgerOrchestratorPage> createState() => _LedgerOrchestratorPageState();
}

class _LedgerOrchestratorPageState extends State<LedgerOrchestratorPage> {
  bool _loading = true;
  String? _error;
  String? _message;
  LedgerOrchestratorSection? _section;

  static const _system = '''
You are the Ledger orchestrator in a personal finance app.

You must reply with ONE JSON object only.

Pick the best completed month for the user to fill actual spending:
{
  "section": "expenses",
  "message": "one short sentence explaining why"
}

Rules:
- Always return section "expenses".
- If privacyHideAmounts is true, still choose a section; do not ask for numbers.
- `recentMonths` is **six completed calendar months**, newest-first = **previous month** (e.g. in May, April is index 0). Month-to-date is not included.
- Prefer the most recent completed month that is missing or obviously stale spending data.
''';

  @override
  void initState() {
    super.initState();
    _run();
  }

  Map<String, Object?> _payload() {
    final m = widget.model;
    return {
      'privacyHideAmounts': m.privacyHideAmounts,
      'displayCurrency': m.displayCurrency.name,
      'assets': [
        for (final a in m.assets)
          {
            'id': a.id,
            'type': a.type.apiValue,
            'name': a.name,
            'total': m.assetDisplayValue(a),
          }
      ],
      'liabilities': [
        for (final l in m.liabilities)
          {
            'id': l.id,
            'type': l.type.apiValue,
            'name': l.name,
            'total': l.total,
          }
      ],
      'recentMonths': [
        for (final mk in AppModel.recentMonthKeys(count: 6))
          {
            'monthKey': mk,
            'monthlySpending': m.monthlyEntryFor(mk)?.monthlySpending,
          }
      ],
      'note':
          'recentMonths: six completed months; first entry is previous calendar month (not current month-to-date).',
    };
  }

  String _systemPrompt() {
    final user = widget.model.internalAgentSystemPrompt(InternalAppAgentIds.ledgerOrchestrator).trim();
    return '$_system\n\n---\n\nUser instructions:\n$user\n';
  }

  Future<void> _run() async {
    final m = widget.model;
    final ready = await m.prepareLlmForAssistant(
      requestConsent: LlmConsentGate.requester(context, m),
    );
    if (!mounted) return;
    if (!ready) {
      setState(() {
        _loading = false;
        _error = m.llmAssistantUnavailableMessage;
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final raw = await completeForActiveProvider(
        m,
        system: _systemPrompt(),
        user: jsonEncode(_payload()),
        maxOutputTokens: 1200,
        preferJsonObjectOutput: m.activeLlmProvider == LlmProvider.openai,
      );

      final obj = await decodeActiveProviderJsonWithRepair(m, raw);
      final message = obj['message']?.toString().trim();
      const s = LedgerOrchestratorSection.expenses;

      widget.model.recordInternalAgentRun(InternalAppAgentIds.ledgerOrchestrator, {
        'summary': message ?? '',
      });

      setState(() {
        _loading = false;
        _section = s;
        _message = message ?? 'Suggested next step.';
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _go() {
    final s = _section;
    if (s == null) return;
    widget.onPickSection(s);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(_message ?? 'Ok'), behavior: SnackBarBehavior.floating),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cashflow helper'),
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
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontWeight: FontWeight.w800,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _go, child: const Text('Go')),
                    ],
                  ),
      ),
    );
  }
}

