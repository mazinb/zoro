import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import 'app_state_codec.dart';
import 'context_markdown_sidecar.dart';

const _fileName = 'app_state.json';

@pragma('vm:entry-point')
void _appStateJsonDecodeWorker(List<Object?> message) {
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

Future<Object?> _jsonDecodeInUtilityIsolate(String text) async {
  final port = ReceivePort();
  Isolate? isolate;
  try {
    isolate = await Isolate.spawn<List<Object?>>(
      _appStateJsonDecodeWorker,
      <Object?>[port.sendPort, text],
    );
    final result = await port.first;
    return result;
  } finally {
    port.close();
    isolate?.kill(priority: Isolate.immediate);
  }
}

/// Single JSON snapshot under app support dir (`app_state.json`). Export-friendly; API keys stay in secure storage.
class AppStateStore {
  static Future<File> _targetFile() async {
    final dir = await getApplicationSupportDirectory();
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return File('${dir.path}/$_fileName');
  }

  static Future<Map<String, dynamic>?> load() async {
    try {
      final f = await _targetFile();
      if (!await f.exists()) return null;
      final text = await f.readAsString();
      if (text.trim().isEmpty) return null;
      final decoded = await _jsonDecodeInUtilityIsolate(text);
      if (decoded is! Map) return null;
      final root = Map<String, dynamic>.from(decoded);
      final ver = root['formatVersion'];
      if (ver is! int || ver != kAppStateFormatVersion) return null;
      try {
        await ContextMarkdownSidecar.hydrate(root);
      } catch (e, st) {
        if (kDebugMode) {
          debugPrint('[AppStateStore] context markdown hydrate failed: $e\n$st');
        }
      }
      return root;
    } catch (_) {
      return null;
    }
  }

  /// Write-to-temp then rename so readers never see a half-written file.
  static Future<void> save(Map<String, dynamic> root) async {
    final toWrite = Map<String, dynamic>.from(root);
    await ContextMarkdownSidecar.dehydrate(toWrite);
    final target = await _targetFile();
    final dir = target.parent;
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final tmp = File('${dir.path}/.$_fileName.$stamp.tmp');
    final text = const JsonEncoder.withIndent('  ').convert(toWrite);
    await tmp.writeAsString(text, flush: true);
    await tmp.rename(target.path);
  }
}
