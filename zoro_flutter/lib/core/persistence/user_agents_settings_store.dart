import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../finance/currency.dart';
import '../state/app_model.dart';
import 'agent_json.dart';

const _fileName = 'user_agents_settings.json';
const _version = 2;

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
      if (root['version'] != _version) return null;
      final agentsRaw = root['agents'];
      if (agentsRaw is! List) return null;
      final agents = <AppAgent>[];
      for (final e in agentsRaw) {
        final a = appAgentFromJson(e);
        if (a != null) agents.add(a);
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
      );
    } catch (_) {
      return null;
    }
  }

  static LlmProvider? _parseLlm(String? s) {
    if (s == null || s.isEmpty) return null;
    for (final p in LlmProvider.values) {
      if (p.name == s) return p;
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
  }) async {
    final f = await _file();
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
}
