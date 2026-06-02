import 'dart:convert';

import '../finance/currency.dart';
import '../finance/historical_returns.dart';
import '../state/app_model.dart';
import '../state/cashflow_income_line.dart';
import '../state/financial_goals.dart';
import '../state/ledger_rows.dart';
import '../state/monthly_cashflow_entry.dart';
/// JSON schema version inside each split file and portable exports. Documented in `zoro-app/README.md`.
/// Bump when field semantics change (not when only adding optional keys).
const int kAppStateFormatVersion = 3;

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
      'returnRatePct': r.returnRatePct,
      if (r.contextMarkdown != null && r.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': r.contextMarkdown,
    };

LedgerAssetRow? decodeLedgerAssetRow(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  final rr = m['returnRatePct'] ?? m['interestRatePct'];
  final returnRatePct = rr is num ? rr.toDouble() : double.tryParse(rr?.toString() ?? '') ?? 0;
  return LedgerAssetRow(
    id: id,
    type: LedgerAssetTypeUi.fromApi(m['type']?.toString()),
    currencyCountry: m['currencyCountry']?.toString() ?? 'Thailand',
    name: m['name']?.toString() ?? '',
    total: (m['total'] is num) ? (m['total'] as num).toDouble() : double.tryParse(m['total']?.toString() ?? '') ?? 0,
    label: m['label']?.toString() ?? '',
    comment: m['comment']?.toString() ?? '',
    contextMarkdown: m['contextMarkdown']?.toString(),
    returnRatePct: returnRatePct,
  );
}

