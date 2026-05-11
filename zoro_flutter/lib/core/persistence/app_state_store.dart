import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'app_state_codec.dart';

const _fileName = 'app_state.json';

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
      final decoded = jsonDecode(text);
      if (decoded is! Map) return null;
      final root = Map<String, dynamic>.from(decoded);
      final ver = root['formatVersion'];
      if (ver is! int || ver != kAppStateFormatVersion) return null;
      return root;
    } catch (_) {
      return null;
    }
  }

  /// Write-to-temp then rename so readers never see a half-written file.
  static Future<void> save(Map<String, dynamic> root) async {
    final target = await _targetFile();
    final dir = target.parent;
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final tmp = File('${dir.path}/.$_fileName.$stamp.tmp');
    final text = const JsonEncoder.withIndent('  ').convert(root);
    await tmp.writeAsString(text, flush: true);
    await tmp.rename(target.path);
  }
}
