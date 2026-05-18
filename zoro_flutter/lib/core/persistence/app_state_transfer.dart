import 'dart:convert';

import 'agent_json.dart';
import 'app_state_codec.dart';
import '../constants/web_expenses_income.dart';
import '../state/app_model.dart';
import '../state/financial_goals.dart';
import '../state/ledger_rows.dart';

/// Portable export / import kinds (one item per file except ledger).
abstract final class DataExportKind {
  static const ledger = 'ledger';
  static const goals = 'goals';
  static const settings = 'settings';
  static const context = 'context';
  static const agent = 'agent';
  static const chats = 'chats';

  static const all = [ledger, goals, settings, context, agent, chats];

  static String label(String kind) => switch (kind) {
        ledger => 'Ledger',
        goals => 'Goals',
        settings => 'Settings',
        context => 'Context note',
        agent => 'Agent',
        chats => 'Chats',
        _ => kind,
      };
}

/// User-facing pick for a context or agent export.
class DataExportPick {
  const DataExportPick({required this.id, required this.label, this.subtitle});

  final String id;
  final String label;
  final String? subtitle;
}

/// Full ledger vs one section (or one row).
abstract final class LedgerExportScope {
  static const full = 'full';
  static const part = 'part';

  static const all = [full, part];

  static String label(String scope) => switch (scope) {
        full => 'Full',
        part => 'Part',
        _ => scope,
      };
}

/// Ledger subsection for partial export.
abstract final class LedgerPartGroup {
  static const assets = 'assets';
  static const liabilities = 'liabilities';
  static const income = 'income';
  static const expenses = 'expenses';
  static const months = 'months';

  static const all = [assets, liabilities, income, expenses, months];

  static String label(String group) => switch (group) {
        assets => 'Assets',
        liabilities => 'Liabilities',
        income => 'Income',
        expenses => 'Expenses',
        months => 'Cashflow months',
        _ => group,
      };

  /// Sentinel [DataExportPick.id] — export entire [group], not one row.
  static const allItemsId = '*';
}

/// Context notes grouped for stepped export UI (area → item).
abstract final class ContextExportGroup {
  static const assets = 'assets';
  static const liabilities = 'liabilities';
  static const buckets = 'buckets';
  static const months = 'months';

  static const all = [assets, liabilities, buckets, months];

  static String label(String group) => switch (group) {
        assets => 'Assets',
        liabilities => 'Liabilities',
        buckets => 'Expense buckets',
        months => 'Cashflow months',
        _ => group,
      };
}

enum ImportApplyMode { merge, replace }

enum ImportSummaryAction { add, update, replace, info }

class ImportSummaryLine {
  const ImportSummaryLine({
    required this.label,
    required this.action,
  });

  final String label;
  final ImportSummaryAction action;
}

class ImportAnalysis {
  ImportAnalysis({
    required this.exportKind,
    required this.title,
    required this.lines,
    required this.root,
    required this.supportsMerge,
    required this.supportsReplace,
  });

  final String exportKind;
  final String title;
  final List<ImportSummaryLine> lines;
  final Map<String, dynamic> root;
  final bool supportsMerge;
  final bool supportsReplace;
}

/// Ledger-only and selective portable export/import.
class AppStateTransfer {
  static const String ledgerExportKind = DataExportKind.ledger;

  static Map<String, dynamic> _envelope(String exportKind, Map<String, dynamic> payload) => {
        'formatVersion': kAppStateFormatVersion,
        'exportKind': exportKind,
        'savedAtMs': DateTime.now().toUtc().millisecondsSinceEpoch,
        ...payload,
      };

  static Map<String, dynamic> buildLedgerExportMap(
    AppModel model, {
    String scope = LedgerExportScope.full,
    String? partGroup,
    String? partPickId,
  }) {
    final full = model.buildLedgerPersistedMap();
    if (scope == LedgerExportScope.full) {
      return _envelope(ledgerExportKind, {'ledger': full});
    }
    final group = partGroup ?? LedgerPartGroup.assets;
    final ledger = _ledgerPartialMap(full, group: group, partPickId: partPickId);
    return _envelope(
      ledgerExportKind,
      {
        'ledger': ledger,
        'ledgerPart': {
          'group': group,
          if (partPickId != null && partPickId != LedgerPartGroup.allItemsId) 'id': partPickId,
        },
      },
    );
  }

