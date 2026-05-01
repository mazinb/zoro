import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../state/scheduled_agent_task.dart';

const _fileName = 'scheduled_agent_tasks.json';

class ScheduledAgentStore {
  static Future<File> _file() async {
    final dir = await getApplicationSupportDirectory();
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return File('${dir.path}/$_fileName');
  }

  /// `null` if no file yet (first launch).
  static Future<List<ScheduledAgentTask>?> load() async {
    try {
      final f = await _file();
      if (!await f.exists()) return null;
      final text = await f.readAsString();
      if (text.trim().isEmpty) return null;
      return decodeScheduledAgentTasksJson(text);
    } catch (_) {
      return null;
    }
  }

  static Future<void> save(List<ScheduledAgentTask> tasks) async {
    final f = await _file();
    await f.writeAsString(encodeScheduledAgentTasksJson(tasks));
  }
}
