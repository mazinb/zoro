import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../finance/currency.dart';
import '../state/app_model.dart';
import '../state/monthly_cashflow_entry.dart';

void _logActions(String message) {
  if (kDebugMode) {
    debugPrint('[ZoroActions] $message');
  }
}

/// Models vary: allow spaces after ```, optional newline, case-insensitive label.
final _fence = RegExp(
  r'```\s*zoro_actions\s*\n?([\s\S]*?)```',
  multiLine: true,
  caseSensitive: false,
);

/// Strip optional inner ``` / ```json wrapper inside a zoro_actions fence.
String _unwrapInnerCodeFence(String raw) {
  var s = raw.trim();
  if (!s.startsWith('```')) return s;
  final lines = s.split('\n');
  if (lines.length < 2) return s;
  if (!lines.first.trim().startsWith('```')) return s;
  lines.removeAt(0);
  while (lines.isNotEmpty && lines.last.trim() == '```') {
    lines.removeLast();
  }
  return lines.join('\n').trim();
}

bool _perm(AppAgent agent, AgentDomain domain, AgentAccess access) {
  return agent.permissions.contains(AgentPermission(domain: domain, access: access));
}

/// Explains how the model can emit machine-readable updates (stripped before display).
String agentActionsSystemAppend(AppAgent agent) {
  final canWrite = AgentDomain.values.any((d) => _perm(agent, d, AgentAccess.write));
  final home = agent.toolHomeSummary;
  if (!canWrite && !home) {
    return '';
  }
  final domains = <String>[];
  if (_perm(agent, AgentDomain.expenses, AgentAccess.write)) {
    domains.add('expenses: set_expense_bucket {key, monthly}, set_expense_estimates_updated {}');
  }
  if (_perm(agent, AgentDomain.income, AgentAccess.write)) {
    domains.add(
      'income: set_effective_tax_rate_pct {pct}, set_income_line_by_index {index, label?, annual_amount?}',
    );
  }
  if (_perm(agent, AgentDomain.assets, AgentAccess.write)) {
    domains.add('assets: set_asset_total {id, total}');
  }
  if (_perm(agent, AgentDomain.liabilities, AgentAccess.write)) {
    domains.add('liabilities: set_liability_total {id, total}');
  }
  if (_perm(agent, AgentDomain.cashflow, AgentAccess.write)) {
    domains.add(
      'cashflow: upsert_monthly_cashflow {month_key, opening_balance?, closing_balance?, outflow_to_cash_fd?, outflow_to_invested?, monthly_spending?}, '
      'set_alloc_invest_fraction {fraction}, set_allocation_investments_monthly {amount}, set_allocation_savings_monthly {amount}',
    );
  }
  if (_perm(agent, AgentDomain.projection, AgentAccess.write)) {
    domains.add(
      'projection: set_fx_usd_per_unit {currency: "thb"|"inr", usd_per_unit}, '
      'set_projection_rates {currency: "usd"|"thb"|"inr", invest_pct?, savings_pct?, inflation_pct?} — percents are annual (e.g. 7 = 7%)',
    );
  }
  if (domains.isEmpty && !home) {
    return '';
  }

  final allowed = <String>[
    ...domains.map((s) => '- $s'),
    if (home)
      '- home: set_home_summary {text} — replaces the short Home summary card (plain text or light markdown).',
  ];

  return '''

### App actions (optional)
When the user (or schedule) asks you to **update** saved app state, append **one** fenced block at the **very end** of your reply:

```zoro_actions
{"actions":[{"op":"…","…":…}]}
```

Allowed operations (omit the block if nothing should change):
${allowed.join('\n')}

Rules:
- Use only operations listed above. Use **display-currency** amounts consistent with the user's ledger.
- For `set_expense_bucket`, `key` must match an existing expense bucket key (e.g. housing, food).
- For `month_key`, use `YYYY-MM` (e.g. 2026-04).
- `index` for income lines is 0-based.
- For `set_home_summary`, keep `text` short (roughly tweet-length to one screen); no fabricated quotes.
- If unsure or no update was requested, **do not** include the block.
''';
}

