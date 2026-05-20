import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/llm/active_llm_completion.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';

/// Compares six months of actual spending to recurring expense estimates.
class LedgerExpenseHelperPage extends StatefulWidget {
  const LedgerExpenseHelperPage({super.key, required this.model});

  final AppModel model;

  @override
  State<LedgerExpenseHelperPage> createState() => _LedgerExpenseHelperPageState();
}

class _LedgerExpenseHelperPageState extends State<LedgerExpenseHelperPage> {
  bool _loading = true;
  String? _error;
  String? _message;
  Map<String, double>? _suggestedBuckets;
  double? _avgActual;
  double? _estimated;

  static const _jsonContract = '''
Return ONE JSON object only:
{
  "message": "2-4 sentences comparing actual vs estimate",
  "expenseBuckets": { "housing": 0, "food": 0, "transportation": 0, "healthcare": 0, "entertainment": 0, "other": 0 }
}

expenseBuckets = suggested **monthly** amounts in display currency for each key in payload.bucketKeys. Scale thoughtfully from the six-month actual average — increase or decrease buckets as a set. Use 0 only when a bucket should be cleared.
''';

  @override
  void initState() {
    super.initState();
    _run();
  }

  int _monthsWithSpending() {
    var n = 0;
    for (final mk in AppModel.recentMonthKeys(count: 6)) {
      final e = widget.model.monthlyEntryFor(mk);
      if (e != null && e.monthlySpending > 0.005) n++;
    }
    return n;
  }

  double? _sixMonthAverageSpending() {
    final values = <double>[];
    for (final mk in AppModel.recentMonthKeys(count: 6)) {
      final e = widget.model.monthlyEntryFor(mk);
      if (e != null && e.monthlySpending > 0.005) {
        values.add(e.monthlySpending);
      }
    }
    if (values.isEmpty) return null;
    return values.reduce((a, b) => a + b) / values.length;
  }

  Map<String, Object?> _payload(double avgActual, double estimated) {
    final m = widget.model;
    final preset = presetForCountry(AppModel.expensePresetCountry);
    return {
      'privacyHideAmounts': m.privacyHideAmounts,
      'displayCurrency': m.displayCurrency.name,
      'estimatedMonthlyTotal': estimated,
      'actualMonthlyAverage': avgActual,
      'delta': avgActual - estimated,
      'monthsWithSpending': _monthsWithSpending(),
      'bucketKeys': expenseBucketKeys,
      'currentBuckets': {
        for (final k in expenseBucketKeys)
          k: m.expenseBuckets[k] ?? preset.buckets[k]?.value ?? 0,
      },
      'recentMonths': [
        for (final mk in AppModel.recentMonthKeys(count: 6))
          {
            'monthKey': mk,
            'label': AppModel.formatMonthKeyLabel(mk),
            'monthlySpending': m.monthlyEntryFor(mk)?.monthlySpending ?? 0,
          },
      ],
    };
  }

  String _systemPrompt() {
    final user = widget.model.internalAgentSystemPrompt(InternalAppAgentIds.ledgerOrchestrator).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.ledgerOrchestrator)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You help tune recurring monthly expense **estimates** using six completed months of actual spending.',
      _jsonContract,
      'Rules:',
      '- actualMonthlyAverage is the truth for overall level; currentBuckets are the user\'s estimates.',
      '- If actual average is higher than estimated total, bias bucket suggestions upward (and vice versa).',
      '- Keep bucket keys exactly as in payload.bucketKeys.',
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  Future<void> _run() async {
    final m = widget.model;
    final ready = await m.prepareLlmForAssistant();
    if (!mounted) return;
    if (!ready) {
      setState(() {
        _loading = false;
        _error = m.llmAssistantUnavailableMessage;
      });
      return;
    }

    final months = _monthsWithSpending();
    if (months < 4) {
      setState(() {
        _loading = false;
        _error =
            'Need at least four of the last six completed months with spending in Cash. Import or enter those months first.';
      });
      return;
    }

    final avg = _sixMonthAverageSpending();
    final est = m.recurringExpensesMonthly;
    if (avg == null) {
      setState(() {
        _loading = false;
        _error = 'No spending data in the last six completed months.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _avgActual = avg;
      _estimated = est;
    });

    try {
      final raw = await completeForActiveProvider(
        m,
        system: _systemPrompt(),
        user: jsonEncode(_payload(avg, est)),
        maxOutputTokens: 1800,
        preferJsonObjectOutput: m.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(m, raw);
      final message = obj['message']?.toString().trim();
      final bucketsRaw = obj['expenseBuckets'];
      final suggested = <String, double>{};
      if (bucketsRaw is Map) {
        for (final k in expenseBucketKeys) {
          final v = bucketsRaw[k];
          if (v is num) suggested[k] = v.toDouble();
        }
      }

      m.recordInternalAgentRun(InternalAppAgentIds.ledgerOrchestrator, {
        'summary': message ?? '',
        'actualMonthlyAverage': avg,
        'estimatedMonthlyTotal': est,
      });

      setState(() {
        _loading = false;
        _message = message ?? 'Review the suggested monthly estimates below.';
        _suggestedBuckets = suggested.isEmpty ? null : suggested;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _apply() {
    final buckets = _suggestedBuckets;
    if (buckets == null || buckets.isEmpty) return;
    final m = widget.model;
    for (final e in buckets.entries) {
      m.setExpenseBucket(e.key, e.value);
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Expense estimates updated'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final m = widget.model;
    final hide = m.privacyHideAmounts;
    final avg = _avgActual;
    final est = _estimated;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expense estimates'),
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
                      Text(_error!, style: TextStyle(color: cs.error, height: 1.35)),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _run, child: const Text('Try again')),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (avg != null && est != null && !hide) ...[
                        Text(
                          '6-month average: ${formatCurrencyDisplay(avg, currency: m.displayCurrency)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Your estimates: ${formatCurrencyDisplay(est, currency: m.displayCurrency)}/mo',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
                      Text(
                        _message ?? '',
                        style: TextStyle(
                          color: cs.onSurface,
                          fontWeight: FontWeight.w800,
                          height: 1.35,
                        ),
                      ),
                      if (_suggestedBuckets != null) ...[
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _apply,
                          child: const Text('Apply suggested estimates'),
                        ),
                      ],
                    ],
                  ),
      ),
    );
  }
}
