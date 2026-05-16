import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/guided_mcq/guided_mcq_config.dart';
import '../../shared/guided_mcq/guided_mcq_page.dart';
import 'context_planner_config.dart';

class ContextPlannerResult {
  const ContextPlannerResult({required this.contextMarkdown, required this.structured});

  final String contextMarkdown;
  final Map<String, Object?> structured;
}

/// Guided MCQ flow for context notes (assets, liabilities, buckets, months).
class ContextPlannerPage extends StatelessWidget {
  const ContextPlannerPage({super.key, required this.model, required this.config});

  final AppModel model;
  final ContextPlannerConfig config;

  @override
  Widget build(BuildContext context) {
    final mcq = GuidedMcqConfig(
      internalAgentId: config.internalAgentId,
      title: config.title,
      buildPayload: config.buildPayload,
      isTargetMissing: config.isTargetMissing,
      missingTargetMessage: config.missingTargetMessage,
    );

    return GuidedMcqPage(
      model: model,
      config: mcq,
    );
  }
}

/// Pushes [ContextPlannerPage] and returns [ContextPlannerResult] when complete.
Future<ContextPlannerResult?> pushContextPlanner(
  BuildContext context, {
  required AppModel model,
  required ContextPlannerConfig config,
}) async {
  final res = await Navigator.of(context).push<GuidedMcqResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => ContextPlannerPage(model: model, config: config),
    ),
  );
  if (res == null) return null;
  return ContextPlannerResult(contextMarkdown: res.contextMarkdown, structured: res.structured);
}