/// Returns user-visible text (fence removed), apply summary, and whether Home summary was set via [set_home_summary].
({String visibleText, String? applySummary, bool homeSummaryApplied}) processAgentActions({
  required String rawReply,
  required AppAgent agent,
  required AppModel model,
}) {
  RegExpMatch? match;
  for (final m in _fence.allMatches(rawReply)) {
    match = m;
  }
  if (match == null) {
    _logActions(
      'no zoro_actions fence matched replyLen=${rawReply.length} agentToolHome=${agent.toolHomeSummary}',
    );
    return (visibleText: rawReply.trim(), applySummary: null, homeSummaryApplied: false);
  }
  _logActions('zoro_actions fence matched');
  var jsonStr = _unwrapInnerCodeFence(match.group(1)?.trim() ?? '');
  _logActions('inner JSON payload len=${jsonStr.length} (after unwrap)');
  String visible = rawReply.replaceFirst(match.group(0)!, '').trim();
  // Collapse excessive newlines left by removing the fence
  visible = visible.replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();

  List<dynamic>? actions;
  try {
    final decoded = jsonDecode(jsonStr);
    if (decoded is Map && decoded['actions'] is List) {
      actions = decoded['actions'] as List<dynamic>;
    }
  } catch (e) {
    _logActions('JSON decode failed: $e snippet="${jsonStr.length > 120 ? jsonStr.substring(0, 120) : jsonStr}"');
    return (
      visibleText: rawReply.trim(),
      applySummary: 'Could not apply app actions (invalid JSON in zoro_actions).',
      homeSummaryApplied: false,
    );
  }
  if (actions == null || actions.isEmpty) {
    _logActions('parsed JSON but actions missing or empty');
    return (
      visibleText: visible.isEmpty ? rawReply.trim() : visible,
      applySummary: null,
      homeSummaryApplied: false,
    );
  }
  _logActions('actions count=${actions.length}');

  final errors = <String>[];
  var applied = 0;
  var homeSummaryApplied = false;
  for (final raw in actions) {
    if (raw is! Map) continue;
    final op = raw['op']?.toString();
    if (op == null) continue;
    try {
      final ok = _applyOne(op, Map<String, dynamic>.from(raw), agent: agent, model: model);
      if (ok) {
        applied++;
        if (op == 'set_home_summary') {
          homeSummaryApplied = true;
        }
      } else {
        errors.add('Skipped: $op (not allowed or bad args)');
      }
    } catch (e) {
      errors.add('$op: $e');
    }
  }

  String? summary;
  if (applied > 0 || errors.isNotEmpty) {
    final parts = <String>[];
    if (applied > 0) parts.add('Applied $applied change(s) in the app.');
    if (errors.isNotEmpty) parts.addAll(errors);
    summary = parts.join('\n');
  }
  _logActions(
    'done applied=$applied homeSummaryApplied=$homeSummaryApplied errors=${errors.length}',
  );
  return (
    visibleText: visible.isEmpty ? rawReply.trim() : visible,
    applySummary: summary,
    homeSummaryApplied: homeSummaryApplied,
  );
}

