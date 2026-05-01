import '../state/app_model.dart';
import '../state/monthly_cashflow_entry.dart';
import 'agent_action_executor.dart';

/// Provider used for chat / scheduled runs for this agent.
LlmProvider llmProviderForUserAgent(AppAgent agent, AppModel model) {
  switch (agent.kind) {
    case AppAgentKind.researcher:
      return LlmProvider.gemini;
    case AppAgentKind.helper:
    case AppAgentKind.analyst:
      return model.activeLlmProvider;
  }
}

String agentKindSystemAppend(AppAgent agent) {
  return switch (agent.kind) {
    AppAgentKind.helper => '''

### Helper style
You coordinate: prefer clear next steps, name which part of the app (Home, Ledger, Context) the user should open, and avoid changing ledger numbers unless the user explicitly asked for updates.
''',
    AppAgentKind.analyst => '',
    AppAgentKind.researcher => '''

### Research / markets
You use the Gemini model. Summarize public-market themes cautiously: do not invent specific headlines, dates, or quotes. If recent news is uncertain, say so briefly. Stay high-level and educational—not personalized investment advice.
''',
  };
}

/// Same shape as chat context toggles; scheduled runs default to full context.
String buildPortfolioContextBundle(
  AppModel model, {
  bool includeAssets = true,
  bool includeLiabilities = true,
  bool includeExpenseBuckets = true,
  bool includeMonths = true,
}) {
  final buf = StringBuffer();
  buf.writeln('## Context bundle');

  if (includeAssets) {
    final items = model.assets
        .map((a) => a.contextMarkdown ?? '')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    if (items.isNotEmpty) {
      buf.writeln('\n### Assets');
      for (final it in items) {
        buf.writeln('\n$it');
      }
    }
  }

  if (includeLiabilities) {
    final items = model.liabilities
        .map((l) => l.contextMarkdown ?? '')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    if (items.isNotEmpty) {
      buf.writeln('\n### Liabilities');
      for (final it in items) {
        buf.writeln('\n$it');
      }
    }
  }

  if (includeExpenseBuckets) {
    final items = model.expenseBucketContextMarkdown.entries
        .map((e) => e.value.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    if (items.isNotEmpty) {
      buf.writeln('\n### Expense buckets');
      for (final it in items) {
        buf.writeln('\n$it');
      }
    }
  }

  if (includeMonths) {
    final items = AppModel.recentMonthKeys()
        .map(model.monthlyEntryFor)
        .whereType<MonthlyCashflowEntry>()
        .map((e) => (e.contextMarkdown ?? '').trim())
        .where((s) => s.isNotEmpty)
        .toList();
    if (items.isNotEmpty) {
      buf.writeln('\n### Months');
      for (final it in items) {
        buf.writeln('\n$it');
      }
    }
  }

  return buf.toString().trim();
}

String buildAgentChatSystem({
  required AppAgent agent,
  required String contextBundle,
}) {
  final extraWeb = agent.toolWebResearch && agent.kind != AppAgentKind.researcher
      ? '''

### Markets / news (light)
You may mention broad public-market themes only; do not invent headlines or same-day price claims unless the user pasted them.
'''
      : '';
  return [
    agent.systemPrompt.trim(),
    if (agent.contextMarkdown.trim().isNotEmpty) '\n\n### Agent context\n${agent.contextMarkdown.trim()}',
    if (contextBundle.trim().isNotEmpty) '\n\n### Attached context\n$contextBundle',
    agentKindSystemAppend(agent),
    extraWeb,
    agentActionsSystemAppend(agent),
    '\n\nReturn concise, actionable guidance.',
  ].join('\n').trim();
}