Map<String, dynamic> encodeLedgerLiabilityRow(LedgerLiabilityRow r) => {
      'id': r.id,
      'type': r.type.apiValue,
      'name': r.name,
      'currencyCountry': r.currencyCountry,
      'total': r.total,
      'comment': r.comment,
      'interestRatePct': r.interestRatePct,
      'paydownWeight': r.paydownWeight,
      'paydownMonthly': r.paydownMonthly,
      if (r.contextMarkdown != null && r.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': r.contextMarkdown,
    };

LedgerLiabilityRow? decodeLedgerLiabilityRow(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  final ir = m['interestRatePct'];
  final interestRatePct = ir is num ? ir.toDouble() : double.tryParse(ir?.toString() ?? '') ?? 0;
  final pw = m['paydownWeight'];
  final paydownWeight = pw is num ? pw.toDouble() : double.tryParse(pw?.toString() ?? '') ?? 1;
  final pm = m['paydownMonthly'];
  final paydownMonthly = pm is num ? pm.toDouble() : double.tryParse(pm?.toString() ?? '') ?? 0;
  return LedgerLiabilityRow(
    id: id,
    type: LedgerLiabilityTypeUi.fromApi(m['type']?.toString()),
    name: m['name']?.toString() ?? '',
    currencyCountry: m['currencyCountry']?.toString() ?? 'Thailand',
    total: (m['total'] is num) ? (m['total'] as num).toDouble() : double.tryParse(m['total']?.toString() ?? '') ?? 0,
    comment: m['comment']?.toString() ?? '',
    contextMarkdown: m['contextMarkdown']?.toString(),
    interestRatePct: interestRatePct,
    paydownWeight: paydownWeight > 0 ? paydownWeight : 1,
    paydownMonthly: paydownMonthly.clamp(0, double.infinity),
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

Map<String, dynamic> encodeMonthlySavingsLine(MonthlySavingsLine l) => {
      'id': l.id,
      if (l.assetId != null) 'assetId': l.assetId,
      if (l.liabilityId != null) 'liabilityId': l.liabilityId,
      'amount': l.amount,
      if (l.contextMarkdown != null && l.contextMarkdown!.trim().isNotEmpty) 'contextMarkdown': l.contextMarkdown,
      'amountApplied': l.amountApplied,
    };

MonthlySavingsLine? decodeMonthlySavingsLine(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null) return null;
  return MonthlySavingsLine(
    id: id,
    assetId: m['assetId']?.toString(),
    liabilityId: m['liabilityId']?.toString(),
    amount: (m['amount'] is num) ? (m['amount'] as num).toDouble() : double.tryParse(m['amount']?.toString() ?? '') ?? 0,
    contextMarkdown: m['contextMarkdown']?.toString(),
    amountApplied: (m['amountApplied'] is num)
        ? (m['amountApplied'] as num).toDouble()
        : double.tryParse(m['amountApplied']?.toString() ?? '') ?? 0,
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
      'savingsLines': e.savingsLines.map(encodeMonthlySavingsLine).toList(),
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
  final savRaw = m['savingsLines'];
  final savLines = <MonthlySavingsLine>[];
  if (savRaw is List) {
    for (final e in savRaw) {
      final l = decodeMonthlySavingsLine(e);
      if (l != null) savLines.add(l);
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
    savingsLines: savLines,
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

Map<String, dynamic> encodeFinancialGoal(FinancialGoal g) => {
      'id': g.id,
      'kind': g.kind.apiValue,
      'name': g.name,
      'targetAmount': g.targetAmount,
      if (g.targetDate != null) 'targetDate': g.targetDate!.toUtc().toIso8601String(),
      'linkedAssetIds': g.linkedAssetIds,
      'savingsWeight': g.savingsWeight,
      'sortOrder': g.sortOrder,
      'corpusSurplus': g.corpusSurplus,
      if (g.contextMarkdown.trim().isNotEmpty) 'contextMarkdown': g.contextMarkdown,
      if (g.isRetirement) ...{
        'safeWithdrawalRatePct': g.safeWithdrawalRatePct,
        'corpusBufferPct': g.corpusBufferPct,
        'corpusAutoFromExpenses': g.corpusAutoFromExpenses,
      },
      if (g.timelineStart != null) 'timelineStart': g.timelineStart!.toUtc().toIso8601String(),
    };

FinancialGoal? decodeFinancialGoal(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString();
  if (id == null || id.isEmpty) return null;
  final kind = FinancialGoalKind.fromApi(m['kind']?.toString());
  final name = (m['name']?.toString() ?? '').trim();
  final target = m['targetAmount'];
  final targetAmount = target is num ? target.toDouble() : double.tryParse(target?.toString() ?? '') ?? 0;
  DateTime? targetDate;
  final td = m['targetDate']?.toString();
  if (td != null && td.isNotEmpty) {
    targetDate = DateTime.tryParse(td);
  }
  final linked = <String>[];
  final la = m['linkedAssetIds'];
  if (la is List) {
    for (final e in la) {
      final s = e.toString().trim();
      if (s.isNotEmpty) linked.add(s);
    }
  }
  final sw = m['savingsWeight'];
  final savingsWeight = sw is num ? sw.toDouble() : double.tryParse(sw?.toString() ?? '') ?? 1;
  final so = m['sortOrder'];
  final sortOrder = so is num ? so.round() : int.tryParse(so?.toString() ?? '') ?? 0;
  final cs = m['corpusSurplus'] ?? m['corpusAdjustment'];
  final corpusSurplus = cs is num ? cs.toDouble() : double.tryParse(cs?.toString() ?? '') ?? 0;
  final swr = m['safeWithdrawalRatePct'];
  final safeWithdrawalRatePct =
      swr is num ? swr.toDouble() : double.tryParse(swr?.toString() ?? '') ?? 4;
  final buf = m['corpusBufferPct'];
  final corpusBufferPct = buf is num ? buf.toDouble() : double.tryParse(buf?.toString() ?? '') ?? 0;
  DateTime? timelineStart;
  final ts = m['timelineStart']?.toString();
  if (ts != null && ts.isNotEmpty) {
    timelineStart = DateTime.tryParse(ts);
  }
  return FinancialGoal(
    id: id,
    kind: kind,
    name: name.isEmpty ? (kind == FinancialGoalKind.retirement ? 'Retirement' : 'Goal') : name,
    targetAmount: targetAmount,
    targetDate: targetDate,
    linkedAssetIds: linked,
    savingsWeight: savingsWeight > 0 ? savingsWeight : 1,
    sortOrder: sortOrder,
    corpusSurplus: corpusSurplus,
    contextMarkdown: m['contextMarkdown']?.toString() ?? '',
    safeWithdrawalRatePct: safeWithdrawalRatePct,
    corpusBufferPct: corpusBufferPct,
    corpusAutoFromExpenses: m['corpusAutoFromExpenses'] != false,
    timelineStart: timelineStart,
  );
}

Map<String, dynamic> encodeNotificationsBlock(AppModel m) {
  int? toMs(DateTime? d) => d?.toUtc().millisecondsSinceEpoch;
  return {
    'enabled': m.notificationsEnabled,
    'homeMessages': m.homeMessagesNotifications,
    'homeMessagesCadence': m.homeMessagesCadence.name,
    if (toMs(m.homeMessagesLastNotifiedOn) != null) 'homeMessagesLastNotifiedOnMs': toMs(m.homeMessagesLastNotifiedOn),
    'reminderHour': m.reminderNotifyHour,
    'reminderMinute': m.reminderNotifyMinute,
    if (toMs(m.remindersLastFiredOn) != null) 'lastFiredOnMs': toMs(m.remindersLastFiredOn),
    if (m.remindersLastFiredDomain != null) 'lastFiredDomain': m.remindersLastFiredDomain!.name,
    if (toMs(m.remindersScheduledFireOn) != null) 'scheduledFireOnMs': toMs(m.remindersScheduledFireOn),
    if (m.remindersPendingDomain != null) 'pendingDomain': m.remindersPendingDomain!.name,
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
  if (n.containsKey('homeMessages')) {
    m.homeMessagesNotifications = n['homeMessages'] == true;
  }
  final cadRaw = n['homeMessagesCadence']?.toString();
  m.homeMessagesCadence = HomeMessageCadenceUi.tryParse(cadRaw) ?? HomeMessageCadence.daily;
  m.homeMessagesLastNotifiedOn = dateTimeFromJsonField(n['homeMessagesLastNotifiedOnMs']);
  final rh = n['reminderHour'];
  final rm = n['reminderMinute'];
  if (rh is int) m.reminderNotifyHour = rh.clamp(0, 23);
  if (rh is num) m.reminderNotifyHour = rh.round().clamp(0, 23);
  if (rm is int) m.reminderNotifyMinute = rm.clamp(0, 59);
  if (rm is num) m.reminderNotifyMinute = rm.round().clamp(0, 59);
  m.remindersLastFiredOn = dateTimeFromJsonField(n['lastFiredOnMs']);
  final firedName = n['lastFiredDomain']?.toString();
  if (firedName != null) {
    for (final d in ReminderDomain.values) {
      if (d.name == firedName) {
        m.remindersLastFiredDomain = d;
        break;
      }
    }
  }
  m.remindersScheduledFireOn = dateTimeFromJsonField(n['scheduledFireOnMs']);
  final pendingName = n['pendingDomain']?.toString();
  if (pendingName != null) {
    for (final d in ReminderDomain.values) {
      if (d.name == pendingName) {
        m.remindersPendingDomain = d;
        break;
      }
    }
  }
  if (n['userTouchedExpenses'] == true) m.userTouchedExpenses = true;
  if (n['userTouchedIncome'] == true) m.userTouchedIncome = true;
  if (n['userTouchedAssets'] == true) m.userTouchedAssets = true;
  if (n['userTouchedLiabilities'] == true) m.userTouchedLiabilities = true;
}

Map<String, dynamic> encodeCorpusBacktestBlock(AppModel model) => encodeCorpusBacktestPrefs(
      equityPct: model.corpusBacktestEquityPct,
      equitySeriesId: model.corpusBacktestEquitySeriesId,
      debtSeriesId: model.corpusBacktestDebtSeriesId,
      startYear: model.corpusBacktestStartYear,
    );

void decodeCorpusBacktestBlock(Object? raw, AppModel model) {
  if (raw is! Map) return;
  decodeCorpusBacktestPrefs(
    Map<String, dynamic>.from(raw),
    onEquityPct: (v) => model.corpusBacktestEquityPct = v,
    onEquitySeriesId: (v) => model.corpusBacktestEquitySeriesId = v,
    onDebtSeriesId: (v) => model.corpusBacktestDebtSeriesId = v,
    onStartYear: (v) => model.corpusBacktestStartYear = v,
  );
}
