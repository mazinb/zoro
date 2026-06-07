import 'dart:convert';

import 'package:http/http.dart' as http;

import '../state/app_model.dart';
import 'apple_foundation_channel.dart';

class LlmAttachment {
  const LlmAttachment({
    required this.bytes,
    required this.mimeType,
    this.fileName,
  });

  final List<int> bytes;
  final String mimeType;
  final String? fileName;

  bool get isImage => mimeType.startsWith('image/');
  bool get isPdf => mimeType == 'application/pdf';
}

class LlmCompleteResult {
  const LlmCompleteResult({required this.text, this.tokensUsed});

  final String text;
  final int? tokensUsed;
}

class LlmClient {
  LlmClient({
    http.Client? httpClient,
    AppleFoundationChannel? appleFoundationChannel,
  })  : _http = httpClient ?? http.Client(),
        _apple = appleFoundationChannel ?? AppleFoundationChannel();

  final http.Client _http;
  final AppleFoundationChannel _apple;

  Future<LlmCompleteResult> complete({
    required LlmProvider provider,
    required String apiKey,
    required String model,
    required String system,
    required String user,
    List<LlmAttachment> attachments = const [],
    int? maxOutputTokens,
    bool preferJsonObjectOutput = false,
  }) async {
    switch (provider) {
      case LlmProvider.appleFoundation:
        if (attachments.isNotEmpty) {
          throw const LlmException('Attachments are not supported with Apple on-device model yet.');
        }
        try {
          final text = await _apple.complete(
            system: system,
            user: user,
            maxOutputTokens: maxOutputTokens,
          );
          final inputTokens = await _apple.countTokens(system: system, user: user);
          final outputEstimate = (text.length / 4).ceil();
          return LlmCompleteResult(text: text, tokensUsed: inputTokens + outputEstimate);
        } on AppleFoundationChannelException catch (e) {
          throw LlmException(e.message);
        }
      case LlmProvider.openai:
        return _openAiChatCompletions(
          apiKey: apiKey,
          model: model,
          system: system,
          user: user,
          attachments: attachments,
          maxOutputTokens: maxOutputTokens,
          preferJsonObjectOutput: preferJsonObjectOutput,
        );
      case LlmProvider.anthropic:
        return _anthropicMessages(
          apiKey: apiKey,
          model: model,
          system: system,
          user: user,
          attachments: attachments,
          maxOutputTokens: maxOutputTokens,
        );
      case LlmProvider.gemini:
        return _geminiGenerateContent(
          apiKey: apiKey,
          model: model,
          system: system,
          user: user,
          attachments: attachments,
          maxOutputTokens: maxOutputTokens,
          preferJsonObjectOutput: preferJsonObjectOutput,
        );
    }
  }

  Future<LlmCompleteResult> _openAiChatCompletions({
    required String apiKey,
    required String model,
    required String system,
    required String user,
    required List<LlmAttachment> attachments,
    int? maxOutputTokens,
    bool preferJsonObjectOutput = false,
  }) async {
    // OpenAI rejects json_object unless some message contains the word "json".
    var effectiveSystem = system;
    if (preferJsonObjectOutput &&
        !'$system\n\n$user'.toLowerCase().contains('json')) {
      effectiveSystem =
          '$system\n\nWhen returning structured output, reply as a JSON object (valid json).';
    }
    final hasAttachments = attachments.isNotEmpty;
    final userContent = hasAttachments
        ? <Map<String, Object?>>[
            {'type': 'text', 'text': user},
            for (final a in attachments)
              if (a.isImage)
                {
                  'type': 'image_url',
                  'image_url': {
                    'url': 'data:${a.mimeType};base64,${base64Encode(a.bytes)}',
                  },
                }
              else
                {
                  'type': 'text',
                  'text':
                      '[Attachment "${a.fileName ?? 'file'}" (${a.mimeType}) not supported on OpenAI chat.completions. If you need it, ask the user to export to text/CSV or switch to Gemini for PDF.]',
                },
          ]
        : user;
    final requestBody = <String, dynamic>{
      'model': model,
      'messages': [
        {'role': 'system', 'content': effectiveSystem},
        {'role': 'user', 'content': userContent},
      ],
    };
    _applyOpenAiOutputTokenLimit(requestBody, model: model, maxOutputTokens: maxOutputTokens);
    if (preferJsonObjectOutput) {
      requestBody['response_format'] = {'type': 'json_object'};
    }
    return _postOpenAiChatCompletionWithTokenFallback(apiKey: apiKey, requestBody: requestBody);
  }

  static bool _openAiPrefersMaxCompletionTokens(String model) {
    final m = model.toLowerCase();
    return m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3');
  }

  static void _applyOpenAiOutputTokenLimit(
    Map<String, dynamic> requestBody, {
    required String model,
    required int? maxOutputTokens,
  }) {
    requestBody.remove('max_tokens');
    requestBody.remove('max_completion_tokens');
    if (maxOutputTokens == null) return;
    if (_openAiPrefersMaxCompletionTokens(model)) {
      requestBody['max_completion_tokens'] = maxOutputTokens;
    } else {
      requestBody['max_tokens'] = maxOutputTokens;
    }
  }

  static int? _totalTokensFromUsage(Object? usage) {
    if (usage is! Map) return null;
    final m = Map<String, dynamic>.from(usage);
    final total = m['total_tokens'];
    if (total is num) return total.round();
    final prompt = m['prompt_tokens'];
    final completion = m['completion_tokens'];
    if (prompt is num && completion is num) return prompt.round() + completion.round();
    return null;
  }

