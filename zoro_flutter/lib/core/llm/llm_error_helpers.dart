import '../state/app_model.dart';

/// Providers the user can run an LLM with right now (on-device or cloud with consent).
List<LlmProvider> llmProvidersReady(AppModel model) {
  return [
    for (final p in LlmProvider.values)
      if (model.isLlmProviderReady(p)) p,
  ];
}

String shortLlmLabel(LlmProvider p) => switch (p) {
      LlmProvider.appleFoundation => 'Apple on-device',
      LlmProvider.openai => 'OpenAI',
      LlmProvider.anthropic => 'Anthropic',
      LlmProvider.gemini => 'Gemini',
    };

/// One line suggesting other models (for import / large-context errors).
String? otherLlmSuggestionLine(AppModel model, {required LlmProvider current}) {
  final others = llmProvidersReady(model).where((p) => p != current).toList();
  if (others.isEmpty) return null;
  final names = others.map(shortLlmLabel).join(', ');
  return 'Try: $names (pick above).';
}

bool messageLooksLikeContextOrTokenLimit(String message) {
  final m = message.toLowerCase();
  return m.contains('context') &&
          (m.contains('exceed') ||
              m.contains('window') ||
              m.contains('too long') ||
              m.contains('length') ||
              m.contains('token'));
}

bool messageLooksLikeJsonOrDecodeIssue(String message) {
  final m = message.toLowerCase();
  return m.contains('json') ||
      m.contains('format') ||
      m.contains('truncat') ||
      m.contains('unexpected') ||
      m.contains('unterminated');
}
