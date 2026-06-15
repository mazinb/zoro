import 'dart:async';
import 'dart:convert';

import '../../core/finance/currency.dart';
import '../../core/home/home_summary_focus_domain.dart';
import '../../core/llm/llm_client.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';

/// Runs once per calendar day when the app opens; rotates through ledger/context/goals focus areas.
class HomeSummaryHelperService {
  HomeSummaryHelperService({LlmClient? llm}) : _llm = llm ?? LlmClient();

  final LlmClient _llm;

  static Future<bool>? _inFlight;

  static const int _maxOutputTokens = 220;

  static const _jsonContract = '''
Reply with plain text only: 2–3 short sentences, under 280 characters total.
No markdown, bullets, JSON, or headings. Calm and specific.
Do not invent numbers that are not in the user JSON.
For liabilities, use totalDisplay (already in displayCurrency) — not ledgerTotal in accountCurrency.
If privacyHideAmounts is true, avoid dollar amounts and speak in general terms.
''';

  /// Returns true when a run completed and Home summary was updated.
  Future<bool> maybeRunOnAppOpen(AppModel model, {DateTime? now}) async {
    if (!model.onboardingComplete) return false;
    if (model.homeSummaryHelperRunning) return false;

    final n = now ?? DateTime.now();
    if (!model.shouldRunHomeSummaryHelperNow(n)) return false;

    final dayKey = homeSummaryCalendarDayKey(n);

    final enabled = model.homeSummaryHelperIncludedDomains;
    if (enabled.isEmpty) return false;

    final provider = _providerForRun(model);
    if (provider == null) return false;

    if (_inFlight != null) {
      try {
        return await _inFlight!;
      } catch (_) {
        return false;
      }
    }

    final focus = homeSummaryDomainAtRotationIndex(enabled, model.homeSummaryHelperRotationIndex);
    final run = _runOnce(model, provider: provider, focus: focus, dayKey: dayKey, now: n);
    _inFlight = run;
    try {
      return await run;
    } finally {
      if (identical(_inFlight, run)) _inFlight = null;
    }
  }

  Future<bool> _runOnce(
    AppModel model, {
    required LlmProvider provider,
    required HomeSummaryFocusDomain focus,
    required String dayKey,
    required DateTime now,
  }) async {
    model.setHomeSummaryHelperRunning(true);
    try {
      if (provider == LlmProvider.appleFoundation) {
        await model.refreshAppleFoundationCapabilities();
        if (!model.appleFoundationRuntimeAvailable) return false;
      }

      final system = _systemPrompt(model);
      // Keep a single on-device call with a pre-trimmed payload (no countTokens pass).
      final user = jsonEncode(_shrinkPayload(_payload(model, focus, now: now)));

      final apiKey = model.apiKeyFor(provider)!;
      final modelName = model.modelFor(provider);
      final result = await _llm.complete(
        provider: provider,
        apiKey: apiKey,
        model: modelName,
        system: system,
        user: user,
        maxOutputTokens: _maxOutputTokens,
        zoroApi: provider == LlmProvider.zoroCloud ? model.api : null,
        zoroDeviceId: provider == LlmProvider.zoroCloud ? model.deviceId : null,
      );
      model.recordLlmRequest(provider: provider, model: modelName);
      model.setPendingLlmCompletionMetadata(
        model: '${provider.name}:$modelName',
        tokensUsed: result.tokensUsed,
      );

      final text = _extractPlainSummary(result.text);
      if (text.isEmpty) return false;

      model.setHomeSummaryText(text);
      model.markHomeSummaryHelperRan(dayKey);
      model.recordInternalAgentRun(InternalAppAgentIds.homeSummaryHelper, {
        'focus': focus.id,
        'dayKey': dayKey,
        'text': text,
      });
      if (model.notificationsEnabled &&
          model.shouldNotifyHomeMessageNow(now)) {
        model.markHomeMessageNotified(now);
        unawaited(
          NotificationService.instance.showHomeMessageReady(
            taskId: InternalAppAgentIds.homeSummaryHelper,
          ),
        );
      }
      return true;
    } catch (_) {
      return false;
    } finally {
      model.setHomeSummaryHelperRunning(false);
    }
  }

