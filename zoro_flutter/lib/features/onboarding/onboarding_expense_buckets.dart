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

/// Monthly bucket amounts in [displayCurrency] from MCQ answers and income.
Map<String, double> deterministicOnboardingExpenseBuckets({
  required CurrencyCode displayCurrency,
  required StructuredGuideResult mcq,
  required double netMonthlyIncomeDisplay,
  Map<CurrencyCode, double>? usdPerUnitOverrides,
}) {
  final presetCountry = presetCountryForDisplayCurrency(displayCurrency);
  final preset = presetForCountry(presetCountry);
  final presetCurrency = currencyCodeForPresetCountry(presetCountry);

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

  final incomeScale = (netMonthlyIncomeDisplay / 6000).clamp(0.55, 2.4);

  final out = <String, double>{};
  for (final k in recurringExpenseBucketKeys) {
    final b = preset.buckets[k]!;
    var mul = incomeScale;
    mul *= switch (k) {
      'housing' => housingMul,
      'food' => lifestyleMul * householdMul,
      'transportation' => transportMul,
      'healthcare' => householdMul,
      'entertainment' => lifestyleMul,
      'other' => (housingMul + lifestyleMul + householdMul + transportMul) / 4,
      _ => 1.0,
    };
    final converted = convertCurrency(
      value: b.value * mul,
      from: presetCurrency,
      to: displayCurrency,
      usdPerUnitOverrides: usdPerUnitOverrides,
    );
    out[k] = converted.roundToDouble();
  }
  return out;
}

List<StructuredGuideStep> onboardingExpenseMcqSteps({required double netMonthlyIncomeDisplay}) {
  final incomeHint = netMonthlyIncomeDisplay > 0
      ? 'Based on ~${formatCurrencyDisplay(netMonthlyIncomeDisplay, currency: CurrencyCode.usd)}/mo after tax'
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
Amounts are monthly in display currency. Use payload.mcqAnswers, payload.netMonthlyIncome, and payload.userNote.
Only include keys from payload.bucketKeys. Scale totals sensibly vs income.
''';

/// Uses Apple on-device model when [note] is non-empty; returns null → caller uses deterministic buckets.
Future<Map<String, double>?> appleOnboardingExpenseBuckets({
  required AppModel model,
  required String note,
  required StructuredGuideResult mcq,
  required double netMonthlyIncomeDisplay,
  required Map<String, double> baselineBuckets,
}) async {
  if (!model.appleFoundationRuntimeAvailable) return null;

  final payload = {
    'displayCurrency': CurrencyCode.usd.name,
    'netMonthlyIncome': netMonthlyIncomeDisplay,
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
    final raw = await LlmClient().complete(
      provider: LlmProvider.appleFoundation,
      apiKey: AppModel.appleOnDeviceApiKeySentinel,
      model: 'default',
      system: _onboardingExpenseSynthSystem,
      user: jsonEncode(payload),
      maxOutputTokens: 1200,
    );
    final obj = decodeLlmJsonObject(raw);
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
