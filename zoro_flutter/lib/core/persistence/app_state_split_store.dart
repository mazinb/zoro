import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'agents_store.dart';
import 'app_state_codec.dart';
import 'app_state_paths.dart';
import 'context_markdown_sidecar.dart';

/// On-disk manifest layout version. Documented in repo `zoro-app/README.md` (On-device data layout).
/// Bump this constant and the README table when paths or split rules change.
const int kAppStateSplitLayoutVersion = 2;

bool get _shouldLogSplitStore =>
    kDebugMode && !Platform.environment.containsKey('FLUTTER_TEST');

@pragma('vm:entry-point')
void _jsonDecodeWorker(List<Object?> message) {
  final reply = message[0] as SendPort;
  final raw = message[1] as String;
  try {
    final t = raw.trim();
    if (t.isEmpty) {
      reply.send(null);
      return;
    }
    reply.send(jsonDecode(t));
  } catch (_) {
    reply.send(null);
  }
}

Future<Object?> _decodeJsonFileText(String text) async {
  final port = ReceivePort();
  Isolate? isolate;
  try {
    isolate = await Isolate.spawn<List<Object?>>(
      _jsonDecodeWorker,
      <Object?>[port.sendPort, text],
    );
    return await port.first;
  } finally {
    port.close();
    isolate?.kill(priority: Isolate.immediate);
  }
}

