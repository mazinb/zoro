import '../llm/llm_client.dart';
import '../state/app_model.dart';
import 'hermes_adapter.dart';
import 'mcp/zoro_mcp_tools.dart';
import 'skill_matcher.dart';

/// Turns Agent-tab chat into an LLM completion using Apple on-device when
/// available, otherwise Cloud AI / the active BYO key.
abstract final class AgentChatService {
  static const _maxHistoryTurns = 8;
  static const _maxPlanChars = 2500;
  static const _maxOutputTokens = 700;

  static LlmProvider? resolveProvider(AppModel model) {
    if (model.isLlmProviderReady(LlmProvider.appleFoundation)) {
      return LlmProvider.appleFoundation;
    }
    if (model.isLlmProviderReady(LlmProvider.zoroCloud)) {
      return LlmProvider.zoroCloud;
    }
    final active = model.activeLlmProvider;
    if (model.isLlmProviderReady(active)) return active;
    return null;
  }

  static bool isReady(AppModel model) => resolveProvider(model) != null;

  static String statusLabel(AppModel model) {
    final provider = resolveProvider(model);
    return switch (provider) {
      LlmProvider.appleFoundation => 'On device',
      LlmProvider.zoroCloud => 'Cloud AI',
      LlmProvider.openai ||
      LlmProvider.anthropic ||
      LlmProvider.gemini => 'Your API key',
      null => 'Unavailable',
    };
  }

  static String unavailableHint(AppModel model) =>
      model.llmAssistantUnavailableMessage;

  static Future<String> reply({
    required AppModel model,
    required String prompt,
    required List<({bool fromAgent, String text})> history,
    LlmClient? llm,
  }) async {
    final provider = resolveProvider(model);
    if (provider == null) {
      throw LlmException(model.llmAssistantUnavailableMessage);
    }

    final hermes = model.agentWorkspace.hermesStatus;
    if (hermes.isReady) {
      final packs = await model.agentWorkspace.skills?.installedPacks() ?? [];
      final matched = SkillMatcher.match(packs: packs, prompt: prompt);
      final result = await model.agentWorkspace.hermes.run(
        HermesRunRequest(
          hermesHomePath: model.agentWorkspace.home.path,
          enabledSkillIds: [for (final p in matched) p.name],
          prompt: prompt,
          grantedTools: ZoroMcpTools.toolNames,
        ),
      );
      final text = result.message.trim();
      if (result.ok && text.isNotEmpty) return text;
      if (!result.ok && text.isNotEmpty) {
        throw LlmException(text);
      }
    }
    if (provider == LlmProvider.appleFoundation) {
      await model.refreshAppleFoundationCapabilities();
      if (!model.appleFoundationRuntimeAvailable) {
        throw LlmException(model.llmAssistantUnavailableMessage);
      }
      if (!model.appleFoundationEnabled) {
        model.setAppleFoundationEnabled(true);
      }
    }

    final apiKey = model.apiKeyFor(provider);
    if (apiKey == null) {
      throw LlmException(model.llmAssistantUnavailableMessage);
    }

    final modelName = model.modelFor(provider);
    final client = llm ?? LlmClient();
    final result = await client.complete(
      provider: provider,
      apiKey: apiKey,
      model: modelName,
      system: _systemPrompt(model),
      user: _userPrompt(prompt: prompt, history: history),
      maxOutputTokens: _maxOutputTokens,
      zoroApi: provider == LlmProvider.zoroCloud ? model.api : null,
      zoroDeviceId: provider == LlmProvider.zoroCloud ? model.deviceId : null,
      onboardingPhase: model.inSetupImportPhase,
    );
    model.recordLlmRequest(
      provider: provider,
      model: modelName,
      tokensUsed: result.tokensUsed,
      entitlementsApiBody: result.entitlementsApiBody,
    );
    model.setPendingLlmCompletionMetadata(
      model: '${provider.name}:$modelName',
      tokensUsed: result.tokensUsed,
    );

    final text = result.text.trim();
    if (text.isEmpty) {
      throw const LlmException('No reply came back. Try again.');
    }
    return text;
  }

  static String _systemPrompt(AppModel model) {
    final plan = model.retirementMarkdownCache.trim();
    final clipped = plan.length > _maxPlanChars
        ? '${plan.substring(0, _maxPlanChars)}\n…'
        : plan;
    final mailbox = model.agentWorkspace.identity.mailboxAddress?.trim() ?? '';
    final claimed = model.agentWorkspace.identity.claimedEmail?.trim() ?? '';
    final buf = StringBuffer()
      ..writeln(
        'You are Zoro’s private financial agent on this phone. Be concise, practical, and privacy-minded.',
      )
      ..writeln(
        'Help with retirement planning, savings/invest split, statements, and next money actions.',
      )
      ..writeln(
        'Do not invent account balances. If data is missing, say what the user should open in the app.',
      )
      ..writeln(
        'Prefer short paragraphs or short bullets. No markdown fences.',
      );
    if (clipped.isNotEmpty) {
      buf
        ..writeln()
        ..writeln('Living retirement plan on this phone:')
        ..writeln(clipped);
    }
    if (mailbox.isNotEmpty) {
      buf
        ..writeln()
        ..writeln('Private mailbox: $mailbox')
        ..writeln(
          claimed.isEmpty
              ? 'Accepts PDFs from the claimed email only.'
              : 'Accepts PDFs from $claimed only.',
        );
    }
    buf
      ..writeln()
      ..writeln(
        'On-device skills (local): mailbox-triage, ingest-pdf, retirement-plan, update-context, ledger-from-statement, ledger-review, expense-calibration, corpus-backtest, savings-goals, home-briefing, notify-schedule.',
      )
      ..writeln('Slash commands run locally and do not spend tokens.');
    return buf.toString().trim();
  }

  static String _userPrompt({
    required String prompt,
    required List<({bool fromAgent, String text})> history,
  }) {
    final recent = history.length > _maxHistoryTurns
        ? history.sublist(history.length - _maxHistoryTurns)
        : history;
    final buf = StringBuffer();
    for (final turn in recent) {
      buf
        ..writeln(turn.fromAgent ? 'Agent:' : 'User:')
        ..writeln(turn.text.trim())
        ..writeln();
    }
    buf
      ..writeln('User:')
      ..writeln(prompt.trim())
      ..writeln()
      ..writeln('Agent:');
    return buf.toString().trim();
  }
}