  static Map<String, dynamic> _ledgerPartialMap(
    Map<String, dynamic> full, {
    required String group,
    String? partPickId,
  }) {
    final allInGroup = partPickId == null || partPickId == LedgerPartGroup.allItemsId;
    switch (group) {
      case LedgerPartGroup.assets:
        final raw = full['assets'];
        if (raw is! List) return {'assets': <dynamic>[]};
        if (allInGroup) return {'assets': raw};
        return {
          'assets': [for (final e in raw) if (e is Map && e['id']?.toString() == partPickId) e],
        };
      case LedgerPartGroup.liabilities:
        final raw = full['liabilities'];
        if (raw is! List) return {'liabilities': <dynamic>[]};
        if (allInGroup) return {'liabilities': raw};
        return {
          'liabilities': [for (final e in raw) if (e is Map && e['id']?.toString() == partPickId) e],
        };
      case LedgerPartGroup.income:
        final raw = full['incomeLines'];
        if (raw is! List) return {'incomeLines': <dynamic>[]};
        if (allInGroup) return {'incomeLines': raw};
        return {
          'incomeLines': [for (final e in raw) if (e is Map && e['id']?.toString() == partPickId) e],
        };
      case LedgerPartGroup.expenses:
        final buckets = full['expenseBuckets'];
        final ctx = full['expenseBucketContextMarkdown'];
        if (allInGroup) {
          return {
            if (buckets is Map) 'expenseBuckets': buckets,
            if (ctx is Map) 'expenseBucketContextMarkdown': ctx,
          };
        }
        final key = partPickId;
        final out = <String, dynamic>{};
        if (buckets is Map && key != null && buckets.containsKey(key)) {
          out['expenseBuckets'] = {key: buckets[key]};
        }
        if (ctx is Map && key != null && ctx.containsKey(key)) {
          out['expenseBucketContextMarkdown'] = {key: ctx[key]};
        }
        return out;
      case LedgerPartGroup.months:
        final raw = full['monthlyCashflowByMonth'];
        if (raw is! Map) return {'monthlyCashflowByMonth': <String, dynamic>{}};
        if (allInGroup) return {'monthlyCashflowByMonth': raw};
        final key = partPickId;
        if (key == null || !raw.containsKey(key)) return {'monthlyCashflowByMonth': <String, dynamic>{}};
        return {'monthlyCashflowByMonth': {key: raw[key]}};
      default:
        return {};
    }
  }

  static List<DataExportPick> listLedgerPartPicksForGroup(AppModel model, String group) {
    final items = <DataExportPick>[
      const DataExportPick(id: LedgerPartGroup.allItemsId, label: 'All'),
    ];
    switch (group) {
      case LedgerPartGroup.assets:
        items.addAll([
          for (final a in model.assets)
            DataExportPick(
              id: a.id,
              label: a.name.trim().isNotEmpty ? a.name : a.label,
            ),
        ]);
      case LedgerPartGroup.liabilities:
        items.addAll([
          for (final l in model.liabilities)
            DataExportPick(
              id: l.id,
              label: l.name.trim().isNotEmpty ? l.name : l.type.label,
            ),
        ]);
      case LedgerPartGroup.income:
        items.addAll([
          for (final line in model.incomeLines)
            DataExportPick(id: line.id, label: line.label.trim().isNotEmpty ? line.label : 'Income'),
        ]);
      case LedgerPartGroup.expenses:
        items.addAll([
          for (final k in expenseBucketKeys) DataExportPick(id: k, label: k),
        ]);
      case LedgerPartGroup.months:
        items.addAll([
          for (final monthKey in model.monthlyCashflowByMonth.keys.toList()..sort())
            DataExportPick(id: monthKey, label: monthKey),
        ]);
    }
    return items;
  }

  static Map<String, dynamic> buildGoalsExportMap(AppModel model) => _envelope(
        DataExportKind.goals,
        {'goals': model.financialGoals.map(encodeFinancialGoal).toList()},
      );

  static Map<String, dynamic> buildSettingsExportMap(AppModel model) {
    final snap = model.buildPersistedSnapshot();
    final settings = Map<String, dynamic>.from(snap['settings'] as Map);
    settings.remove('agents');
    return _envelope(DataExportKind.settings, {'settings': settings});
  }

  static Map<String, dynamic> buildChatsExportMap(AppModel model) =>
      _envelope(DataExportKind.chats, {'chats': model.buildPersistedSnapshot()['chats']});

