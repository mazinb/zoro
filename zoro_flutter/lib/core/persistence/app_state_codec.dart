import 'dart:convert';

import '../finance/currency.dart';
import '../state/app_model.dart';
import '../state/cashflow_income_line.dart';
import '../state/ledger_rows.dart';
import '../state/monthly_cashflow_entry.dart';
/// Version of the on-disk JSON envelope (bump when making breaking layout changes).
const int kAppStateFormatVersion = 1;

Object? tryJsonSafeEncode(Object? v) {
  if (v == null) return null;
  try {
    return jsonDecode(jsonEncode(v));
  } catch (_) {
    return v.toString();
  }
}

Map<String, dynamic> encodeLedgerAssetRow(LedgerAssetRow r) => {
      'id': r.id,
      'type': r.type.apiValue,
      'currencyCountry': r.currencyCountry,
      'name': r.name,
      'total': r.total,
      'label': r.label,
      'comment': r.comment,
      if (r.contextMarkdown != null && r.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': r.contextMarkdown,
    };

LedgerAssetRow? decodeLedgerAssetRow(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  return LedgerAssetRow(
    id: id,
    type: LedgerAssetTypeUi.fromApi(m['type']?.toString()),
    currencyCountry: m['currencyCountry']?.toString() ?? 'Thailand',
    name: m['name']?.toString() ?? '',
    total: (m['total'] is num) ? (m['total'] as num).toDouble() : double.tryParse(m['total']?.toString() ?? '') ?? 0,
    label: m['label']?.toString() ?? '',
    comment: m['comment']?.toString() ?? '',
    contextMarkdown: m['contextMarkdown']?.toString(),
  );
}

Map<String, dynamic> encodeLedgerLiabilityRow(LedgerLiabilityRow r) => {
      'id': r.id,
      'type': r.type.apiValue,
      'name': r.name,
      'currencyCountry': r.currencyCountry,
      'total': r.total,
      'comment': r.comment,
      if (r.contextMarkdown != null && r.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': r.contextMarkdown,
    };

LedgerLiabilityRow? decodeLedgerLiabilityRow(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  return LedgerLiabilityRow(
    id: id,
    type: LedgerLiabilityTypeUi.fromApi(m['type']?.toString()),
    name: m['name']?.toString() ?? '',
    currencyCountry: m['currencyCountry']?.toString() ?? 'Thailand',
    total: (m['total'] is num) ? (m['total'] as num).toDouble() : double.tryParse(m['total']?.toString() ?? '') ?? 0,
    comment: m['comment']?.toString() ?? '',
    contextMarkdown: m['contextMarkdown']?.toString(),
  );
}

Map<String, dynamic> encodeIncomeLine(CashflowIncomeLine r) => {
      'id': r.id,
      'label': r.label,
      'annualAmount': r.annualAmount,
      'currencyCountry': r.currencyCountry,
    };

CashflowIncomeLine? decodeIncomeLine(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  return CashflowIncomeLine(
    id: id,
    label: m['label']?.toString() ?? '',
    annualAmount:
        (m['annualAmount'] is num) ? (m['annualAmount'] as num).toDouble() : double.tryParse(m['annualAmount']?.toString() ?? '') ?? 0,
    currencyCountry: m['currencyCountry']?.toString() ?? 'Thailand',
  );
}

Map<String, dynamic> encodeMonthlyInvestmentLine(MonthlyInvestmentLine l) => {
      'id': l.id,
      if (l.assetId != null) 'assetId': l.assetId,
      'amount': l.amount,
      if (l.contextMarkdown != null && l.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': l.contextMarkdown,
      'amountAppliedToAssets': l.amountAppliedToAssets,
    };

MonthlyInvestmentLine? decodeMonthlyInvestmentLine(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  return MonthlyInvestmentLine(
    id: id,
    assetId: m['assetId']?.toString(),
    amount: (m['amount'] is num) ? (m['amount'] as num).toDouble() : double.tryParse(m['amount']?.toString() ?? '') ?? 0,
    contextMarkdown: m['contextMarkdown']?.toString(),
    amountAppliedToAssets: (m['amountAppliedToAssets'] is num)
        ? (m['amountAppliedToAssets'] as num).toDouble()
        : double.tryParse(m['amountAppliedToAssets']?.toString() ?? '') ?? 0,
  );
}

Map<String, dynamic> encodeMonthlyCashflowEntry(MonthlyCashflowEntry e) => {
      'monthKey': e.monthKey,
      'openingBalance': e.openingBalance,
      'closingBalance': e.closingBalance,
      'monthlyEarned': e.monthlyEarned,
      'outflowToCashFd': e.outflowToCashFd,
      'outflowToInvested': e.outflowToInvested,
      'monthlySpending': e.monthlySpending,
      'comment': e.comment,
      if (e.contextMarkdown != null && e.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': e.contextMarkdown,
      'investmentLines': e.investmentLines.map(encodeMonthlyInvestmentLine).toList(),
    };

MonthlyCashflowEntry? decodeMonthlyCashflowEntry(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final mk = m['monthKey']?.toString();
  if (mk == null) return null;
  final linesRaw = m['investmentLines'];
  final lines = <MonthlyInvestmentLine>[];
  if (linesRaw is List) {
    for (final e in linesRaw) {
      final l = decodeMonthlyInvestmentLine(e);
      if (l != null) lines.add(l);
    }
  }
  return MonthlyCashflowEntry(
    monthKey: mk,
    openingBalance:
        (m['openingBalance'] is num) ? (m['openingBalance'] as num).toDouble() : double.tryParse(m['openingBalance']?.toString() ?? '') ?? 0,
    closingBalance:
        (m['closingBalance'] is num) ? (m['closingBalance'] as num).toDouble() : double.tryParse(m['closingBalance']?.toString() ?? '') ?? 0,
    monthlyEarned:
        (m['monthlyEarned'] is num) ? (m['monthlyEarned'] as num).toDouble() : double.tryParse(m['monthlyEarned']?.toString() ?? '') ?? 0,
    outflowToCashFd: (m['outflowToCashFd'] is num)
        ? (m['outflowToCashFd'] as num).toDouble()
        : double.tryParse(m['outflowToCashFd']?.toString() ?? '') ?? 0,
    outflowToInvested: (m['outflowToInvested'] is num)
        ? (m['outflowToInvested'] as num).toDouble()
        : double.tryParse(m['outflowToInvested']?.toString() ?? '') ?? 0,
    monthlySpending: (m['monthlySpending'] is num)
        ? (m['monthlySpending'] as num).toDouble()
        : double.tryParse(m['monthlySpending']?.toString() ?? '') ?? 0,
    comment: m['comment']?.toString() ?? '',
    contextMarkdown: m['contextMarkdown']?.toString(),
    investmentLines: lines,
  );
}

DateTime? dateTimeFromJsonField(Object? v) {
  if (v == null) return null;
  if (v is int) return DateTime.fromMillisecondsSinceEpoch(v, isUtc: true);
  if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.round(), isUtc: true);
  if (v is String) return DateTime.tryParse(v);
  return null;
}

Map<String, dynamic> encodeProjectionMap(Map<CurrencyCode, double> m) => {
      for (final e in m.entries) e.key.name: e.value,
    };

void decodeProjectionMap(Map<CurrencyCode, double> target, Object? raw) {
  if (raw is! Map) return;
  for (final e in raw.entries) {
    final name = e.key.toString();
    CurrencyCode? c;
    for (final x in CurrencyCode.values) {
      if (x.name == name) {
        c = x;
        break;
      }
    }
    if (c == null) continue;
    final v = e.value;
    final d = v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '');
    if (d != null) target[c] = d;
  }
}

ReminderCadence reminderCadenceFromJson(Object? v) {
  final s = v?.toString();
  if (s == null) return ReminderCadence.off;
  for (final x in ReminderCadence.values) {
    if (x.name == s) return x;
  }
  return ReminderCadence.off;
}

AgentChatLlmOverride _parseChatLlmOverride(String? s) {
  if (s == null || s.isEmpty) return AgentChatLlmOverride.useDefault;
  for (final v in AgentChatLlmOverride.values) {
    if (v.name == s) return v;
  }
  if (s == 'local') return AgentChatLlmOverride.useDefault;
  return AgentChatLlmOverride.useDefault;
}

/// Thread JSON shape used by [AppStateStore] `chats` section (v1–2).
Map<String, dynamic> encodeChatThread(AgentChatThread t) => {
      'id': t.id,
      'agentId': t.agentId,
      'title': t.title,
      'createdAtMs': t.createdAt.millisecondsSinceEpoch,
      'updatedAtMs': t.updatedAt.millisecondsSinceEpoch,
      'messageCount': t.messageCount,
      'tokensUsed': t.tokensUsed,
      'lastLine': t.lastLine,
      'llmOverride': t.llmOverride.name,
      if (t.modelOverride != null) 'modelOverride': t.modelOverride,
      if (t.systemPromptSuffix != null && t.systemPromptSuffix!.trim().isNotEmpty) 'systemPromptSuffix': t.systemPromptSuffix,
      if (t.enabledToolIds != null && t.enabledToolIds!.isNotEmpty) 'enabledToolIds': t.enabledToolIds,
    };

AgentChatThread? decodeChatThread(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  final agentId = m['agentId']?.toString();
  final title = m['title']?.toString();
  if (id == null || agentId == null || title == null) return null;
  int ms(String k, int fallback) {
    final v = m[k];
    if (v is int) return v;
    if (v is num) return v.round();
    return fallback;
  }

  final now = DateTime.now();
  List<String>? toolIds;
  final ti = m['enabledToolIds'];
  if (ti is List) {
    toolIds = ti.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
  }
  return AgentChatThread(
    id: id,
    agentId: agentId,
    title: title,
    createdAt: DateTime.fromMillisecondsSinceEpoch(ms('createdAtMs', now.millisecondsSinceEpoch)),
    updatedAt: DateTime.fromMillisecondsSinceEpoch(ms('updatedAtMs', now.millisecondsSinceEpoch)),
    messageCount: m['messageCount'] is int ? m['messageCount'] as int : (m['messageCount'] is num ? (m['messageCount'] as num).round() : 0),
    tokensUsed: m['tokensUsed'] is int ? m['tokensUsed'] as int : (m['tokensUsed'] is num ? (m['tokensUsed'] as num).round() : 0),
    lastLine: m['lastLine']?.toString() ?? '',
    llmOverride: _parseChatLlmOverride(m['llmOverride']?.toString()),
    modelOverride: m['modelOverride']?.toString(),
    systemPromptSuffix: m['systemPromptSuffix']?.toString(),
    enabledToolIds: toolIds,
  );
}

Map<String, dynamic> encodeNotificationsBlock(AppModel m) {
  int? toMs(DateTime? d) => d?.toUtc().millisecondsSinceEpoch;
  return {
    'enabled': m.notificationsEnabled,
    'reminderHour': m.reminderNotifyHour,
    'reminderMinute': m.reminderNotifyMinute,
    if (toMs(m.remindersLastNotifiedExpenses) != null) 'lastExpensesMs': toMs(m.remindersLastNotifiedExpenses),
    if (toMs(m.remindersLastNotifiedCashflow) != null) 'lastCashflowMs': toMs(m.remindersLastNotifiedCashflow),
    if (toMs(m.remindersLastNotifiedIncome) != null) 'lastIncomeMs': toMs(m.remindersLastNotifiedIncome),
    if (toMs(m.remindersLastNotifiedAssets) != null) 'lastAssetsMs': toMs(m.remindersLastNotifiedAssets),
    if (toMs(m.remindersLastNotifiedLiabilities) != null) 'lastLiabilitiesMs': toMs(m.remindersLastNotifiedLiabilities),
    'userTouchedExpenses': m.userTouchedExpenses,
    'userTouchedIncome': m.userTouchedIncome,
    'userTouchedAssets': m.userTouchedAssets,
    'userTouchedLiabilities': m.userTouchedLiabilities,
  };
}

void decodeNotificationsBlock(AppModel m, Object? raw) {
  if (raw is! Map) return;
  final n = Map<String, dynamic>.from(raw);
  m.notificationsEnabled = n['enabled'] == true;
  final rh = n['reminderHour'];
  final rm = n['reminderMinute'];
  if (rh is int) m.reminderNotifyHour = rh.clamp(0, 23);
  if (rh is num) m.reminderNotifyHour = rh.round().clamp(0, 23);
  if (rm is int) m.reminderNotifyMinute = rm.clamp(0, 59);
  if (rm is num) m.reminderNotifyMinute = rm.round().clamp(0, 59);
  m.remindersLastNotifiedExpenses = dateTimeFromJsonField(n['lastExpensesMs']);
  m.remindersLastNotifiedCashflow = dateTimeFromJsonField(n['lastCashflowMs']);
  m.remindersLastNotifiedIncome = dateTimeFromJsonField(n['lastIncomeMs']);
  m.remindersLastNotifiedAssets = dateTimeFromJsonField(n['lastAssetsMs']);
  m.remindersLastNotifiedLiabilities = dateTimeFromJsonField(n['lastLiabilitiesMs']);
  if (n['userTouchedExpenses'] == true) m.userTouchedExpenses = true;
  if (n['userTouchedIncome'] == true) m.userTouchedIncome = true;
  if (n['userTouchedAssets'] == true) m.userTouchedAssets = true;
  if (n['userTouchedLiabilities'] == true) m.userTouchedLiabilities = true;
}
