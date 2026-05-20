import 'dart:convert';

import '../../core/finance/currency.dart';
import '../../core/finance/row_review_result.dart';
import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/prompt_context_budget.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';

/// Parallel ledger review for assets or liabilities (one LLM call per row).
class LedgerRowReviewService {
  LedgerRowReviewService({PromptContextBudgetService? budget})
      : _budget = budget ?? PromptContextBudgetService();

  final PromptContextBudgetService _budget;

  static const _jsonContract = '''
Return ONE JSON object only (no markdown fences):
{
  "level": "ok" | "caution" | "broken",
  "title": "short label for status icon",
  "detail": "1-2 sentences for bottom sheet",
  "bannerNote": "optional one-line note under the card title",
  "suggestedComment": "optional short ledger comment only when it helps"
}
''';

  static String _ledgerAssetSystem(AppModel model) {
    final user = model.internalAgentSystemPrompt(InternalAppAgentIds.ledgerReviewAsset).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.ledgerReviewAsset)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You review ONE asset row. Ledger balance is correct.',
      _jsonContract,
      'Rules:',
      '- Only compare **dollar amounts** in contextMarkdown to the ledger total.',
      '- ok = context explains what is in the account and described amounts match the total (within ~15%).',
      '- caution = missing breakdown, amounts in context do not match total, or context is empty of useful detail.',
      '- broken = only if context amounts are nonsense relative to the total (not for naming/wording differences).',
      '- Do NOT consider cashflow, imports, or balance changes — those are handled elsewhere.',
      '- suggestedComment: short card note only; do not write full context here.',
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  static String _ledgerLiabilitySystem(AppModel model) {
    final user =
        model.internalAgentSystemPrompt(InternalAppAgentIds.ledgerReviewLiability).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.ledgerReviewLiability)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You review ONE liability row. Ledger balance is correct.',
      _jsonContract,
      'Rules:',
      '- Only check whether contextMarkdown explains the debt and whether **amounts** there match the ledger balance.',
      '- Do NOT flag broken or caution because the account title and context wording differ (e.g. "Condo" vs "mortgage on apartment").',
      '- Do NOT require interest rate here — rate is on the ledger card separately.',
      '- Do NOT consider cashflow paydowns.',
      '- ok = context describes the loan and amounts are consistent with the balance.',
      '- caution = thin context or amount mismatch in the note.',
      '- broken = only if context dollar amounts are impossible vs the balance.',
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  Future<({bool trimmed, String? budgetLine})> reviewAllAssets(AppModel model) async {
    model.clearLedgerAssetReviews();
    var trimmed = false;
    String? budgetLine;
    final system = _ledgerAssetSystem(model);
    if (model.activeLlmProvider == LlmProvider.appleFoundation) {
      final b = await _budget.measure(system: system, user: '{}');
      if (b.contextSize > 0) {
        budgetLine =
            'On-device context: ~${b.tokenCount} / ${b.usableInput} tokens (${(b.usageFraction * 100).round()}%)';
      }
    }
    await Future.wait([
      for (final a in model.assets) _reviewOneAsset(model, a, system, onTrim: () => trimmed = true),
    ]);
    model.recordInternalAgentRun(InternalAppAgentIds.ledgerReviewAsset, {
      'reviewed': model.assets.length,
    });
    return (trimmed: trimmed, budgetLine: budgetLine);
  }

  Future<({bool trimmed, String? budgetLine})> reviewAllLiabilities(AppModel model) async {
    model.clearLedgerLiabilityReviews();
    var trimmed = false;
    String? budgetLine;
    final system = _ledgerLiabilitySystem(model);
    if (model.activeLlmProvider == LlmProvider.appleFoundation) {
      final b = await _budget.measure(system: system, user: '{}');
      if (b.contextSize > 0) {
        budgetLine =
            'On-device context: ~${b.tokenCount} / ${b.usableInput} tokens (${(b.usageFraction * 100).round()}%)';
      }
    }
    await Future.wait([
      for (final l in model.liabilities)
        _reviewOneLiability(model, l, system, onTrim: () => trimmed = true),
    ]);
    model.recordInternalAgentRun(InternalAppAgentIds.ledgerReviewLiability, {
      'reviewed': model.liabilities.length,
    });
    return (trimmed: trimmed, budgetLine: budgetLine);
  }

  Future<void> _reviewOneAsset(
    AppModel model,
    LedgerAssetRow row,
    String system, {
    required void Function() onTrim,
  }) async {
    model.setLedgerAssetReview(row.id, reviewing: true);
    try {
      if (model.primaryCashBalanceIsMirrored(row)) {
        model.setLedgerAssetReview(
          row.id,
          reviewing: false,
          result: const RowReviewResult(
            level: RowReviewLevel.ok,
            title: 'Linked to Cash',
            detail: 'Balance follows your latest month closing on the Cash tab.',
          ),
        );
        return;
      }

      final ctx = (row.contextMarkdown ?? '').trim();
      if (ctx.isEmpty) {
        model.setLedgerAssetReview(
          row.id,
          reviewing: false,
          result: const RowReviewResult(
            level: RowReviewLevel.caution,
            title: 'No context note',
            detail: 'Add a breakdown of what is in this account under Context.',
            bannerNote: 'No context note yet',
          ),
        );
        return;
      }

      final displayVal = model.assetDisplayValue(row);
      final payload = {
        'privacyHideAmounts': model.privacyHideAmounts,
        'asset': {
          'id': row.id,
          'type': row.type.apiValue,
          'name': row.name,
          'comment': row.comment,
          'total': displayVal,
          'valueFormatted': formatCurrencyDisplay(displayVal, currency: model.displayCurrency),
        },
        'contextMarkdown': ctx,
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
        maxOutputTokens: 900,
        preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(model, raw);
      var result = RowReviewResult.fromJson(obj);
      if (result.suggestedComment.trim().isNotEmpty && result.bannerNote.isEmpty) {
        result = RowReviewResult(
          level: result.level,
          title: result.title,
          detail: result.detail,
          bannerNote: result.suggestedComment,
          suggestedComment: result.suggestedComment,
        );
      }
      model.setLedgerAssetReview(row.id, reviewing: false, result: result);
    } catch (e) {
      model.setLedgerAssetReview(
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

  Future<void> _reviewOneLiability(
    AppModel model,
    LedgerLiabilityRow row,
    String system, {
    required void Function() onTrim,
  }) async {
    model.setLedgerLiabilityReview(row.id, reviewing: true);
    try {
      final ctx = (row.contextMarkdown ?? '').trim();
      if (ctx.isEmpty) {
        model.setLedgerLiabilityReview(
          row.id,
          reviewing: false,
          result: const RowReviewResult(
            level: RowReviewLevel.caution,
            title: 'No context note',
            detail: 'Add loan terms and payment details under Context.',
            bannerNote: 'No context note yet',
          ),
        );
        return;
      }

      final payload = {
        'privacyHideAmounts': model.privacyHideAmounts,
        'liability': {
          'id': row.id,
          'type': row.type.apiValue,
          'name': row.name,
          'comment': row.comment,
          'total': row.total,
          'interestRatePct': row.interestRatePct,
        },
        'contextMarkdown': ctx,
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
        maxOutputTokens: 900,
        preferJsonObjectOutput: model.activeLlmProvider == LlmProvider.openai,
      );
      final obj = await decodeActiveProviderJsonWithRepair(model, raw);
      final result = RowReviewResult.fromJson(obj);
      model.setLedgerLiabilityReview(row.id, reviewing: false, result: result);
    } catch (e) {
      model.setLedgerLiabilityReview(
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
}