  Future<LlmCompleteResult> _postOpenAiChatCompletionWithTokenFallback({
    required String apiKey,
    required Map<String, dynamic> requestBody,
  }) async {
    Future<http.Response> post() => _http.post(
          Uri.parse('https://api.openai.com/v1/chat/completions'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $apiKey',
          },
          body: jsonEncode(requestBody),
        );

    var res = await post();
    var body = _decodeJson(res.body);
    if (res.statusCode == 400) {
      final msg = body['error']?['message']?.toString().toLowerCase() ?? '';
      final swapped = _swapOpenAiTokenParamOn400(requestBody, errorMessage: msg);
      if (swapped) {
        res = await post();
        body = _decodeJson(res.body);
      }
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = body['error']?['message']?.toString() ?? body['error']?.toString() ?? 'OpenAI request failed';
      throw LlmException(msg, statusCode: res.statusCode);
    }
    final choices = body['choices'];
    if (choices is List && choices.isNotEmpty) {
      final content = choices.first?['message']?['content']?.toString();
      if (content != null && content.trim().isNotEmpty) {
        return LlmCompleteResult(
          text: content.trim(),
          tokensUsed: _totalTokensFromUsage(body['usage']),
        );
      }
    }
    throw const LlmException('OpenAI returned no content');
  }

  /// Returns true if the request body was modified for a retry.
  static bool _swapOpenAiTokenParamOn400(Map<String, dynamic> requestBody, {required String errorMessage}) {
    if (requestBody.containsKey('max_tokens') && errorMessage.contains('max_completion_tokens')) {
      final v = requestBody.remove('max_tokens');
      requestBody['max_completion_tokens'] = v;
      return true;
    }
    if (requestBody.containsKey('max_completion_tokens') &&
        errorMessage.contains('max_tokens') &&
        !errorMessage.contains('max_completion_tokens')) {
      final v = requestBody.remove('max_completion_tokens');
      requestBody['max_tokens'] = v;
      return true;
    }
    return false;
  }

  Future<LlmCompleteResult> _anthropicMessages({
    required String apiKey,
    required String model,
    required String system,
    required String user,
    required List<LlmAttachment> attachments,
    int? maxOutputTokens,
  }) async {
    final uri = Uri.parse('https://api.anthropic.com/v1/messages');
    final hasAttachments = attachments.isNotEmpty;
    final userBlocks = hasAttachments
        ? <Map<String, Object?>>[
            {'type': 'text', 'text': user},
            for (final a in attachments)
              if (a.isImage)
                {
                  'type': 'image',
                  'source': {
                    'type': 'base64',
                    'media_type': a.mimeType,
                    'data': base64Encode(a.bytes),
                  },
                }
              else
                {
                  'type': 'text',
                  'text':
                      '[Attachment "${a.fileName ?? 'file'}" (${a.mimeType}) not supported as a native document block here. If you need it, ask the user to export to text/CSV or switch to Gemini for PDF.]',
                },
          ]
        : null;
    final res = await _http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: jsonEncode({
        'model': model,
        'max_tokens': maxOutputTokens ?? 800,
        'system': system,
        'messages': [
          {'role': 'user', 'content': userBlocks ?? user},
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
      if (text != null && text.trim().isNotEmpty) {
        final usage = body['usage'];
        int? tokens;
        if (usage is Map) {
          final u = Map<String, dynamic>.from(usage);
          final input = u['input_tokens'];
          final output = u['output_tokens'];
          if (input is num && output is num) {
            tokens = input.round() + output.round();
          }
        }
        return LlmCompleteResult(text: text.trim(), tokensUsed: tokens);
      }
    }
    throw const LlmException('Anthropic returned no content');
  }

  Future<LlmCompleteResult> _geminiGenerateContent({
    required String apiKey,
    required String model,
    required String system,
    required String user,
    required List<LlmAttachment> attachments,
    int? maxOutputTokens,
    bool preferJsonObjectOutput = false,
  }) async {
    final safeModel = model.trim().isEmpty ? 'gemini-1.5-pro' : model.trim();
    final uri = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/$safeModel:generateContent?key=$apiKey',
    );
    final parts = <Map<String, Object?>>[
      {'text': '$system\n\n---\n\n$user'},
      for (final a in attachments)
        {
          'inlineData': {
            'mimeType': a.mimeType,
            'data': base64Encode(a.bytes),
          },
        },
    ];
    final generationConfig = <String, Object?>{
      'maxOutputTokens': maxOutputTokens ?? 800,
      if (preferJsonObjectOutput) 'responseMimeType': 'application/json',
    };
    final res = await _http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'generationConfig': generationConfig,
        'contents': [
          {
            'role': 'user',
            'parts': [
              ...parts,
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
        if (text != null && text.trim().isNotEmpty) {
          final meta = body['usageMetadata'];
          int? tokens;
          if (meta is Map) {
            final m = Map<String, dynamic>.from(meta);
            final total = m['totalTokenCount'];
            if (total is num) {
              tokens = total.round();
            } else {
              final prompt = m['promptTokenCount'];
              final candidates = m['candidatesTokenCount'];
              if (prompt is num && candidates is num) {
                tokens = prompt.round() + candidates.round();
              }
            }
          }
          return LlmCompleteResult(text: text.trim(), tokensUsed: tokens);
        }
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

