import 'dart:convert';

import '../../core/constants/web_expenses_income.dart';
import '../../core/finance/currency.dart';
import '../../core/llm/apple_foundation_channel.dart';
import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_json.dart';
import '../../core/state/app_model.dart';
import '../../shared/guided_mcq/structured_guide_page.dart';

String presetCountryForDisplayCurrency(CurrencyCode c) => switch (c) {
      CurrencyCode.inr => 'India',
      CurrencyCode.thb => 'Thailand',
      CurrencyCode.usd => 'US',
      _ => 'US',
    };

/// Annual expense budget baseline: max(\$30k, 30% of net income), capped at 80% of net income.
double onboardingTargetAnnualExpenseUsd(double netAnnualIncomeUsd) {
  if (netAnnualIncomeUsd <= 0) return 30000;
  final thirtyPct = netAnnualIncomeUsd * 0.30;
  const floorUsd = 30000.0;
  var annual = thirtyPct > floorUsd ? thirtyPct : floorUsd;
  final cap = netAnnualIncomeUsd * 0.80;
  if (annual > cap) annual = cap;
  return annual;
}

double _bucketMultiplierForMcq(String bucketKey, StructuredGuideResult mcq) {
  final housing = mcq.singleFor('housing') ?? 'rent';
  final lifestyle = mcq.singleFor('lifestyle') ?? 'balanced';
  final household = mcq.singleFor('household') ?? 'solo';
  final transport = mcq.singleFor('transport') ?? 'mixed';

  final housingMul = switch (housing) {
    'rent' => 1.0,
    'own' => 1.15,
    'family' => 0.55,
    'nomad' => 0.85,
    _ => 1.0,
  };
  final lifestyleMul = switch (lifestyle) {
    'essential' => 0.82,
    'balanced' => 1.0,
    'comfortable' => 1.18,
    'premium' => 1.38,
    _ => 1.0,
  };
  final householdMul = switch (household) {
    'solo' => 1.0,
    'partner' => 1.12,
    'kids' => 1.28,
    'parents' => 1.15,
    _ => 1.0,
  };
  final transportMul = switch (transport) {
    'transit' => 0.75,
    'one_car' => 1.0,
    'multi_car' => 1.35,
    'walk' => 0.6,
    _ => 1.0,
  };

  return switch (bucketKey) {
    'housing' => housingMul,
    'food' => lifestyleMul * householdMul,
    'transportation' => transportMul,
    'healthcare' => householdMul,
    'entertainment' => lifestyleMul,
    'other' => (housingMul + lifestyleMul + householdMul + transportMul) / 4,
    _ => 1.0,
  };
}

/// Monthly bucket amounts in [displayCurrency] from MCQ answers and net income (USD).
Map<String, double> deterministicOnboardingExpenseBuckets({
  required CurrencyCode displayCurrency,
  required StructuredGuideResult mcq,
  required double netMonthlyIncomeUsd,
  Map<CurrencyCode, double>? usdPerUnitOverrides,
}) {
  final presetCountry = presetCountryForDisplayCurrency(displayCurrency);
  final preset = presetForCountry(presetCountry);

  final netAnnualUsd = netMonthlyIncomeUsd * 12;
  final targetAnnualUsd = onboardingTargetAnnualExpenseUsd(netAnnualUsd);
  final monthlyTargetDisplay = convertCurrency(
    value: targetAnnualUsd / 12,
    from: CurrencyCode.usd,
    to: displayCurrency,
    usdPerUnitOverrides: usdPerUnitOverrides,
  );

  final weights = <String, double>{};
  for (final k in recurringExpenseBucketKeys) {
    final base = preset.buckets[k]!.value;
    weights[k] = base * _bucketMultiplierForMcq(k, mcq);
  }
  final weightSum = weights.values.fold<double>(0, (a, b) => a + b);
  if (weightSum <= 0) {
    return {for (final k in recurringExpenseBucketKeys) k: 0.0};
  }

  final out = <String, double>{};
  var assigned = 0.0;
  final keys = List<String>.from(recurringExpenseBucketKeys);
  for (var i = 0; i < keys.length; i++) {
    final k = keys[i];
    if (i == keys.length - 1) {
      out[k] = (monthlyTargetDisplay - assigned).roundToDouble().clamp(0, double.infinity);
    } else {
      final share = monthlyTargetDisplay * weights[k]! / weightSum;
      final rounded = share.roundToDouble();
      out[k] = rounded;
      assigned += rounded;
    }
  }
  return out;
}

