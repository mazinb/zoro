import 'dart:convert';

import 'llm_client.dart';

/// Strips optional ``` fences and parses a single JSON object.
Map<String, dynamic> decodeLlmJsonObject(String raw) {
  var s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replaceFirst(RegExp(r'^```(?:json)?\s*'), '');
    s = s.replaceFirst(RegExp(r'\s*```\s*$'), '');
    s = s.trim();
  }
  final i = s.indexOf('{');
  final j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    s = s.substring(i, j + 1);
  }
  Object? decoded;
  try {
    decoded = jsonDecode(s);
  } on FormatException catch (e) {
    final msg = e.message;
    if (msg.contains('Unterminated') || msg.contains('Unexpected end')) {
      throw FormatException(
        'Model JSON looks truncated or invalid (try again or use fewer rows). Original: $msg',
        e.source,
        e.offset,
      );
    }
    rethrow;
  }
  if (decoded is Map<String, dynamic>) return decoded;
  if (decoded is Map) return Map<String, dynamic>.from(decoded);
  throw const LlmException('LLM output was not a JSON object');
}
