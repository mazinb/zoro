import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/guided_mcq/structured_guide_page.dart';

/// Runs the configured helper prompt when the user added optional text.
Future<Map<String, Object?>?> synthesizeGoalsSectionWithLlm({
  required BuildContext context,
  required AppModel model,
  required String agentId,
  required Map<String, Object?> payload,
  required String optionalNote,
  required List<StructuredGuideAnswer> answers,
}) async {
  final ready = await model.prepareLlmForAssistant(
    requestConsent: LlmConsentGate.requester(context, model),
  );
  if (!ready) return null;

  final def = internalAppAgentDefinitionById(agentId);
  final system = model.internalAgentSystemPrompt(agentId);
  final qa = [
    for (final a in answers)
      {
        'questionId': a.questionId,
        'selected': a.selectedIds.toList(),
      },
  ];
  final user = jsonEncode({
    'optionalNote': optionalNote,
    'answers': qa,
    'payload': payload,
    if (def != null) 'agentTitle': def.title,
  });

  final raw = await completeForActiveProvider(
    model,
    system: system,
    user: user,
    maxOutputTokens: 4096,
    preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
  );

  final obj = await decodeActiveProviderJsonWithRepair(model, raw);
  return Map<String, Object?>.from(obj.map((k, v) => MapEntry(k.toString(), v)));
}
