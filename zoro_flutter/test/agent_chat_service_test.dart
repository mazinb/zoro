import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/agent/agent_chat_service.dart';
import 'package:zoro_flutter/core/llm/llm_client.dart';
import 'package:zoro_flutter/core/state/app_model.dart';

void main() {
  test('statusLabel is Unavailable when no provider is ready', () {
    final model = AppModel();
    expect(AgentChatService.resolveProvider(model), isNull);
    expect(AgentChatService.statusLabel(model), 'Unavailable');
    expect(AgentChatService.isReady(model), isFalse);
  });

  test('reply throws LlmException when no provider is ready', () async {
    final model = AppModel();
    await expectLater(
      AgentChatService.reply(
        model: model,
        prompt: 'What should I do next?',
        history: const [],
      ),
      throwsA(isA<LlmException>()),
    );
  });
}