List<StructuredGuideStep> onboardingExpenseMcqSteps({
  required double netMonthlyIncomeUsd,
  CurrencyCode hintCurrency = CurrencyCode.usd,
  Map<CurrencyCode, double>? usdPerUnitOverrides,
}) {
  final monthlyHint = netMonthlyIncomeUsd > 0
      ? convertCurrency(
          value: netMonthlyIncomeUsd,
          from: CurrencyCode.usd,
          to: hintCurrency,
          usdPerUnitOverrides: usdPerUnitOverrides,
        )
      : 0.0;
  final incomeHint = monthlyHint > 0
      ? 'Based on ~${formatCurrencyDisplay(monthlyHint, currency: hintCurrency)}/mo after tax'
      : null;

  return [
    StructuredGuideStep(
      id: 'housing',
      prompt: 'Where do you live?',
      hint: incomeHint,
      choices: const [
        StructuredGuideChoice(id: 'rent', label: 'Renting'),
        StructuredGuideChoice(id: 'own', label: 'Own (mortgage or paid off)'),
        StructuredGuideChoice(id: 'family', label: 'With family / low housing cost'),
        StructuredGuideChoice(id: 'nomad', label: 'Often between places'),
      ],
    ),
    StructuredGuideStep(
      id: 'lifestyle',
      prompt: 'Day-to-day spending style',
      choices: const [
        StructuredGuideChoice(id: 'essential', label: 'Essentials first'),
        StructuredGuideChoice(id: 'balanced', label: 'Balanced'),
        StructuredGuideChoice(id: 'comfortable', label: 'Comfortable'),
        StructuredGuideChoice(id: 'premium', label: 'Premium / high discretionary'),
      ],
    ),
    StructuredGuideStep(
      id: 'household',
      prompt: 'Who your budget supports',
      choices: const [
        StructuredGuideChoice(id: 'solo', label: 'Just me'),
        StructuredGuideChoice(id: 'partner', label: 'Me + partner'),
        StructuredGuideChoice(id: 'kids', label: 'Family with kids'),
        StructuredGuideChoice(id: 'parents', label: 'Supporting parents / relatives'),
      ],
    ),
    StructuredGuideStep(
      id: 'transport',
      prompt: 'Getting around',
      choices: const [
        StructuredGuideChoice(id: 'transit', label: 'Transit / rideshare'),
        StructuredGuideChoice(id: 'one_car', label: 'One car'),
        StructuredGuideChoice(id: 'multi_car', label: 'Two or more cars'),
        StructuredGuideChoice(id: 'walk', label: 'Mostly walk / bike'),
      ],
    ),
  ];
}

const _onboardingExpenseSynthSystem = '''
You tune monthly expense bucket estimates for a new user. Reply with ONE JSON object only:
{
  "expenseBuckets": { "housing": 0, "food": 0, "transportation": 0, "healthcare": 0, "entertainment": 0, "other": 0 },
  "summary": "one short sentence"
}
Amounts are monthly in display currency. Use payload.mcqAnswers, payload.netMonthlyIncomeUsd, payload.baselineAnnualExpenseUsd, and payload.userNote.
Only include keys from payload.bucketKeys. Keep total near baselineAnnualExpenseUsd/12 unless userNote clearly shifts a category; never exceed ~80% of net annual income.
''';

/// Uses Apple on-device model when [note] is non-empty; returns null → caller uses deterministic buckets.
Future<Map<String, double>?> appleOnboardingExpenseBuckets({
  required AppModel model,
  required String note,
  required StructuredGuideResult mcq,
  required double netMonthlyIncomeUsd,
  required CurrencyCode expenseCurrency,
  required Map<String, double> baselineBuckets,
}) async {
  if (!model.appleFoundationRuntimeAvailable) return null;

  final baselineAnnualUsd = onboardingTargetAnnualExpenseUsd(netMonthlyIncomeUsd * 12);
  final payload = {
    'displayCurrency': expenseCurrency.name,
    'netMonthlyIncomeUsd': netMonthlyIncomeUsd,
    'baselineAnnualExpenseUsd': baselineAnnualUsd,
    'bucketKeys': recurringExpenseBucketKeys,
    'baselineBuckets': baselineBuckets,
    'mcqAnswers': [
      for (final a in mcq.answers)
        {
          'questionId': a.questionId,
          'selectedIds': a.selectedIds.toList(),
        },
    ],
    'userNote': note.trim(),
  };

  try {
    const provider = LlmProvider.appleFoundation;
    final modelName = model.modelFor(provider);
    final result = await LlmClient().complete(
      provider: provider,
      apiKey: AppModel.appleOnDeviceApiKeySentinel,
      model: modelName,
      system: _onboardingExpenseSynthSystem,
      user: jsonEncode(payload),
      maxOutputTokens: 1200,
    );
    model.recordLlmRequest(provider: provider, model: modelName);
    final obj = decodeLlmJsonObject(result.text);
    final bucketsRaw = obj['expenseBuckets'];
    if (bucketsRaw is! Map) return null;
    final out = <String, double>{};
    for (final k in recurringExpenseBucketKeys) {
      final v = bucketsRaw[k];
      if (v is num && v >= 0) out[k] = v.toDouble();
    }
    return out.isEmpty ? null : out;
  } on AppleFoundationChannelException {
    return null;
  } catch (_) {
    return null;
  }
}
