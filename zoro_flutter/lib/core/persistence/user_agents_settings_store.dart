import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import '../finance/currency.dart';
import '../state/app_model.dart';
import 'agent_json.dart';

const _fileName = 'user_agents_settings.json';
const _version = 4;

class UserAgentsSettingsStore {
  static Future<File> _file() async {
    final dir = await getApplicationSupportDirectory();
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return File('${dir.path}/$_fileName');
  }

  static Future<UserAgentsSettingsSnap?> load() async {
    try {
      final f = await _file();
      if (!await f.exists()) return null;
      final text = await f.readAsString();
      if (text.trim().isEmpty) return null;
      final decoded = jsonDecode(text);
      if (decoded is! Map) return null;
      final root = Map<String, dynamic>.from(decoded);
      final ver = root['version'];
      if (ver is! int || (ver != 2 && ver != 3 && ver != 4)) return null;
      final agentsRaw = root['agents'];
      if (agentsRaw is! List) return null;
      final agents = <AppAgent>[];
      for (final e in agentsRaw) {
        final a = appAgentFromJson(e);
        if (a != null) agents.add(a);
      }
      final notif = root['notifications'];
      NotificationPrefsSnap? notifSnap;
      if (notif is Map) {
        notifSnap = _parseNotificationPrefs(Map<String, dynamic>.from(notif));
      }
      return UserAgentsSettingsSnap(
        agents: agents,
        activeLlmProvider: _parseLlm(root['activeLlmProvider']?.toString()),
        openAiModel: root['openAiModel']?.toString(),
        anthropicModel: root['anthropicModel']?.toString(),
        geminiModel: root['geminiModel']?.toString(),
        privacyHideAmounts: root['privacyHideAmounts'] == true,
        homeSummaryText: root['homeSummaryText']?.toString(),
        displayCurrency: _parseCurrency(root['displayCurrency']?.toString()),
        homeCurrencyQuickPick1: _parseCurrency(root['homeCurrencyQuickPick1']?.toString()),
        homeCurrencyQuickPick2: _parseCurrency(root['homeCurrencyQuickPick2']?.toString()),
        themeMode: _parseThemeMode(root['themeMode']?.toString()),
        notifications: notifSnap,
      );
    } catch (_) {
      return null;
    }
  }

  static NotificationPrefsSnap _parseNotificationPrefs(Map<String, dynamic> m) {
    int? asInt(Object? v) {
      if (v is int) return v;
      if (v is num) return v.round();
      return null;
    }

    DateTime? asUtcMs(Object? v) {
      final ms = asInt(v);
      if (ms == null) return null;
      return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
    }

    return NotificationPrefsSnap(
      notificationsEnabled: m['enabled'] == true,
      reminderNotifyHour: asInt(m['reminderHour']),
      reminderNotifyMinute: asInt(m['reminderMinute']),
      remindersLastNotifiedExpenses: asUtcMs(m['lastExpensesMs']),
      remindersLastNotifiedCashflow: asUtcMs(m['lastCashflowMs']),
      remindersLastNotifiedIncome: asUtcMs(m['lastIncomeMs']),
      remindersLastNotifiedAssets: asUtcMs(m['lastAssetsMs']),
      remindersLastNotifiedLiabilities: asUtcMs(m['lastLiabilitiesMs']),
      userTouchedExpenses: m['userTouchedExpenses'] == true,
      userTouchedIncome: m['userTouchedIncome'] == true,
      userTouchedAssets: m['userTouchedAssets'] == true,
      userTouchedLiabilities: m['userTouchedLiabilities'] == true,
    );
  }

  static LlmProvider? _parseLlm(String? s) {
    if (s == null || s.isEmpty) return null;
    for (final p in LlmProvider.values) {
      if (p.name == s) return p;
    }
    return null;
  }

  static ThemeMode? _parseThemeMode(String? s) {
    if (s == null || s.isEmpty) return null;
    for (final m in ThemeMode.values) {
      if (m.name == s) return m;
    }
    return null;
  }

  static CurrencyCode? _parseCurrency(String? s) {
    if (s == null || s.isEmpty) return null;
    for (final c in CurrencyCode.values) {
      if (c.name == s) return c;
    }
    return null;
  }