  LlmProvider? _providerForRun(AppModel model) {
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

  String _systemPrompt(AppModel model) {
    final user = model.internalAgentSystemPrompt(InternalAppAgentIds.homeSummaryHelper).trim();
    final hints = internalAppAgentDefinitionById(InternalAppAgentIds.homeSummaryHelper)
            ?.modelDomainHints
            .trim() ??
        '';
    return [
      'You write the daily Home screen note for a personal finance app.',
      'The user JSON names exactly one "focus" domain — comment only on that domain.',
      _jsonContract,
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  Map<String, Object?> _payload(AppModel model, HomeSummaryFocusDomain focus, {required DateTime now}) {
    final base = <String, Object?>{
      'focus': focus.id,
      'focusLabel': focus.label,
      'privacyHideAmounts': model.privacyHideAmounts,
      'displayCurrency': model.displayCurrency.code,
    };
    switch (focus) {
      case HomeSummaryFocusDomain.assets:
        return {
          ...base,
          'totalAssetsDisplay': model.totalAssetsDisplay,
          'assetsLastReviewed': model.assetsLastReviewed?.toIso8601String(),
          'reviewOverdue': model.assetsReviewOverdueAt(now),
          'rows': [
            for (final a in model.assets.take(6))
              {
                'name': a.name,
                'type': a.type.apiValue,
                'totalDisplay': model.assetDisplayValue(a),
                'hasContext': (a.contextMarkdown ?? '').trim().isNotEmpty,
              },
          ],
          'assetCount': model.assets.length,
        };
      case HomeSummaryFocusDomain.liabilities:
        return {
          ...base,
          'totalLiabilitiesDisplay': model.totalLiabilitiesDisplay,
          'liabilitiesLastReviewed': model.liabilitiesLastReviewed?.toIso8601String(),
          'reviewOverdue': model.liabilitiesReviewOverdueAt(now),
          'rows': [
            for (final l in model.liabilities.take(6))
              _liabilityRowPayload(model, l),
          ],
          'liabilityCount': model.liabilities.length,
        };
      case HomeSummaryFocusDomain.cashflow:
        final months = AppModel.recentMonthKeys(count: 4);
        return {
          ...base,
          'cashflowLastPhrase': model.cashflowLastUpdatedPhraseAt(now),
          'reviewOverdue': model.cashflowReviewOverdueAt(now),
          'recurringExpensesMonthly': model.recurringExpensesMonthly,
          'recentMonths': [
            for (final mk in months)
              {
                'monthKey': mk,
                'spending': model.monthlyEntryFor(mk)?.monthlySpending,
                'earned': model.monthlyEntryFor(mk)?.monthlyEarned,
              },
          ],
        };
      case HomeSummaryFocusDomain.context:
        final missingAssets = <String>[];
        final missingLiabilities = <String>[];
        for (final a in model.assets) {
          if ((a.contextMarkdown ?? '').trim().isEmpty) missingAssets.add(a.name);
        }
        for (final l in model.liabilities) {
          if ((l.contextMarkdown ?? '').trim().isEmpty) missingLiabilities.add(l.name);
        }
        return {
          ...base,
          'missingAssetContext': missingAssets.take(8).toList(),
          'missingLiabilityContext': missingLiabilities.take(8).toList(),
          'missingAssetCount': missingAssets.length,
          'missingLiabilityCount': missingLiabilities.length,
        };
      case HomeSummaryFocusDomain.goals:
        final r = model.retirementGoal;
        final targets = model.financialGoals.where((g) => !g.isRetirement).take(6).toList();
        return {
          ...base,
          'retirement': r == null
              ? null
              : {
                  'name': r.name,
                  'targetDate': r.targetDate?.toIso8601String(),
                  'corpusDisplay': model.computedRetirementCorpus(r),
                  'safeWithdrawalRatePct': r.safeWithdrawalRatePct,
                  'corpusAutoFromExpenses': r.corpusAutoFromExpenses,
                  'investMonthly': model.allocInvestmentsMonthly,
                  'savingsMonthly': model.allocSavingsMonthly,
                  'planLastUpdated': model.retirementPlanLastUpdatedAt()?.toIso8601String(),
                },
          'targetGoals': [
            for (final g in targets)
              {
                'name': g.name,
                'targetAmount': g.targetAmount,
                'targetDate': g.targetDate?.toIso8601String(),
              },
          ],
          'goalsReviewOverdue': model.goalsReviewOverdueAt(now),
        };
    }
  }

  Map<String, Object?> _liabilityRowPayload(AppModel model, LedgerLiabilityRow row) {
    final accountCurrency = currencyCodeForPresetCountry(row.currencyCountry);
    final totalDisplay = model.moneyInDisplayCurrency(row.total, accountCurrency);
    return {
      'name': row.name,
      'type': row.type.apiValue,
      'accountCurrency': accountCurrency.code,
      'ledgerTotal': row.total,
      'totalDisplay': totalDisplay,
      if (!model.privacyHideAmounts) ...{
        'ledgerTotalFormatted': formatCurrencyDisplay(row.total, currency: accountCurrency),
        'totalDisplayFormatted': formatCurrencyDisplay(totalDisplay, currency: model.displayCurrency),
      },
      'hasContext': (row.contextMarkdown ?? '').trim().isNotEmpty,
    };
  }

  Map<String, Object?> _shrinkPayload(Map<String, Object?> payload) {
    final copy = Map<String, Object?>.from(payload);
    for (final key in ['rows', 'recentMonths', 'missingAssetContext', 'missingLiabilityContext', 'targetGoals']) {
      final v = copy[key];
      if (v is List && v.length > 4) {
        copy[key] = v.take(4).toList();
      }
    }
    return copy;
  }

  String _extractPlainSummary(String raw) {
    var t = raw.trim();
    if (t.startsWith('```')) {
      final end = t.indexOf('```', 3);
      if (end > 0) {
        t = t.substring(t.indexOf('\n') + 1, end).trim();
      }
    }
    if (t.length > 400) t = '${t.substring(0, 397)}…';
    return t;
  }
}
