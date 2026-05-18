import 'dart:convert';

import '../llm/active_llm_completion.dart';
import '../state/app_model.dart';
import '../state/internal_app_agent_definition.dart';

/// Runs the export-sanitizer internal agent: same JSON shape, redacted string fields.
abstract final class ExportSanitizer {
  static const _codeSystemSuffix = '''

You receive one complete export document as JSON text. Return the same JSON object with only string values redacted per the instructions above. Do not add keys, remove keys, or change numbers, booleans, ids, or nesting. Output a single JSON object only — no markdown fences or commentary.
''';

  static Future<Map<String, dynamic>> sanitizeExportMap(
    AppModel model,
    Map<String, dynamic> exportMap,
  ) async {
    final userPrompt = model.internalAgentSystemPrompt(InternalAppAgentIds.exportSanitizer).trim();
    final def = internalAppAgentDefinitionById(InternalAppAgentIds.exportSanitizer);
    final system = [
      if (userPrompt.isNotEmpty) userPrompt else def?.defaultSystemPrompt ?? '',
      if ((def?.modelDomainHints ?? '').trim().isNotEmpty) def!.modelDomainHints,
      _codeSystemSuffix,
    ].join('\n');

    final rawJson = const JsonEncoder.withIndent('  ').convert(exportMap);
    final raw = await completeForActiveProvider(
      model,
      system: system,
      user: rawJson,
      maxOutputTokens: 32768,
      preferJsonObjectOutput: true,
    );
    final parsed = await decodeActiveProviderJsonWithRepair(model, raw);
    return Map<String, dynamic>.from(parsed);
  }
}