  static Future<void> save({
    required List<AppAgent> agents,
    required LlmProvider activeLlmProvider,
    required String openAiModel,
    required String anthropicModel,
    required String geminiModel,
    required bool privacyHideAmounts,
    required String homeSummaryText,
    required CurrencyCode displayCurrency,
    required CurrencyCode homeCurrencyQuickPick1,
    required CurrencyCode homeCurrencyQuickPick2,
    required ThemeMode themeMode,
    required NotificationPrefsSnap notifications,
  }) async {
    final f = await _file();
    int? toMs(DateTime? d) => d?.toUtc().millisecondsSinceEpoch;
    final payload = <String, dynamic>{
      'version': _version,
      'agents': agents.map(appAgentToJson).toList(),
      'activeLlmProvider': activeLlmProvider.name,
      'openAiModel': openAiModel,
      'anthropicModel': anthropicModel,
      'geminiModel': geminiModel,
      'privacyHideAmounts': privacyHideAmounts,
      'homeSummaryText': homeSummaryText,
      'displayCurrency': displayCurrency.name,
      'homeCurrencyQuickPick1': homeCurrencyQuickPick1.name,
      'homeCurrencyQuickPick2': homeCurrencyQuickPick2.name,
      'themeMode': themeMode.name,
      'notifications': {
        'enabled': notifications.notificationsEnabled,
        'reminderHour': notifications.reminderNotifyHour,
        'reminderMinute': notifications.reminderNotifyMinute,
        if (toMs(notifications.remindersLastNotifiedExpenses) != null)
          'lastExpensesMs': toMs(notifications.remindersLastNotifiedExpenses),
        if (toMs(notifications.remindersLastNotifiedCashflow) != null)
          'lastCashflowMs': toMs(notifications.remindersLastNotifiedCashflow),
        if (toMs(notifications.remindersLastNotifiedIncome) != null)
          'lastIncomeMs': toMs(notifications.remindersLastNotifiedIncome),
        if (toMs(notifications.remindersLastNotifiedAssets) != null)
          'lastAssetsMs': toMs(notifications.remindersLastNotifiedAssets),
        if (toMs(notifications.remindersLastNotifiedLiabilities) != null)
          'lastLiabilitiesMs': toMs(notifications.remindersLastNotifiedLiabilities),
        'userTouchedExpenses': notifications.userTouchedExpenses ?? false,
        'userTouchedIncome': notifications.userTouchedIncome ?? false,
        'userTouchedAssets': notifications.userTouchedAssets ?? false,
        'userTouchedLiabilities': notifications.userTouchedLiabilities ?? false,
      },
    };
    await f.writeAsString(const JsonEncoder.withIndent('  ').convert(payload));
  }
}

class UserAgentsSettingsSnap {
  UserAgentsSettingsSnap({
    required this.agents,
    this.activeLlmProvider,
    this.openAiModel,
    this.anthropicModel,
    this.geminiModel,
    this.privacyHideAmounts,
    this.homeSummaryText,
    this.displayCurrency,
    this.homeCurrencyQuickPick1,
    this.homeCurrencyQuickPick2,
    this.themeMode,
    this.notifications,
  });

  final List<AppAgent> agents;
  final LlmProvider? activeLlmProvider;
  final String? openAiModel;
  final String? anthropicModel;
  final String? geminiModel;
  final bool? privacyHideAmounts;
  final String? homeSummaryText;
  final CurrencyCode? displayCurrency;
  final CurrencyCode? homeCurrencyQuickPick1;
  final CurrencyCode? homeCurrencyQuickPick2;
  final ThemeMode? themeMode;
  final NotificationPrefsSnap? notifications;
}

class NotificationPrefsSnap {
  NotificationPrefsSnap({
    this.notificationsEnabled = false,
    this.reminderNotifyHour,
    this.reminderNotifyMinute,
    this.remindersLastNotifiedExpenses,
    this.remindersLastNotifiedCashflow,
    this.remindersLastNotifiedIncome,
    this.remindersLastNotifiedAssets,
    this.remindersLastNotifiedLiabilities,
    this.userTouchedExpenses,
    this.userTouchedIncome,
    this.userTouchedAssets,
    this.userTouchedLiabilities,
  });

  final bool notificationsEnabled;
  final int? reminderNotifyHour;
  final int? reminderNotifyMinute;
  final DateTime? remindersLastNotifiedExpenses;
  final DateTime? remindersLastNotifiedCashflow;
  final DateTime? remindersLastNotifiedIncome;
  final DateTime? remindersLastNotifiedAssets;
  final DateTime? remindersLastNotifiedLiabilities;
  // Nullable so we can distinguish "old store, no field" from "false".
  final bool? userTouchedExpenses;
  final bool? userTouchedIncome;
  final bool? userTouchedAssets;
  final bool? userTouchedLiabilities;
}
