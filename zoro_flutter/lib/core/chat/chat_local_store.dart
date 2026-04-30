import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../state/app_model.dart';
import 'chat_message.dart';

const _fileName = 'chat_local_store.json';
const _version = 1;

/// Loads and saves chat threads and per-thread messages on device (no server).
class ChatLocalStore {
  static Future<File> _file() async {
    final dir = await getApplicationSupportDirectory();
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return File('${dir.path}/$_fileName');
  }

  static Map<String, dynamic> _threadToJson(AgentChatThread t) => {
        'id': t.id,
        'agentId': t.agentId,
        'title': t.title,
        'createdAtMs': t.createdAt.millisecondsSinceEpoch,
        'updatedAtMs': t.updatedAt.millisecondsSinceEpoch,
        'messageCount': t.messageCount,
        'tokensUsed': t.tokensUsed,
        'lastLine': t.lastLine,
      };

  static AgentChatThread? _threadFromJson(Object? raw) {
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
    return AgentChatThread(
      id: id,
      agentId: agentId,
      title: title,
      createdAt: DateTime.fromMillisecondsSinceEpoch(ms('createdAtMs', now.millisecondsSinceEpoch)),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(ms('updatedAtMs', now.millisecondsSinceEpoch)),
      messageCount: m['messageCount'] is int ? m['messageCount'] as int : (m['messageCount'] is num ? (m['messageCount'] as num).round() : 0),
      tokensUsed: m['tokensUsed'] is int ? m['tokensUsed'] as int : (m['tokensUsed'] is num ? (m['tokensUsed'] as num).round() : 0),
      lastLine: m['lastLine']?.toString() ?? '',
    );
  }

  static Future<({List<AgentChatThread> threads, Map<String, List<ChatMessage>> messages})?> load() async {
    try {
      final f = await _file();
      if (!await f.exists()) return null;
      final text = await f.readAsString();
      if (text.trim().isEmpty) return null;
      final decoded = jsonDecode(text);
      if (decoded is! Map) return null;
      final root = Map<String, dynamic>.from(decoded);
      if (root['version'] != _version) return null;
      final threadsRaw = root['threads'];
      if (threadsRaw is! List) return null;
      final threads = <AgentChatThread>[];
      for (final e in threadsRaw) {
        final t = _threadFromJson(e);
        if (t != null) threads.add(t);
      }
      final messages = <String, List<ChatMessage>>{};
      final msgRoot = root['messages'];
      if (msgRoot is Map) {
        for (final e in msgRoot.entries) {
          final id = e.key.toString();
          final list = e.value;
          if (list is! List) continue;
          final out = <ChatMessage>[];
          for (final row in list) {
            final cm = ChatMessage.fromJson(row);
            if (cm != null) out.add(cm);
          }
          messages[id] = out;
        }
      }
      return (threads: threads, messages: messages);
    } catch (_) {
      return null;
    }
  }

  static Future<void> save({
    required List<AgentChatThread> threads,
    required Map<String, List<ChatMessage>> messagesByThread,
  }) async {
    final f = await _file();
    final payload = <String, dynamic>{
      'version': _version,
      'threads': threads.map(_threadToJson).toList(),
      'messages': {
        for (final e in messagesByThread.entries)
          e.key: e.value.map((m) => m.toJson()).toList(),
      },
    };
    await f.writeAsString(const JsonEncoder.withIndent('  ').convert(payload));
  }
}
