import '../../core/state/app_model.dart';

/// Configuration for [GuidedMcqPage] — one MCQ planner + synthesizer run.
class GuidedMcqConfig {
  const GuidedMcqConfig({
    required this.internalAgentId,
    required this.title,
    required this.buildPayload,
    this.isTargetMissing,
    this.missingTargetMessage = 'This item is no longer available.',
  });

  final String internalAgentId;
  final String title;
  final Map<String, Object?> Function(AppModel model, List<Map<String, Object?>> qaHistory) buildPayload;
  final bool Function(AppModel model)? isTargetMissing;
  final String missingTargetMessage;
}

class GuidedMcqResult {
  const GuidedMcqResult({required this.contextMarkdown, required this.structured});

  final String contextMarkdown;
  final Map<String, Object?> structured;
}
