import 'dart:convert';

import '../state/app_model.dart';
import '../state/monthly_cashflow_entry.dart';

final _fence = RegExp(r'```zoro_actions\s*([\s\S]*?)```', multiLine: true);

bool _perm(AppAgent agent, AgentDomain domain, AgentAccess access) {
  return agent.permissions.contains(AgentPermission(domain: domain, access: access));
}

/// Explains how the model can emit machine-readable updates (stripped before display).
String agentActionsSystemAppend(AppAgent agent) {
  final canWrite = AgentDomain.values.any((d) => _perm(agent, d, AgentAccess.write));
  if (!canWrite) {
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
  if (domains.isEmpty) return '';

  return '''

### Ledger writes (optional)
You have **write** permission for some domains. Only when the user explicitly asks you to **change** their ledger data, append **one** fenced block at the **very end** of your reply:

```zoro_actions
{"actions":[{"op":"…","…":…}]}
```

Allowed operations (omit the block if no data should change):
${domains.map((s) => '- $s').join('\n')}

Rules:
- Use only operations allowed above. Use **display-currency** amounts consistent with the user's ledger.
- For `set_expense_bucket`, `key` must match an existing expense bucket key (e.g. housing, food).
- For `month_key`, use `YYYY-MM` (e.g. 2026-04).
- `index` for income lines is 0-based.
- If unsure or the user did not ask for a change, **do not** include the block.
''';
}

/// Returns user-visible text (fence removed) and human-readable apply result lines.
({String visibleText, String? applySummary}) processAgentActions({
  required String rawReply,
  required AppAgent agent,
  required AppModel model,
}) {
  RegExpMatch? match;
  for (final m in _fence.allMatches(rawReply)) {
    match = m;
  }
  if (match == null) {
    return (visibleText: rawReply.trim(), applySummary: null);
  }
  final jsonStr = match.group(1)?.trim() ?? '';
  String visible = rawReply.replaceFirst(match.group(0)!, '').trim();
  // Collapse excessive newlines left by removing the fence
  visible = visible.replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();

  List<dynamic>? actions;
  try {
    final decoded = jsonDecode(jsonStr);
    if (decoded is Map && decoded['actions'] is List) {
      actions = decoded['actions'] as List<dynamic>;
    }
  } catch (_) {
    return (
      visibleText: rawReply.trim(),
      applySummary: 'Could not apply ledger changes (invalid JSON in zoro_actions).',
    );
  }
  if (actions == null || actions.isEmpty) {
    return (visibleText: visible.isEmpty ? rawReply.trim() : visible, applySummary: null);
  }

  final errors = <String>[];
  var applied = 0;
  for (final raw in actions) {
    if (raw is! Map) continue;
    final op = raw['op']?.toString();
    if (op == null) continue;
    try {
      final ok = _applyOne(op, Map<String, dynamic>.from(raw), agent: agent, model: model);
      if (ok) {
        applied++;
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
    if (applied > 0) parts.add('Applied $applied change(s) to your local ledger.');
    if (errors.isNotEmpty) parts.addAll(errors);
    summary = parts.join('\n');
  }
  return (visibleText: visible.isEmpty ? rawReply.trim() : visible, applySummary: summary);
}

bool _applyOne(String op, Map<String, dynamic> a, {required AppAgent agent, required AppModel model}) {
  switch (op) {
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
