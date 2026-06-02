import 'dart:convert';

import 'llm_client.dart';

String _stripInvalidJsonEscapes(String s) {
  // Fix common model bug: escaping punctuation inside JSON strings, e.g. "\\-".
  // JSON only permits escapes: \" \\ \/ \b \f \n \r \t \uXXXX
  final out = StringBuffer();
  var inString = false;
  var escaped = false;
  for (var i = 0; i < s.length; i++) {
    final ch = s[i];
    if (!inString) {
      if (ch == '"') inString = true;
      out.write(ch);
      continue;
    }
    if (escaped) {
      // If previous char was backslash, only keep it if the escape is valid.
      const valid = {'"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'};
      if (valid.contains(ch)) {
        out.write('\\');
        out.write(ch);
      } else {
        // Drop the backslash and keep the character.
        out.write(ch);
      }
      escaped = false;
      continue;
    }
    if (ch == '\\') {
      escaped = true;
      continue;
    }
    if (ch == '"') inString = false;
    out.write(ch);
  }
  // If the string ended right after a backslash, keep it (best effort).
  if (escaped) out.write('\\');
  return out.toString();
}

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
    if (msg.contains('Unrecognized string escape')) {
      final fixed = _stripInvalidJsonEscapes(s);
      decoded = jsonDecode(fixed);
    } else
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

/// If [raw] is not valid JSON, runs [repairWith] once and parses its output.
Future<Map<String, dynamic>> decodeLlmJsonObjectWithRepair(
  String raw, {
  required Future<String> Function(String brokenJson) repairWith,
}) async {
  try {
    return decodeLlmJsonObject(raw);
  } catch (_) {
    final fixed = await repairWith(raw);
    return decodeLlmJsonObject(fixed);
  }
}
