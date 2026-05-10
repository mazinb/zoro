import '../state/app_model.dart';
import 'llm_client.dart';

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
  return LlmClient().complete(
    provider: provider,
    apiKey: key,
    model: model.modelFor(provider),
    system: system,
    user: user,
    maxOutputTokens: maxOutputTokens,
    preferJsonObjectOutput: preferJsonObjectOutput && provider == LlmProvider.openai,
  );
}
