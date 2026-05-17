import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'agent_json.dart';
import 'app_state_paths.dart';
import '../state/app_model.dart';

/// User-defined [AppAgent] definitions — one JSON file per agent under [AppStatePaths.agentsDir].
abstract final class AgentsStore {
  static String _safeFileName(String id) =>
      id.replaceAll(RegExp(r'[^a-zA-Z0-9_.\-]'), '_');

  static Future<Directory> _agentsDir() async {
    final sup = await getApplicationSupportDirectory();
    final d = Directory('${sup.path}/${AppStatePaths.agentsDir}');
    if (!await d.exists()) {
      await d.create(recursive: true);
    }
    return d;
  }

  static Future<void> _writeJsonFile(File f, Object value) async {
    final text = const JsonEncoder.withIndent('  ').convert(value);
    await f.parent.create(recursive: true);
    final tmp = File('${f.path}.${DateTime.now().microsecondsSinceEpoch}.tmp');
    await tmp.writeAsString(text, flush: true);
    await tmp.rename(f.path);
  }

  /// Persists agents from a snapshot `settings.agents` list (maps or encoded agents).
  static Future<void> saveFromSettingsAgents(Object? agentsRaw) async {
    final dir = await _agentsDir();
    final ids = <String>[];
    if (agentsRaw is List) {
      for (final e in agentsRaw) {
        Map<String, dynamic>? m;
        if (e is AppAgent) {
          m = appAgentToJson(e);
        } else if (e is Map) {
          m = Map<String, dynamic>.from(e);
        }
        final id = m?['id']?.toString();
        if (m == null || id == null || id.isEmpty) continue;
        await _writeJsonFile(File('${dir.path}/${_safeFileName(id)}.json'), m);
        ids.add(id);
      }
    }

    // Drop stale agent files.
    if (await dir.exists()) {
      final keep = ids.map(_safeFileName).toSet();
      await for (final ent in dir.list()) {
        if (ent is! File) continue;
        final name = ent.uri.pathSegments.last;
        if (name == '_index.json') continue;
        if (!name.endsWith('.json')) continue;
        final stem = name.substring(0, name.length - 5);
        if (!keep.contains(stem)) {
          await ent.delete();
        }
      }
    }

    await _writeJsonFile(
      File('${dir.path}/_index.json'),
      {'version': 1, 'ids': ids},
    );
  }

  static Future<List<dynamic>> loadAsJsonList() async {
    final dir = await _agentsDir();
    final indexFile = File('${dir.path}/_index.json');
    if (!await indexFile.exists()) return [];
    final indexDecoded = jsonDecode(await indexFile.readAsString());
    if (indexDecoded is! Map) return [];
    final idsRaw = indexDecoded['ids'];
    if (idsRaw is! List) return [];
    final out = <dynamic>[];
    for (final id in idsRaw) {
      final idStr = id.toString();
      final f = File('${dir.path}/${_safeFileName(idStr)}.json');
      if (!await f.exists()) continue;
      final decoded = jsonDecode(await f.readAsString());
      if (decoded is Map) out.add(Map<String, dynamic>.from(decoded));
    }
    return out;
  }
}