  static Map<String, dynamic> buildAgentExportMap(AppModel model, String agentId) {
    final ix = model.agents.indexWhere((a) => a.id == agentId);
    if (ix < 0) throw ArgumentError('Unknown agent id: $agentId');
    final agent = model.agents[ix];
    return _envelope(DataExportKind.agent, {'agent': appAgentToJson(agent)});
  }

  static Map<String, dynamic> buildContextExportMap(AppModel model, String storageKey) {
    final markdown = _contextMarkdownForKey(model, storageKey);
    final savedAt = model.contextNoteSavedAtUtc[storageKey];
    return _envelope(
      DataExportKind.context,
      {
        'context': {
          'storageKey': storageKey,
          'label': _contextLabelForKey(model, storageKey),
          'markdown': markdown,
          if (savedAt != null) 'savedAtMs': savedAt.toUtc().millisecondsSinceEpoch,
        },
      },
    );
  }

  static String _contextMarkdownForKey(AppModel model, String storageKey) {
    if (storageKey.startsWith('asset:')) {
      final id = storageKey.substring(6);
      return model.assetById(id)?.contextMarkdown ?? '';
    }
    if (storageKey.startsWith('liability:')) {
      final id = storageKey.substring(10);
      return model.liabilityById(id)?.contextMarkdown ?? '';
    }
    if (storageKey.startsWith('bucket:')) {
      final key = storageKey.substring(7);
      return model.expenseBucketContextMarkdown[key] ?? '';
    }
    if (storageKey.startsWith('month:')) {
      final monthKey = storageKey.substring(6);
      return model.monthlyEntryFor(monthKey)?.contextMarkdown ?? '';
    }
    return '';
  }

  static String _contextLabelForKey(AppModel model, String storageKey) {
    if (storageKey.startsWith('asset:')) {
      final id = storageKey.substring(6);
      final a = model.assetById(id);
      if (a == null) return id;
      return a.name.trim().isNotEmpty ? a.name : a.label;
    }
    if (storageKey.startsWith('liability:')) {
      final id = storageKey.substring(10);
      final l = model.liabilityById(id);
      return l?.name.trim().isNotEmpty == true ? l!.name : id;
    }
    if (storageKey.startsWith('bucket:')) {
      return storageKey.substring(7);
    }
    if (storageKey.startsWith('month:')) {
      return storageKey.substring(6);
    }
    return storageKey;
  }

  static List<DataExportPick> listContextExportPicks(AppModel model) => [
        ...listContextExportPicksForGroup(model, ContextExportGroup.assets),
        ...listContextExportPicksForGroup(model, ContextExportGroup.liabilities),
        ...listContextExportPicksForGroup(model, ContextExportGroup.buckets),
        ...listContextExportPicksForGroup(model, ContextExportGroup.months),
      ];

  static List<DataExportPick> listContextExportPicksForGroup(AppModel model, String group) {
    return switch (group) {
      ContextExportGroup.assets => [
          for (final a in model.assets)
            DataExportPick(
              id: AppModel.contextKeyAsset(a.id),
              label: a.name.trim().isNotEmpty ? a.name : a.label,
            ),
        ],
      ContextExportGroup.liabilities => [
          for (final l in model.liabilities)
            DataExportPick(
              id: AppModel.contextKeyLiability(l.id),
              label: l.name.trim().isNotEmpty ? l.name : l.type.label,
            ),
        ],
      ContextExportGroup.buckets => [
          for (final k in expenseBucketKeys)
            DataExportPick(id: AppModel.contextKeyBucket(k), label: k),
        ],
      ContextExportGroup.months => [
          for (final monthKey in model.monthlyCashflowByMonth.keys.toList()..sort())
            DataExportPick(id: AppModel.contextKeyMonth(monthKey), label: monthKey),
        ],
      _ => const [],
    };
  }

  static List<DataExportPick> listAgentExportPicks(AppModel model) {
    return [
      for (final a in model.agents)
        DataExportPick(id: a.id, label: a.name, subtitle: a.kind.name),
    ];
  }

  static Map<String, dynamic> buildExportMap(
    AppModel model, {
    required String exportKind,
    String? pickId,
    String ledgerScope = LedgerExportScope.full,
    String? ledgerPartGroup,
    String? ledgerPartPickId,
  }) {
    return switch (exportKind) {
      DataExportKind.ledger => buildLedgerExportMap(
          model,
          scope: ledgerScope,
          partGroup: ledgerPartGroup,
          partPickId: ledgerPartPickId ?? pickId,
        ),
      DataExportKind.goals => buildGoalsExportMap(model),
      DataExportKind.settings => buildSettingsExportMap(model),
      DataExportKind.chats => buildChatsExportMap(model),
      DataExportKind.agent => buildAgentExportMap(model, pickId ?? ''),
      DataExportKind.context => buildContextExportMap(model, pickId ?? ''),
      _ => throw ArgumentError('Unknown export kind: $exportKind'),
    };
  }