bool _applyOne(String op, Map<String, dynamic> a, {required AppAgent agent, required AppModel model}) {
  switch (op) {
    case 'set_home_summary':
      if (!agent.toolHomeSummary) return false;
      final text = a['text']?.toString();
      if (text == null || text.trim().isEmpty) return false;
      model.setHomeSummaryText(text.trim());
      return true;
    case 'set_expense_bucket':
      if (!_perm(agent, AgentDomain.expenses, AgentAccess.write)) return false;
      final key = a['key']?.toString();
      final monthly = _asDouble(a['monthly']);
      if (key == null || monthly == null) return false;
      model.setExpenseBucket(key, monthly);
      return true;
    case 'set_expense_estimates_updated':
      if (!_perm(agent, AgentDomain.expenses, AgentAccess.write)) return false;
      model.markExpenseEstimatesUpdated();
      return true;
    case 'set_effective_tax_rate_pct':
      if (!_perm(agent, AgentDomain.income, AgentAccess.write)) return false;
      final pct = _asDouble(a['pct']);
      if (pct == null) return false;
      model.setEffectiveTaxRatePct(pct.clamp(0, 100));
      return true;
    case 'set_income_line_by_index':
      if (!_perm(agent, AgentDomain.income, AgentAccess.write)) return false;
      final idx = a['index'];
      final i = idx is int ? idx : (idx is num ? idx.round() : null);
      if (i == null) return false;
      final label = a['label']?.toString();
      final annual = _asDouble(a['annual_amount']);
      model.updateIncomeLineAt(i, label: label, annualAmount: annual);
      return true;
    case 'set_asset_total':
      if (!_perm(agent, AgentDomain.assets, AgentAccess.write)) return false;
      final id = a['id']?.toString();
      final total = _asDouble(a['total']);
      if (id == null || total == null) return false;
      return model.tryUpdateAssetTotalById(id, total);
    case 'set_liability_total':
      if (!_perm(agent, AgentDomain.liabilities, AgentAccess.write)) return false;
      final id = a['id']?.toString();
      final total = _asDouble(a['total']);
      if (id == null || total == null) return false;
      return model.tryUpdateLiabilityTotalById(id, total);
    case 'upsert_monthly_cashflow':
      if (!_perm(agent, AgentDomain.cashflow, AgentAccess.write)) return false;
      final mk = a['month_key']?.toString();
      if (mk == null || !RegExp(r'^\d{4}-\d{2}$').hasMatch(mk)) return false;
      final existing = model.monthlyEntryFor(mk);
      final opening = _asDouble(a['opening_balance']) ?? existing?.openingBalance ?? 0;
      final closing = _asDouble(a['closing_balance']) ?? existing?.closingBalance ?? 0;
      final cash = _asDouble(a['outflow_to_cash_fd']) ?? existing?.outflowToCashFd ?? 0;
      final inv = _asDouble(a['outflow_to_invested']) ?? existing?.outflowToInvested ?? 0;
      final spend = _asDouble(a['monthly_spending']) ?? existing?.monthlySpending ?? 0;
      model.upsertMonthlyCashflow(
        MonthlyCashflowEntry(
          monthKey: mk,
          openingBalance: opening,
          closingBalance: closing,
          outflowToCashFd: cash,
          outflowToInvested: inv,
          monthlySpending: spend,
          comment: existing?.comment ?? '',
          contextMarkdown: existing?.contextMarkdown,
        ),
      );
      return true;
    case 'set_alloc_invest_fraction':
      if (!_perm(agent, AgentDomain.cashflow, AgentAccess.write)) return false;
      final f = _asDouble(a['fraction']);
      if (f == null) return false;
      model.setAllocInvestFraction(f.clamp(0, 1));
      return true;
    case 'set_allocation_investments_monthly':
      if (!_perm(agent, AgentDomain.cashflow, AgentAccess.write)) return false;
      final v = _asDouble(a['amount']);
      if (v == null) return false;
      model.setAllocationInvestments(v);
      return true;
    case 'set_allocation_savings_monthly':
      if (!_perm(agent, AgentDomain.cashflow, AgentAccess.write)) return false;
      final v = _asDouble(a['amount']);
      if (v == null) return false;
      model.setAllocationSavings(v);
      return true;
    case 'set_fx_usd_per_unit':
      if (!_perm(agent, AgentDomain.projection, AgentAccess.write)) return false;
      final code = a['currency']?.toString().toLowerCase();
      final c = switch (code) {
        'thb' => CurrencyCode.thb,
        'inr' => CurrencyCode.inr,
        _ => null,
      };
      if (c == null) return false;
      final u = _asDouble(a['usd_per_unit']);
      if (u == null || u <= 0) return false;
      model.setFxUsdPerUnitOverride(c, u);
      return true;
    case 'set_projection_rates':
      if (!_perm(agent, AgentDomain.projection, AgentAccess.write)) return false;
      final code = a['currency']?.toString().toLowerCase();
      final c = switch (code) {
        'usd' => CurrencyCode.usd,
        'thb' => CurrencyCode.thb,
        'inr' => CurrencyCode.inr,
        _ => null,
      };
      if (c == null) return false;
      final investPct = _asDouble(a['invest_pct']);
      final savingsPct = _asDouble(a['savings_pct']);
      final inflationPct = _asDouble(a['inflation_pct']);
      if (investPct == null && savingsPct == null && inflationPct == null) return false;
      model.setProjectionRatesForCurrency(
        c,
        investPct: investPct,
        savingsPct: savingsPct,
        inflationPct: inflationPct,
      );
      return true;
    default:
      return false;
  }
}

double? _asDouble(Object? v) {
  if (v == null) return null;
  if (v is double) return v;
  if (v is int) return v.toDouble();
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}
