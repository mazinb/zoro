import '../state/app_model.dart';
import 'llm_client.dart';
import 'llm_json.dart';

/// Uses [AppModel.activeLlmProvider] (cloud API key or on-device model).
Future<String> completeForActiveProvider(
  AppModel model, {
  required String system,
  required String user,
  int? maxOutputTokens,
  bool preferJsonObjectOutput = false,
}) async {
  final provider = model.activeLlmProvider;
  final key = model.apiKeyFor(provider);
  if (key == null) {
    throw LlmException('Missing API key for ${provider.name}');
  }
  final modelName = model.modelFor(provider);
  final out = await LlmClient().complete(
    provider: provider,
    apiKey: key,
    model: modelName,
    system: system,
    user: user,
    maxOutputTokens: maxOutputTokens,
    preferJsonObjectOutput: preferJsonObjectOutput && provider == LlmProvider.openai,
  );
  model.recordLlmRequest(provider: provider, model: modelName);
  model.setPendingLlmCompletionMetadata(
    model: '${provider.name}:$modelName',
    tokensUsed: out.tokensUsed,
  );
  return out.text;
}

/// Parses model JSON; on failure runs one repair pass via the active provider.
Future<Map<String, dynamic>> decodeActiveProviderJsonWithRepair(
  AppModel model,
  String raw, {
  int maxRepairTokens = 8192,
}) {
  return decodeLlmJsonObjectWithRepair(
    raw,
    repairWith: (broken) => completeForActiveProvider(
      model,
      system:
          'You only fix broken JSON. Return a single valid JSON object preserving schema and meaning. No markdown fences or prose outside JSON.',
      user: broken,
      maxOutputTokens: maxRepairTokens,
      preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
    ),
  );
}
