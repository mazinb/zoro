import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'portfolio_valuation_service.dart';

class PortfolioChatMessage {
  const PortfolioChatMessage({required this.role, required this.content});
  final String role;
  final String content;

  Map<String, String> toJson() => {'role': role, 'content': content};
}

class PortfolioChatEvent {
  const PortfolioChatEvent({
    required this.type,
    this.text,
    this.name,
    this.state,
    this.detail,
    this.tools,
    this.elapsedMs,
    this.position,
  });

  final String type;
  final String? text;
  final String? name;
  final String? state;
  final String? detail;
  final List<String>? tools;
  final double? elapsedMs;
  final int? position;

  factory PortfolioChatEvent.fromJson(Map<String, dynamic> j) {
    final toolsRaw = j['tools'];
    return PortfolioChatEvent(
      type: (j['type'] ?? '').toString(),
      text: j['text']?.toString(),
      name: j['name']?.toString(),
      state: j['state']?.toString(),
      detail: j['detail']?.toString(),
      tools: toolsRaw is List ? [for (final t in toolsRaw) '$t'] : null,
      elapsedMs: j['elapsed_ms'] is num ? (j['elapsed_ms'] as num).toDouble() : null,
      position: j['position'] is num ? (j['position'] as num).toInt() : int.tryParse('${j['position']}'),
    );
  }
}

/// Streams Qwen + IBKR tool chat from Covered Call Assistant.
class PortfolioChatService {
  PortfolioChatService({
    this.baseUrl = PortfolioValuationService.defaultBase,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Uri get chatPageUri => Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/zoro/chat');
  Uri get streamUri => Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/zoro/chat/stream');

  Uri chatPageWithToken(String token) =>
      chatPageUri.replace(queryParameters: {'token': token.trim()});

  Stream<PortfolioChatEvent> stream({
    required String token,
    required String message,
    List<PortfolioChatMessage> history = const [],
    bool agent = false,
  }) async* {
    final req = http.Request('POST', streamUri)
      ..headers['Content-Type'] = 'application/json'
      ..headers['Accept'] = 'application/x-ndjson'
      ..body = jsonEncode({
        'token': token.trim(),
        'message': message.trim(),
        'history': [for (final m in history.take(8)) m.toJson()],
        'use_mcp': true,
        'agent': agent,
      });
    final streamed = await _client.send(req).timeout(const Duration(seconds: 20));
    if (streamed.statusCode >= 400) {
      final body = await streamed.stream.bytesToString();
      String detail = 'http_${streamed.statusCode}';
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map && decoded['detail'] != null) detail = '${decoded['detail']}';
        if (decoded is Map && decoded['error'] != null) detail = '${decoded['error']}';
      } catch (_) {}
      yield PortfolioChatEvent(type: 'error', detail: detail);
      return;
    }
    var buf = '';
    await for (final chunk in streamed.stream.transform(utf8.decoder)) {
      buf += chunk;
      while (true) {
        final nl = buf.indexOf('\n');
        if (nl < 0) break;
        final line = buf.substring(0, nl).trim();
        buf = buf.substring(nl + 1);
        if (line.isEmpty) continue;
        try {
          final map = jsonDecode(line);
          if (map is Map<String, dynamic>) {
            yield PortfolioChatEvent.fromJson(map);
          }
        } catch (_) {}
      }
    }
  }
}