  static String encodeExportJson(
    AppModel model, {
    required String exportKind,
    String? pickId,
    String ledgerScope = LedgerExportScope.full,
    String? ledgerPartGroup,
    String? ledgerPartPickId,
    bool pretty = true,
  }) {
    final map = buildExportMap(
      model,
      exportKind: exportKind,
      pickId: pickId,
      ledgerScope: ledgerScope,
      ledgerPartGroup: ledgerPartGroup,
      ledgerPartPickId: ledgerPartPickId,
    );
    if (pretty) {
      return const JsonEncoder.withIndent('  ').convert(map);
    }
    return jsonEncode(map);
  }

  static String encodeLedgerExportJson(AppModel model, {bool pretty = true}) =>
      encodeExportJson(model, exportKind: ledgerExportKind, pretty: pretty);

  static bool isLedgerOnlyExport(Map<String, dynamic> root) =>
      root['exportKind']?.toString() == ledgerExportKind;

  static String? _validateFormatVersion(Map<String, dynamic> root) {
    final ver = root['formatVersion'];
    if (ver is! int || ver != kAppStateFormatVersion) {
      return 'Unsupported format version (expected $kAppStateFormatVersion).';
    }
    return null;
  }

  static String? validateImportRoot(Object? decoded) {
    if (decoded is! Map) return 'File is not a JSON object.';
    final root = Map<String, dynamic>.from(decoded);
    final verErr = _validateFormatVersion(root);
    if (verErr != null) return verErr;
    final kind = root['exportKind']?.toString();
    if (kind == null || !DataExportKind.all.contains(kind)) {
      return 'Missing or unknown exportKind.';
    }
    return switch (kind) {
      DataExportKind.ledger =>
        root['ledger'] is Map ? null : 'Missing "ledger" object.',
      DataExportKind.goals =>
        root['goals'] is List ? null : 'Missing "goals" list.',
      DataExportKind.settings =>
        root['settings'] is Map ? null : 'Missing "settings" object.',
      DataExportKind.context =>
        root['context'] is Map ? null : 'Missing "context" object.',
      DataExportKind.agent =>
        root['agent'] is Map ? null : 'Missing "agent" object.',
      DataExportKind.chats =>
        root['chats'] is Map ? null : 'Missing "chats" object.',
      _ => 'Unknown exportKind.',
    };
  }

  static Map<String, dynamic> parseImportJson(String text) {
    final decoded = jsonDecode(text.trim());
    final err = validateImportRoot(decoded);
    if (err != null) throw FormatException(err);
    return Map<String, dynamic>.from(decoded as Map);
  }

