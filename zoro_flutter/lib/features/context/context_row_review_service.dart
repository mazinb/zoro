import 'dart:convert';

import '../../core/finance/currency.dart';
import '../../core/finance/row_review_result.dart';
import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/prompt_context_budget.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';

/// Parallel context review — ledger row is assumed correct; suggest context additions.
class ContextRowReviewService {
  ContextRowReviewService({PromptContextBudgetService? budget})
      : _budget = budget ?? PromptContextBudgetService();

  final PromptContextBudgetService _budget;

  static const _jsonContract = '''
Return ONE JSON object only (no markdown fences):
{
  "level": "ok" | "caution" | "broken",
  "title": "short label",
  "detail": "2-4 sentences: what to add or fix in the context note (meaningful, specific)",
  "bannerNote": "optional one-line summary for the card",
  "suggestedContextMarkdown": "full updated context note markdown when you can draft it; else empty"
}
''';

  static String _contextAssetSystem(AppModel model) {
    final user = model.internalAgentSystemPrompt(InternalAppAgentIds.contextReviewAsset).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.contextReviewAsset)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You review context notes for ONE asset. Ledger balance and comment are correct — only improve context.',
      _jsonContract,
      'Rules:',
      '- ok = context explains holdings and any amount breakdown matches ledger total.',
      '- caution = missing breakdown, rate, institution detail, or context total off vs ledger.',
      '- broken = only if context dollar amounts are impossible vs the balance (not wording differences).',
      '- Only mention amount gaps in context (under/over vs ledger), not changing ledger.',
      '- suggestedContextMarkdown should be a complete useful note when caution/broken.',
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  static String _contextLiabilitySystem(AppModel model) {
    final user =
        model.internalAgentSystemPrompt(InternalAppAgentIds.contextReviewLiability).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.contextReviewLiability)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You review context notes for ONE liability. Ledger balance and rate field are correct — only improve context.',
      _jsonContract,
      'Rules:',
      '- Loans need rate, payment rhythm, lender in context when not obvious from ledger.',
      '- caution = missing terms; broken = contradicts ledger.',
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  Future<({bool trimmed, String? budgetLine})> reviewAssetsAndLiabilities(AppModel model) async {
    model.clearContextAssetReviews();
    model.clearContextLiabilityReviews();
    for (final a in model.assets) {
      model.setContextAssetReview(a.id, reviewing: true);
    }
    for (final l in model.liabilities) {
      model.setContextLiabilityReview(l.id, reviewing: true);
    }
    var trimmed = false;
    String? budgetLine;
    final assetSystem = _contextAssetSystem(model);
    if (model.activeLlmProvider == LlmProvider.appleFoundation) {
      final b = await _budget.measure(system: assetSystem, user: '{}');
      if (b.contextSize > 0) {
        budgetLine =
            'On-device context: ~${b.tokenCount} / ${b.usableInput} tokens (${(b.usageFraction * 100).round()}%)';
      }
    }
    await Future.wait([
      for (final a in model.assets)
        _reviewAsset(model, a, assetSystem, onTrim: () => trimmed = true),
      for (final l in model.liabilities)
        _reviewLiability(model, l, _contextLiabilitySystem(model), onTrim: () => trimmed = true),
    ]);
    model.recordInternalAgentRun(InternalAppAgentIds.contextReviewAsset, {
      'assets': model.assets.length,
      'liabilities': model.liabilities.length,
    });
    return (trimmed: trimmed, budgetLine: budgetLine);
  }

  Future<void> _reviewAsset(
    AppModel model,
    LedgerAssetRow row,
    String system, {
    required void Function() onTrim,
  }) async {
    try {
      final displayVal = model.assetDisplayValue(row);
      final payload = {
        'asset': {
          'id': row.id,
          'type': row.type.apiValue,
          'name': row.name,
          'comment': row.comment,
          'total': displayVal,
          'valueFormatted': formatCurrencyDisplay(displayVal, currency: model.displayCurrency),
        },
        'contextMarkdown': (row.contextMarkdown ?? '').trim(),
        'contextLastUpdated':
            model.contextNoteLastUpdatedIso(AppModel.contextKeyAsset(row.id)),
      };
      var user = jsonEncode(payload);
      if (model.activeLlmProvider == LlmProvider.appleFoundation) {
        final prepared = await _budget.prepareUserPayload(system: system, payload: payload);
        if (prepared.trimmed) onTrim();
        user = prepared.userJson;
      }
      final raw = await completeForActiveProvider(
        model,
        system: system,
        user: user,
        maxOutputTokens: 1400,
        preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(model, raw);
      final result = RowReviewResult.fromJson(obj);
      model.setContextAssetReview(row.id, reviewing: false, result: result);
    } catch (e) {
      model.setContextAssetReview(
        row.id,
        reviewing: false,
        result: RowReviewResult(
          level: RowReviewLevel.broken,
          title: 'Review failed',
          detail: e.toString(),
        ),
      );
    }
  }

  Future<void> _reviewLiability(
    AppModel model,
    LedgerLiabilityRow row,
    String system, {
    required void Function() onTrim,
  }) async {
    try {
      final payload = {
        'liability': {
          'id': row.id,
          'type': row.type.apiValue,
          'name': row.name,
          'comment': row.comment,
          'total': row.total,
          'interestRatePct': row.interestRatePct,
        },
        'contextMarkdown': (row.contextMarkdown ?? '').trim(),
        'contextLastUpdated':
            model.contextNoteLastUpdatedIso(AppModel.contextKeyLiability(row.id)),
      };
      var user = jsonEncode(payload);
      if (model.activeLlmProvider == LlmProvider.appleFoundation) {
        final prepared = await _budget.prepareUserPayload(system: system, payload: payload);
        if (prepared.trimmed) onTrim();
        user = prepared.userJson;
      }
      final raw = await completeForActiveProvider(
        model,
        system: system,
        user: user,
        maxOutputTokens: 1400,
        preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(model, raw);
      final result = RowReviewResult.fromJson(obj);
      model.setContextLiabilityReview(row.id, reviewing: false, result: result);
    } catch (e) {
      model.setContextLiabilityReview(
        row.id,
        reviewing: false,
        result: RowReviewResult(
          level: RowReviewLevel.broken,
          title: 'Review failed',
          detail: e.toString(),
        ),
      );
    }
  }

  /// Single-asset context refresh from the editor.
  Future<RowReviewResult?> reviewOneAsset(AppModel model, String assetId) async {
    final row = model.assetById(assetId);
    if (row == null) return null;
    model.setContextAssetReview(assetId, reviewing: true);
    await _reviewAsset(model, row, _contextAssetSystem(model), onTrim: () {});
    return model.contextAssetReviewById[assetId]?.result;
  }

  Future<RowReviewResult?> reviewOneLiability(AppModel model, String liabilityId) async {
    final row = model.liabilityById(liabilityId);
    if (row == null) return null;
    model.setContextLiabilityReview(liabilityId, reviewing: true);
    await _reviewLiability(model, row, _contextLiabilitySystem(model), onTrim: () {});
    return model.contextLiabilityReviewById[liabilityId]?.result;
  }
}