abstract final class AppStateSplitStore {
  static Future<Directory> _supportDir() async {
    final dir = await getApplicationSupportDirectory();
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  static File _file(Directory root, String relativePath) => File('${root.path}/$relativePath');

  static Future<void> _writeJsonAtomic(File target, Object value) async {
    await target.parent.create(recursive: true);
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final tmp = File('${target.path}.$stamp.tmp');
    final text = const JsonEncoder.withIndent('  ').convert(value);
    await tmp.writeAsString(text, flush: true);
    await tmp.rename(target.path);
  }

  static Future<Object?> _readJsonFile(File f) async {
    if (!await f.exists()) return null;
    final text = await f.readAsString();
    if (text.trim().isEmpty) return null;
    return _decodeJsonFileText(text);
  }

  static Map<String, dynamic> _manifestFromPaths() => {
        'formatVersion': kAppStateSplitLayoutVersion,
        'savedAtMs': DateTime.now().toUtc().millisecondsSinceEpoch,
        'files': {
          'ledger': AppStatePaths.ledgerFile,
          'goals': AppStatePaths.goalsFile,
          'settings': AppStatePaths.settingsFile,
          'context': AppStatePaths.contextFile,
          'internalAgents': AppStatePaths.internalAgentsFile,
          'chats': AppStatePaths.chatsFile,
          'agents': AppStatePaths.agentsDir,
        },
      };

  /// Writes split files from the in-memory monolithic snapshot [root].
  static Future<void> saveMonolithic(Map<String, dynamic> root) async {
    final sup = await _supportDir();
    final working = Map<String, dynamic>.from(root);
    await ContextMarkdownSidecar.dehydrate(working);

    final settings = working['settings'];
    Map<String, dynamic> settingsMap = {};
    if (settings is Map) {
      settingsMap = Map<String, dynamic>.from(settings);
      final agentsRaw = settingsMap.remove('agents');
      await AgentsStore.saveFromSettingsAgents(agentsRaw);
    }

    final ledger = working['ledger'];
    if (ledger is Map) {
      await _writeJsonAtomic(_file(sup, AppStatePaths.ledgerFile), ledger);
    }

    final goals = working['goals'];
    if (goals is List) {
      await _writeJsonAtomic(_file(sup, AppStatePaths.goalsFile), {'goals': goals});
    }

    await _writeJsonAtomic(_file(sup, AppStatePaths.settingsFile), settingsMap);

    final context = working['context'];
    if (context is Map) {
      await _writeJsonAtomic(_file(sup, AppStatePaths.contextFile), context);
    }

    final internal = working['internalAgents'];
    if (internal is Map) {
      await _writeJsonAtomic(_file(sup, AppStatePaths.internalAgentsFile), internal);
    }

    final chats = working['chats'];
    if (chats is Map) {
      await _writeJsonAtomic(_file(sup, AppStatePaths.chatsFile), chats);
    }

    final manifest = _manifestFromPaths();
    manifest['savedAtMs'] = working['savedAtMs'] ?? manifest['savedAtMs'];
    await _writeJsonAtomic(_file(sup, AppStatePaths.manifestFile), manifest);
  }

  static Future<Map<String, dynamic>?> _assembleSplit(Directory sup) async {
    final ledgerDecoded = await _readJsonFile(_file(sup, AppStatePaths.ledgerFile));
    if (ledgerDecoded is! Map) return null;

    final settingsDecoded = await _readJsonFile(_file(sup, AppStatePaths.settingsFile));
    final settingsMap =
        settingsDecoded is Map ? Map<String, dynamic>.from(settingsDecoded) : <String, dynamic>{};
    settingsMap['agents'] = await AgentsStore.loadAsJsonList();

    final goalsWrap = await _readJsonFile(_file(sup, AppStatePaths.goalsFile));
    final goals = goalsWrap is Map ? goalsWrap['goals'] : goalsWrap;

    final contextDecoded = await _readJsonFile(_file(sup, AppStatePaths.contextFile));
    final internalDecoded = await _readJsonFile(_file(sup, AppStatePaths.internalAgentsFile));
    final chatsDecoded = await _readJsonFile(_file(sup, AppStatePaths.chatsFile));

    final assembled = <String, dynamic>{
      'formatVersion': kAppStateFormatVersion,
      'ledger': Map<String, dynamic>.from(ledgerDecoded),
      'settings': settingsMap,
      if (goals is List) 'goals': goals,
      if (contextDecoded is Map) 'context': Map<String, dynamic>.from(contextDecoded),
      if (internalDecoded is Map) 'internalAgents': Map<String, dynamic>.from(internalDecoded),
      if (chatsDecoded is Map) 'chats': Map<String, dynamic>.from(chatsDecoded),
    };

    try {
      await ContextMarkdownSidecar.hydrate(assembled);
    } catch (e, st) {
      if (_shouldLogSplitStore) {
        debugPrint('[AppStateSplitStore] hydrate failed: $e\n$st');
      }
    }
    return assembled;
  }

  static Future<void> _migrateMonolithicV1(Directory sup, Map<String, dynamic> monolithic) async {
    await saveMonolithic(monolithic);
    if (_shouldLogSplitStore) {
      debugPrint('[AppStateSplitStore] migrated monolithic v1 → split v2');
    }
  }

  /// Loads and returns a monolithic map for [AppModel._applyAppStateMap], or `null`.
  static Future<Map<String, dynamic>?> loadAsMonolithic() async {
    try {
      final sup = await _supportDir();
      final manifestFile = _file(sup, AppStatePaths.manifestFile);
      if (!await manifestFile.exists()) return null;

      final manifestText = await manifestFile.readAsString();
      if (manifestText.trim().isEmpty) return null;
      final manifestDecoded = await _decodeJsonFileText(manifestText);
      if (manifestDecoded is! Map) return null;
      final manifest = Map<String, dynamic>.from(manifestDecoded);
      final ver = manifest['formatVersion'];

      if (ver == kAppStateSplitLayoutVersion) {
        return _assembleSplit(sup);
      }

      // Legacy v1: entire app lived in app_state.json.
      if (ver == kAppStateFormatVersion && manifest.containsKey('ledger')) {
        await _migrateMonolithicV1(sup, manifest);
        return loadAsMonolithic();
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  /// Overwrites only [AppStatePaths.ledgerFile] (inline markdown in [ledger] — dehydrate first).
  static Future<void> saveLedgerOnly(Map<String, dynamic> ledger) async {
    final sup = await _supportDir();
    final working = {'ledger': Map<String, dynamic>.from(ledger)};
    await ContextMarkdownSidecar.dehydrate(working);
    await _writeJsonAtomic(
      _file(sup, AppStatePaths.ledgerFile),
      working['ledger'] as Map<String, dynamic>,
    );
    final manifestFile = _file(sup, AppStatePaths.manifestFile);
    if (await manifestFile.exists()) {
      final existing = await _readJsonFile(manifestFile);
      if (existing is Map) {
        final m = Map<String, dynamic>.from(existing);
        m['savedAtMs'] = DateTime.now().toUtc().millisecondsSinceEpoch;
        await _writeJsonAtomic(manifestFile, m);
        return;
      }
    }
    await _writeJsonAtomic(manifestFile, _manifestFromPaths());
  }

  /// Reads ledger JSON from disk and hydrates context markdown sidecars into memory.
  static Future<Map<String, dynamic>?> loadLedgerInline() async {
    final sup = await _supportDir();
    final decoded = await _readJsonFile(_file(sup, AppStatePaths.ledgerFile));
    if (decoded is! Map) return null;
    final assembled = <String, dynamic>{
      'formatVersion': kAppStateFormatVersion,
      'ledger': Map<String, dynamic>.from(decoded),
    };
    await ContextMarkdownSidecar.hydrate(assembled);
    return Map<String, dynamic>.from(assembled['ledger'] as Map);
  }
}
