import 'package:flutter/foundation.dart';

import '../chat/agent_chat_prompts.dart';
import '../chat/agent_action_executor.dart';
import '../llm/llm_client.dart';
import '../state/app_model.dart';
import '../state/scheduled_agent_task.dart';

void _logSchedule(String message) {
  if (kDebugMode) {
    debugPrint('[ZoroSchedule] $message');
  }
}

String _preview(String s, [int max = 280]) {
  final t = s.replaceAll('\n', ' ').trim();
  if (t.length <= max) return t;
  return '${t.substring(0, max)}…';
}

/// Outcome of a single scheduled / manual run (for UI feedback).
typedef ScheduleRunOutcome = ({
  bool ok,
  String? error,
  bool homeSummaryUpdated,
  bool usedVisibleTextFallback,
});

/// Runs due [ScheduledAgentTask] entries using the same prompt path as Chat.
class ScheduledAgentRunner {
  ScheduledAgentRunner({LlmClient? llm}) : _llm = llm ?? LlmClient();

  final LlmClient _llm;

  static const int _maxHomeFallbackChars = 6000;

  /// Runs all enabled tasks that are due. Updates [task.lastRunAt] / [lastError] on completion.
  Future<int> runDueTasks(AppModel model, List<ScheduledAgentTask> tasks) async {
    var ran = 0;
    for (final t in tasks) {
      if (!scheduledTaskIsDue(t)) continue;
      _logSchedule('runDueTasks: firing taskId=${t.id}');
      final result = await runOneTask(model, t);
      if (result.ok) ran++;
    }
    return ran;
  }

  Future<ScheduleRunOutcome> runOneTask(AppModel model, ScheduledAgentTask task) async {
    _logSchedule('runOneTask start taskId=${task.id} agentId=${task.agentId}');
    AppAgent? agent;
    for (final a in model.agents) {
      if (a.id == task.agentId) {
        agent = a;
        break;
      }
    }
    if (agent == null) {
      task.lastError = 'Agent not found';
      _logSchedule('abort: agent not found');
      return (ok: false, error: task.lastError, homeSummaryUpdated: false, usedVisibleTextFallback: false);
    }

    final provider = llmProviderForUserAgent(agent, model);
    final key = model.apiKeyFor(provider);
    if (key == null) {
      task.lastError = 'Missing API key for ${provider.name}';
      _logSchedule('abort: no API key for $provider');
      return (ok: false, error: task.lastError, homeSummaryUpdated: false, usedVisibleTextFallback: false);
    }

    _logSchedule(
      'agent=${agent.name} kind=${agent.kind.name} toolHomeSummary=${agent.toolHomeSummary} '
      'provider=$provider model=${model.modelFor(provider)}',
    );

    final contextBundle = buildPortfolioContextBundle(model);
    final system = buildAgentChatSystem(agent: agent, contextBundle: contextBundle);
    var user = task.runUserMessage.trim().isEmpty
        ? 'Run your scheduled update now using attached context and allowed tools.'
        : task.runUserMessage.trim();

    if (agent.toolHomeSummary) {
      user = '$user\n\n'
          'You must update the Home summary card. End your reply with a markdown code fence exactly like:\n'
          '```zoro_actions\n'
          '{"actions":[{"op":"set_home_summary","text":"Put the full Home card briefing here as plain text."}]}\n'
          '```';
    }

    _logSchedule(
      'prompt sizes: systemLen=${system.length} userLen=${user.length} contextBundleLen=${contextBundle.length}',
    );

    try {
      final reply = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: model.modelFor(provider),
        system: system,
        user: user,
        maxOutputTokens: 2048,
        preferJsonObjectOutput: false,
      );
      if (reply.trim().isEmpty) {
        task.lastError = 'Model returned an empty reply';
        _logSchedule('abort: empty LLM reply');
        return (ok: false, error: task.lastError, homeSummaryUpdated: false, usedVisibleTextFallback: false);
      }

      _logSchedule('LLM reply len=${reply.length} preview="${_preview(reply)}"');

      final processed = processAgentActions(rawReply: reply, agent: agent, model: model);
      var homeUpdated = processed.homeSummaryApplied;
      var usedFallback = false;

      _logSchedule(
        'processAgentActions: homeSummaryApplied=${processed.homeSummaryApplied} '
        'visibleLen=${processed.visibleText.length} applySummary=${processed.applySummary ?? "null"}',
      );

      if (agent.toolHomeSummary && !homeUpdated) {
        final v = processed.visibleText.trim();
        if (v.isNotEmpty) {
          final clipped =
              v.length > _maxHomeFallbackChars ? '${v.substring(0, _maxHomeFallbackChars)}\n…' : v;
          _logSchedule(
            'fallback: writing visible text to Home (len=${clipped.length}) preview="${_preview(clipped)}"',
          );
          model.setHomeSummaryText(clipped);
          homeUpdated = true;
          usedFallback = true;
        } else {
          _logSchedule('fallback skipped: visible text empty after trim');
        }
      } else if (!homeUpdated) {
        _logSchedule('no Home update: toolHomeSummary=${agent.toolHomeSummary} homeSummaryApplied=$homeUpdated');
      }

      task.lastRunAt = DateTime.now().toUtc();
      task.lastError = null;
      _logSchedule(
        'success homeSummaryUpdated=$homeUpdated usedVisibleTextFallback=$usedFallback',
      );
      return (
        ok: true,
        error: null,
        homeSummaryUpdated: homeUpdated,
        usedVisibleTextFallback: usedFallback,
      );
    } catch (e, st) {
      task.lastError = e.toString();
      _logSchedule('exception: $e');
      _logSchedule('stack: $st');
      return (ok: false, error: task.lastError, homeSummaryUpdated: false, usedVisibleTextFallback: false);
    }
  }
}
