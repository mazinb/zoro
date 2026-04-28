import 'dart:convert';

import 'package:http/http.dart' as http;

import '../state/app_model.dart';

class LlmClient {
  LlmClient({http.Client? httpClient}) : _http = httpClient ?? http.Client();

  final http.Client _http;

  Future<String> complete({
    required LlmProvider provider,
    required String apiKey,
    required String model,
    required String system,
    required String user,
  }) async {
    switch (provider) {
      case LlmProvider.openai:
        return _openAiChatCompletions(apiKey: apiKey, model: model, system: system, user: user);
      case LlmProvider.anthropic:
        return _anthropicMessages(apiKey: apiKey, model: model, system: system, user: user);
      case LlmProvider.gemini:
        return _geminiGenerateContent(apiKey: apiKey, model: model, system: system, user: user);
    }
  }

  Future<String> _openAiChatCompletions({
    required String apiKey,
    required String model,
    required String system,
    required String user,
  }) async {
    final uri = Uri.parse('https://api.openai.com/v1/chat/completions');
    final res = await _http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $apiKey',
      },
      body: jsonEncode({
        'model': model,
        'messages': [
          {'role': 'system', 'content': system},
          {'role': 'user', 'content': user},
        ],
      }),
    );
    final body = _decodeJson(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = body['error']?['message']?.toString() ?? body['error']?.toString() ?? 'OpenAI request failed';
      throw LlmException(msg, statusCode: res.statusCode);
    }
    final choices = body['choices'];
    if (choices is List && choices.isNotEmpty) {
      final content = choices.first?['message']?['content']?.toString();
      if (content != null && content.trim().isNotEmpty) return content.trim();
    }
    throw const LlmException('OpenAI returned no content');
  }

  Future<String> _anthropicMessages({
    required String apiKey,
    required String model,
    required String system,
    required String user,
  }) async {
    final uri = Uri.parse('https://api.anthropic.com/v1/messages');
    final res = await _http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: jsonEncode({
        'model': model,
        'max_tokens': 800,
        'system': system,
        'messages': [
          {'role': 'user', 'content': user},
        ],
      }),
    );
    final body = _decodeJson(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = body['error']?['message']?.toString() ?? body['error']?.toString() ?? 'Anthropic request failed';
      throw LlmException(msg, statusCode: res.statusCode);
    }
    final content = body['content'];
    if (content is List && content.isNotEmpty) {
      final text = content.first?['text']?.toString();
      if (text != null && text.trim().isNotEmpty) return text.trim();
    }
    throw const LlmException('Anthropic returned no content');
  }

  Future<String> _geminiGenerateContent({
    required String apiKey,
    required String model,
    required String system,
    required String user,
  }) async {
    final safeModel = model.trim().isEmpty ? 'gemini-1.5-pro' : model.trim();
    final uri = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/$safeModel:generateContent?key=$apiKey',
    );
    final res = await _http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'generationConfig': {
          'maxOutputTokens': 800,
        },
        'contents': [
          {
            'role': 'user',
            'parts': [
              {'text': '$system\n\n---\n\n$user'},
            ],
          }
        ],
      }),
    );
    final body = _decodeJson(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = body['error']?['message']?.toString() ?? body['error']?.toString() ?? 'Gemini request failed';
      throw LlmException(msg, statusCode: res.statusCode);
    }
    final candidates = body['candidates'];
    if (candidates is List && candidates.isNotEmpty) {
      final parts = candidates.first?['content']?['parts'];
      if (parts is List && parts.isNotEmpty) {
        final text = parts.first?['text']?.toString();
        if (text != null && text.trim().isNotEmpty) return text.trim();
      }
    }
    throw const LlmException('Gemini returned no content');
  }

  Map<String, dynamic> _decodeJson(String raw) {
    if (raw.isEmpty) return {};
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
    return {};
  }
}

class LlmException implements Exception {
  const LlmException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => statusCode == null ? message : '$message (HTTP $statusCode)';
}