  static ImportAnalysis analyzeImport(AppModel model, Map<String, dynamic> root) {
    final kind = root['exportKind']!.toString();
    final title = DataExportKind.label(kind);
    final lines = <ImportSummaryLine>[];

    switch (kind) {
      case DataExportKind.ledger:
        final ledger = Map<String, dynamic>.from(root['ledger'] as Map);
        _summarizeLedgerImport(model, ledger, lines);
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: true,
          supportsReplace: true,
        );
      case DataExportKind.goals:
        final goalsRaw = root['goals'] as List;
        var add = 0;
        var upd = 0;
        for (final g in goalsRaw) {
          if (g is! Map) continue;
          final id = g['id']?.toString();
          if (id == null) continue;
          if (model.financialGoals.any((x) => x.id == id)) {
            upd++;
          } else {
            add++;
          }
        }
        if (add > 0) lines.add(ImportSummaryLine(label: '$add goal(s) to add', action: ImportSummaryAction.add));
        if (upd > 0) {
          lines.add(ImportSummaryLine(label: '$upd goal(s) to update by id', action: ImportSummaryAction.update));
        }
        if (lines.isEmpty) lines.add(const ImportSummaryLine(label: 'No goals in file', action: ImportSummaryAction.info));
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: true,
          supportsReplace: true,
        );
      case DataExportKind.settings:
        lines.add(const ImportSummaryLine(label: 'App preferences and reminders', action: ImportSummaryAction.replace));
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: true,
          supportsReplace: true,
        );
      case DataExportKind.context:
        final ctx = Map<String, dynamic>.from(root['context'] as Map);
        final key = ctx['storageKey']?.toString() ?? '';
        final label = ctx['label']?.toString() ?? key;
        final md = ctx['markdown']?.toString() ?? '';
        final exists = _contextExists(model, key);
        lines.add(
          ImportSummaryLine(
            label: exists ? 'Update context: $label' : 'Add context: $label',
            action: exists ? ImportSummaryAction.update : ImportSummaryAction.add,
          ),
        );
        lines.add(
          ImportSummaryLine(
            label: '${md.length} characters',
            action: ImportSummaryAction.info,
          ),
        );
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: true,
          supportsReplace: true,
        );
      case DataExportKind.agent:
        final agentMap = Map<String, dynamic>.from(root['agent'] as Map);
        final id = agentMap['id']?.toString() ?? '';
        final name = agentMap['name']?.toString() ?? id;
        final exists = model.agents.any((a) => a.id == id);
        lines.add(
          ImportSummaryLine(
            label: exists ? 'Update agent: $name' : 'Add agent: $name',
            action: exists ? ImportSummaryAction.update : ImportSummaryAction.add,
          ),
        );
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: true,
          supportsReplace: true,
        );
      case DataExportKind.chats:
        final chats = root['chats'];
        var threads = 0;
        var msgs = 0;
        if (chats is Map) {
          final t = chats['threads'];
          if (t is List) threads = t.length;
          final m = chats['messages'];
          if (m is Map) {
            for (final e in m.values) {
              if (e is List) msgs += e.length;
            }
          }
        }
        lines.add(ImportSummaryLine(label: '$threads chat(s), $msgs message(s)', action: ImportSummaryAction.replace));
        return ImportAnalysis(
          exportKind: kind,
          title: title,
          lines: lines,
          root: root,
          supportsMerge: false,
          supportsReplace: true,
        );
      default:
        throw ArgumentError('Unsupported kind: $kind');
    }
  }

  static bool _contextExists(AppModel model, String storageKey) {
    if (storageKey.startsWith('asset:')) {
      return model.assetById(storageKey.substring(6)) != null;
    }
    if (storageKey.startsWith('liability:')) {
      return model.liabilityById(storageKey.substring(10)) != null;
    }
    if (storageKey.startsWith('bucket:')) {
      return expenseBucketKeys.contains(storageKey.substring(7));
    }
    if (storageKey.startsWith('month:')) {
      return model.monthlyEntryFor(storageKey.substring(6)) != null;
    }
    return false;
  }

  static void _summarizeLedgerImport(
    AppModel model,
    Map<String, dynamic> ledger,
    List<ImportSummaryLine> lines,
  ) {
    void countRows<T>(
      String label,
      List? raw,
      String? Function(Map m) idOf,
      bool Function(String id) exists,
    ) {
      if (raw == null) return;
      var add = 0;
      var upd = 0;
      for (final e in raw) {
        if (e is! Map) continue;
        final id = idOf(Map<String, dynamic>.from(e));
        if (id == null || id.isEmpty) continue;
        if (exists(id)) {
          upd++;
        } else {
          add++;
        }
      }
      if (add > 0) lines.add(ImportSummaryLine(label: '$add $label to add', action: ImportSummaryAction.add));
      if (upd > 0) {
        lines.add(ImportSummaryLine(label: '$upd $label to update by id', action: ImportSummaryAction.update));
      }
    }

    countRows(
      'assets',
      ledger['assets'] as List?,
      (m) => m['id']?.toString(),
      (id) => model.assetById(id) != null,
    );
    countRows(
      'liabilities',
      ledger['liabilities'] as List?,
      (m) => m['id']?.toString(),
      (id) => model.liabilityById(id) != null,
    );
    countRows(
      'income lines',
      ledger['incomeLines'] as List?,
      (m) => m['id']?.toString(),
      (id) => model.incomeLines.any((l) => l.id == id),
    );

    final months = ledger['monthlyCashflowByMonth'];
    if (months is Map) {
      var add = 0;
      var upd = 0;
      for (final k in months.keys) {
        final key = k.toString();
        if (model.monthlyEntryFor(key) != null) {
          upd++;
        } else {
          add++;
        }
      }
      if (add > 0) lines.add(ImportSummaryLine(label: '$add month(s) to add', action: ImportSummaryAction.add));
      if (upd > 0) lines.add(ImportSummaryLine(label: '$upd month(s) to update', action: ImportSummaryAction.update));
    }

    if (lines.isEmpty) {
      lines.add(const ImportSummaryLine(label: 'Ledger data in file', action: ImportSummaryAction.info));
    }
  }

  static Future<void> applyImport(
    AppModel model,
    Map<String, dynamic> root, {
    ImportApplyMode mode = ImportApplyMode.replace,
  }) async {
    final kind = root['exportKind']?.toString();
    switch (kind) {
      case DataExportKind.ledger:
        final ledger = Map<String, dynamic>.from(root['ledger'] as Map);
        if (mode == ImportApplyMode.replace) {
          await model.applyImportedLedger(ledger);
        } else {
          await model.mergeImportedLedger(ledger);
        }
        return;
      case DataExportKind.goals:
        await _applyGoalsImport(model, root, mode);
        return;
      case DataExportKind.settings:
        await _applySettingsImport(model, root, mode);
        return;
      case DataExportKind.context:
        await _applyContextImport(model, root);
        return;
      case DataExportKind.agent:
        await _applyAgentImport(model, root, mode);
        return;
      case DataExportKind.chats:
        await model.applyImportedChats(Map<String, dynamic>.from(root['chats'] as Map));
        return;
      default:
        throw ArgumentError('Unsupported exportKind: $kind');
    }
  }

  static Future<void> _applyGoalsImport(
    AppModel model,
    Map<String, dynamic> root,
    ImportApplyMode mode,
  ) async {
    final raw = root['goals'] as List;
    final incoming = <FinancialGoal>[
      for (final e in raw)
        if (decodeFinancialGoal(e) != null) decodeFinancialGoal(e)!,
    ];
    if (mode == ImportApplyMode.replace) {
      await model.replaceAllGoalsFromImport(incoming);
      return;
    }
    for (final g in incoming) {
      model.upsertFinancialGoal(g);
    }
  }

  static Future<void> _applySettingsImport(
    AppModel model,
    Map<String, dynamic> root,
    ImportApplyMode mode,
  ) async {
    final settings = Map<String, dynamic>.from(root['settings'] as Map);
    await model.applyImportedSettings(settings, replace: mode == ImportApplyMode.replace);
  }

  static Future<void> _applyContextImport(AppModel model, Map<String, dynamic> root) async {
    final ctx = Map<String, dynamic>.from(root['context'] as Map);
    final key = ctx['storageKey']?.toString();
    if (key == null || key.isEmpty) throw FormatException('Missing context storageKey.');
    final markdown = ctx['markdown']?.toString() ?? '';
    final savedMs = ctx['savedAtMs'];
    if (key.startsWith('asset:')) {
      model.setAssetContextMarkdown(assetId: key.substring(6), markdown: markdown);
    } else if (key.startsWith('liability:')) {
      model.setLiabilityContextMarkdown(liabilityId: key.substring(10), markdown: markdown);
    } else if (key.startsWith('bucket:')) {
      model.setExpenseBucketContextMarkdown(bucketKey: key.substring(7), markdown: markdown);
    } else if (key.startsWith('month:')) {
      final monthKey = key.substring(6);
      if (model.monthlyEntryFor(monthKey) == null) {
        throw FormatException('No cashflow row for month $monthKey — add the month in Ledger first.');
      }
      model.setMonthlyEntryContextMarkdown(monthKey: monthKey, markdown: markdown);
    }
    if (savedMs is int) {
      model.contextNoteSavedAtUtc[key] = DateTime.fromMillisecondsSinceEpoch(savedMs, isUtc: true);
      await model.persistAppStateToDisk();
    }
  }

  static Future<void> _applyAgentImport(
    AppModel model,
    Map<String, dynamic> root,
    ImportApplyMode mode,
  ) async {
    final agent = appAgentFromJson(root['agent']);
    if (agent == null) throw FormatException('Invalid agent object.');
    await model.applyImportedAgent(agent, replace: mode == ImportApplyMode.replace);
  }

  static String suggestedExportFileName({String exportKind = ledgerExportKind, String? pickLabel}) {
    final n = DateTime.now();
    final stamp =
        '${n.year}${n.month.toString().padLeft(2, '0')}${n.day.toString().padLeft(2, '0')}_'
        '${n.hour.toString().padLeft(2, '0')}${n.minute.toString().padLeft(2, '0')}';
    final slug = pickLabel != null && pickLabel.trim().isNotEmpty
        ? '_${pickLabel.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_').replaceAll(RegExp(r'_+'), '_')}'
        : '';
    return 'zoro_${exportKind}${slug}_$stamp.json';
  }
}
