import 'dart:convert';
import 'dart:io';

import 'hermes_home_paths.dart';

/// One persisted chat turn. Only completed turns are stored; in-flight
/// thinking/stalled states stay in memory.
class ChatTurn {
  const ChatTurn({
    required this.fromAgent,
    required this.text,
    required this.at,
    this.failed = false,
  });

  factory ChatTurn.fromJson(Map<String, dynamic> json) => ChatTurn(
    fromAgent: json['fromAgent'] == true,
    text: (json['text'] as String?) ?? '',
    at:
        DateTime.tryParse((json['at'] as String?) ?? '')?.toUtc() ??
        DateTime.now().toUtc(),
    failed: json['failed'] == true,
  );

  final bool fromAgent;
  final String text;
  final DateTime at;
  final bool failed;

  Map<String, dynamic> toJson() => {
    'fromAgent': fromAgent,
    'text': text,
    'at': at.toUtc().toIso8601String(),
    if (failed) 'failed': true,
  };
}

/// Chat transcript kept on device so past conversations survive app restarts.
class ChatHistoryStore {
  ChatHistoryStore(this.home);

  /// Older turns are dropped so the transcript cannot grow without bound.
  static const maxTurns = 400;

  final Directory home;

  File get _file => File('${home.path}/${HermesHomePaths.chatHistoryFile}');

  Future<void> ensure() async {
    await Directory(
      '${home.path}/${HermesHomePaths.chatDir}',
    ).create(recursive: true);
  }

  Future<List<ChatTurn>> load() async {
    try {
      final f = _file;
      if (!await f.exists()) return [];
      final raw = jsonDecode(await f.readAsString());
      if (raw is! Map) return [];
      final turns = raw['turns'];
      if (turns is! List) return [];
      return [
        for (final e in turns)
          if (e is Map) ChatTurn.fromJson(Map<String, dynamic>.from(e)),
      ];
    } catch (_) {
      return [];
    }
  }

  Future<void> save(List<ChatTurn> turns) async {
    await ensure();
    final trimmed = turns.length > maxTurns
        ? turns.sublist(turns.length - maxTurns)
        : turns;
    final tmp = File('${_file.path}.tmp');
    await tmp.writeAsString(
      jsonEncode({
        'version': HermesHomePaths.protocolVersion,
        'turns': [for (final t in trimmed) t.toJson()],
      }),
      flush: true,
    );
    await tmp.rename(_file.path);
  }

  Future<void> clear() async {
    await ensure();
    if (await _file.exists()) await _file.delete();
  }
}
