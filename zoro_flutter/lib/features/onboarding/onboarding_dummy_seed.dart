import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/llm/llm_json.dart';
import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';

/// Country preset names aligned with [tryCurrencyCodeForPresetCountry].
String presetCountryForCurrency(CurrencyCode c) => switch (c) {
      CurrencyCode.thb => 'Thailand',
      CurrencyCode.inr => 'India',
      CurrencyCode.usd => 'US',
      CurrencyCode.aed => 'UAE',
      CurrencyCode.sgd => 'Singapore',
      CurrencyCode.aud => 'Australia',
      CurrencyCode.eur => 'Euro',
      CurrencyCode.jpy => 'Japan',
      CurrencyCode.hkd => 'Hong Kong',
    };

/// Template rows used when Apple on-device is unavailable.
class OnboardingDummyTemplates {
  static const allSeedAssetIds = [
    SeedLedgerIds.assetCondo,
    SeedLedgerIds.assetUsBrokerage,
    SeedLedgerIds.assetIndiaIndex,
    SeedLedgerIds.assetThaiCash,
  ];

  static const liabilityIds = ['l-seed-condo', 'l-seed-car'];

  static Set<CurrencyCode> enabledCurrencies({
    required CurrencyCode primaryCurrency,
    CurrencyCode? secondaryCurrency,
    Iterable<CurrencyCode>? extraCurrencies,
  }) {
    final out = <CurrencyCode>{primaryCurrency};
    if (secondaryCurrency != null) out.add(secondaryCurrency);
    if (extraCurrencies != null) out.addAll(extraCurrencies);
    return out;
  }

  static CurrencyCode? secondaryCurrencyIn(
    Set<CurrencyCode> enabled, {
    required CurrencyCode primaryCurrency,
  }) {
    for (final c in enabled) {
      if (c != primaryCurrency) return c;
    }
    return null;
  }

  static List<Map<String, Object?>> assetTemplates({
    required CurrencyCode primaryCurrency,
    CurrencyCode? secondaryCurrency,
    Iterable<CurrencyCode>? enabledCurrencies,
  }) {
    final enabled = enabledCurrencies == null
        ? OnboardingDummyTemplates.enabledCurrencies(
            primaryCurrency: primaryCurrency,
            secondaryCurrency: secondaryCurrency,
          )
        : enabledCurrencies.toSet();
    final primaryCountry = presetCountryForCurrency(primaryCurrency);
    final secondary = secondaryCurrency ??
        secondaryCurrencyIn(enabled, primaryCurrency: primaryCurrency);

    final assets = <Map<String, Object?>>[
      {
        'id': SeedLedgerIds.assetCondo,
        'type': LedgerAssetType.property.apiValue,
        'currencyCountry': primaryCountry,
        'name': _propertyName(primaryCountry),
        'total': _propertyTotal(primaryCountry),
        'contextMarkdown': _condoContext(primaryCountry),
      },
      {
        'id': SeedLedgerIds.assetUsBrokerage,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': 'US',
        'name': 'US Brokerage',
        'total': 350000,
        'contextMarkdown': _usBrokerageContext(),
      },
    ];

    final regional = _regionalAssetTemplate(enabled, secondary);
    if (regional != null) assets.add(regional);

    assets.add(_cashAssetTemplate(primaryCountry, enabled));
    return assets;
  }

  static List<Map<String, Object?>> liabilityTemplates(CurrencyCode primary) {
    final country = presetCountryForCurrency(primary);
    final thb = country == 'Thailand';
    return [
      {
        'id': 'l-seed-condo',
        'type': LedgerLiabilityType.mortgage.apiValue,
        'name': thb ? 'Condo mortgage' : 'Home mortgage',
        'currencyCountry': country,
        'total': _mortgageTotal(country),
        'interestRatePct': 6.25,
        'contextMarkdown': _mortgageContext(country),
      },
      {
        'id': 'l-seed-car',
        'type': LedgerLiabilityType.carLoan.apiValue,
        'name': 'Car loan',
        'currencyCountry': country,
        'total': _carLoanTotal(country),
        'interestRatePct': 3.1,
        'contextMarkdown': _carLoanContext(country),
      },
    ];
  }

  static Map<String, Object?>? _regionalAssetTemplate(
    Set<CurrencyCode> enabled,
    CurrencyCode? secondary,
  ) {
    if (enabled.contains(CurrencyCode.inr)) {
      return {
        'id': SeedLedgerIds.assetIndiaIndex,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': 'India',
        'name': 'India Index Fund',
        'total': 2000000,
        'contextMarkdown': _indiaFundContext(),
      };
    }
    if (secondary != null) {
      final country = presetCountryForCurrency(secondary);
      if (country == 'Thailand' && !enabled.contains(CurrencyCode.thb)) {
        return null;
      }
      return {
        'id': SeedLedgerIds.assetIndiaIndex,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': country,
        'name': _regionalInvestmentName(country),
        'total': _regionalInvestmentTotal(country),
        'contextMarkdown': _regionalInvestmentContext(country, secondary),
      };
    }
    if (enabled.contains(CurrencyCode.thb)) {
      return {
        'id': SeedLedgerIds.assetIndiaIndex,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': 'Thailand',
        'name': 'Thailand equity fund',
        'total': 1200000,
        'contextMarkdown': _regionalInvestmentContext('Thailand', CurrencyCode.thb),
      };
    }
    return null;
  }

  static Map<String, Object?> _cashAssetTemplate(
    String primaryCountry,
    Set<CurrencyCode> enabled,
  ) {
    if (enabled.contains(CurrencyCode.thb)) {
      final thaiPrimary = primaryCountry == 'Thailand';
      return {
        'id': SeedLedgerIds.assetThaiCash,
        'type': LedgerAssetType.savings.apiValue,
        'currencyCountry': 'Thailand',
        'name': thaiPrimary ? 'Thai Cash' : 'Thailand cash reserve',
        'total': thaiPrimary ? 1500000.0 : 800000.0,
        'contextMarkdown': _thaiCashContext(),
      };
    }
    return {
      'id': SeedLedgerIds.assetThaiCash,
      'type': LedgerAssetType.savings.apiValue,
      'currencyCountry': primaryCountry,
      'name': 'Cash reserve',
      'total': _cashTotal(primaryCountry),
      'contextMarkdown': _thaiCashContext(),
    };
  }

  static String _propertyName(String country) => switch (country) {
        'Thailand' => 'Bangkok Condo',
        'UAE' => 'Dubai apartment',
        _ => 'Primary residence',
      };

  static double _propertyTotal(String country) => switch (country) {
        'US' => 650000.0,
        'Thailand' => 9500000.0,
        'India' => 4200000.0,
        'UAE' => 2800000.0,
        'Singapore' => 1200000.0,
        'Hong Kong' => 8500000.0,
        _ => 420000.0,
      };

  static String _regionalInvestmentName(String country) => switch (country) {
        'UAE' => 'UAE savings',
        'Singapore' => 'Singapore brokerage',
        'Thailand' => 'Thailand equity fund',
        'Euro' => 'Eurozone index fund',
        'Japan' => 'Japan index fund',
        'Australia' => 'Australia index fund',
        'Hong Kong' => 'Hong Kong equities',
        _ => 'Regional investments',
      };

  static double _regionalInvestmentTotal(String country) => switch (country) {
        'UAE' => 180000.0,
        'Thailand' => 1200000.0,
        'Singapore' => 95000.0,
        'India' => 2000000.0,
        _ => 120000.0,
      };

  static double _cashTotal(String country) => switch (country) {
        'US' => 25000.0,
        'UAE' => 45000.0,
        'India' => 150000.0,
        'Singapore' => 30000.0,
        _ => 25000.0,
      };

  static double _mortgageTotal(String country) => switch (country) {
        'Thailand' => 4200000.0,
        'India' => 2800000.0,
        'UAE' => 1900000.0,
        _ => 320000.0,
      };

  static double _carLoanTotal(String country) => switch (country) {
        'Thailand' => 750000.0,
        'India' => 450000.0,
        'UAE' => 95000.0,
        _ => 28000.0,
      };

  static String _condoContext(String country) => '''## Primary residence

### Details
- Country: $country
- Ownership: 100%
- Valuation: conservative estimate (not an appraisal)

### Notes
- Update cadence: quarterly
''';

  static String _usBrokerageContext() => '''## US Brokerage

### Platform
- Account currency: USD
- Broad index + bond mix (mock)

### Notes
- Update cadence: monthly
''';

  static String _indiaFundContext() => '''## India Index Fund

### Platform
- Platform: (mock) local broker
- Account currency: INR

### Notes
- Long-term accumulation; rebalance yearly
''';

  static String _regionalInvestmentContext(String country, CurrencyCode ccy) =>
      '''## ${_regionalInvestmentName(country)}

### Platform
- Country: $country
- Account currency: ${ccy.name.toUpperCase()}

### Notes
- Long-term holdings; rebalance yearly
''';

  static String _thaiCashContext() => '''## Cash reserve

### Purpose
- Emergency fund and near-term expenses

### Notes
- Target ~6 months runway
''';

  static String _mortgageContext(String country) => '''## Home mortgage

### Terms (mock)
- Variable rate
- Monthly payment sized to local norms

### Notes
- Review annually
''';

  static String _carLoanContext(String country) => '''## Car loan

### Terms (mock)
- Fixed rate
- Remaining term: ~3 years

### Notes
- Keep on schedule unless cash cushion is strong
''';
}

const _dummyLedgerAppleSystem = '''
You customize demo ledger rows for a new user. Reply with ONE JSON object only:
{
  "assets": [
    {"id":"a-seed-condo","type":"property","currencyCountry":"US","name":"...","total":0,"contextMarkdown":"..."}
  ],
  "liabilities": [
    {"id":"l-seed-condo","type":"mortgage","name":"...","currencyCountry":"US","total":0,"interestRatePct":6.25,"contextMarkdown":"..."}
  ]
}

Rules:
- Keep the same ids as payload.templateAssets and payload.templateLiabilities only.
- payload.enabledCurrencyCountries lists every currency country the user chose; never use a country outside that list except "US" for id a-seed-us-brokerage (US Brokerage is always US / USD).
- Never use India or INR unless "India" is in enabledCurrencyCountries.
- Never use Thailand or THB unless "Thailand" is in enabledCurrencyCountries.
- Anchor property and cash rows to payload.primaryCurrencyCountry; use payload.secondaryCurrencyCountry for the regional row when present in templates.
- Each row's currencyCountry must match that row's currency (e.g. UAE for AED, US for USD).
- Scale totals to realistic local amounts (property, investments, cash, loans).
- contextMarkdown: short structured notes in English.
- Do not invent cash-flow months or expense data.
''';

List<LedgerAssetRow> _assetsFromMaps(
  List<Map<String, dynamic>> maps, {
  required List<Map<String, Object?>> templates,
}) {
  final templateById = {for (final t in templates) t['id']!: t};
  final out = <LedgerAssetRow>[];
  for (final m in maps) {
    final id = m['id']?.toString();
    if (id == null || !templateById.containsKey(id)) continue;
    final template = templateById[id]!;
    final type = LedgerAssetTypeUi.fromApi(m['type']?.toString() ?? template['type']?.toString());
    var country = m['currencyCountry']?.toString() ?? template['currencyCountry']?.toString() ?? 'US';
    if (id == SeedLedgerIds.assetUsBrokerage) country = 'US';
    final totalRaw = m['total'];
    final total = totalRaw is num
        ? totalRaw.toDouble()
        : double.tryParse(totalRaw?.toString() ?? '') ??
            (template['total'] as num?)?.toDouble() ??
            0;
    out.add(
      LedgerAssetRow(
        id: id,
        type: type,
        currencyCountry: country,
        name: m['name']?.toString() ?? template['name']?.toString() ?? '',
        total: total,
        label: '',
        comment: '',
        contextMarkdown: m['contextMarkdown']?.toString() ?? template['contextMarkdown']?.toString(),
      ),
    );
  }
  for (final t in templates) {
    final id = t['id'] as String;
    if (out.any((a) => a.id == id)) continue;
    out.add(
      LedgerAssetRow(
        id: id,
        type: LedgerAssetTypeUi.fromApi(t['type']?.toString()),
        currencyCountry: t['currencyCountry']?.toString() ?? 'US',
        name: t['name']?.toString() ?? '',
        total: (t['total'] as num?)?.toDouble() ?? 0,
        label: '',
        comment: '',
        contextMarkdown: t['contextMarkdown']?.toString(),
      ),
    );
  }
  return out;
}

List<LedgerLiabilityRow> _liabilitiesFromMaps(List<Map<String, dynamic>> maps) {
  final out = <LedgerLiabilityRow>[];
  for (final m in maps) {
    final id = m['id']?.toString();
    if (id == null) continue;
    final country = m['currencyCountry']?.toString() ?? 'US';
    final totalRaw = m['total'];
    final total = totalRaw is num
        ? totalRaw.toDouble()
        : double.tryParse(totalRaw?.toString() ?? '') ?? 0;
    final ir = m['interestRatePct'];
    final interest = ir is num ? ir.toDouble() : double.tryParse(ir?.toString() ?? '') ?? 0;
    out.add(
      LedgerLiabilityRow(
        id: id,
        type: LedgerLiabilityTypeUi.fromApi(m['type']?.toString()),
        name: m['name']?.toString() ?? '',
        currencyCountry: country,
        total: total,
        interestRatePct: interest,
        comment: '',
        contextMarkdown: m['contextMarkdown']?.toString(),
      ),
    );
  }
  return out;
}

Future<bool> synthesizeDummyLedgerWithApple(
  AppModel model, {
  required BuildContext context,
  required CurrencyCode primaryCurrency,
  CurrencyCode? secondaryCurrency,
  Iterable<CurrencyCode>? enabledCurrencies,
}) async {
  if (!model.appleFoundationRuntimeAvailable) return false;
  if (!await LlmConsentGate.ensure(context, model, LlmProvider.appleFoundation)) {
    return false;
  }
  final enabled = OnboardingDummyTemplates.enabledCurrencies(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    extraCurrencies: enabledCurrencies,
  );
  final templates = OnboardingDummyTemplates.assetTemplates(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    enabledCurrencies: enabled,
  );
  final payload = {
    'primaryCurrencyCountry': presetCountryForCurrency(primaryCurrency),
    'secondaryCurrencyCountry': secondaryCurrency == null
        ? null
        : presetCountryForCurrency(secondaryCurrency),
    'enabledCurrencyCountries': [for (final c in enabled) presetCountryForCurrency(c)],
    'templateAssets': templates,
    'templateLiabilities': OnboardingDummyTemplates.liabilityTemplates(primaryCurrency),
  };
  try {
    const provider = LlmProvider.appleFoundation;
    final modelName = model.modelFor(provider);
    final result = await LlmClient().complete(
      provider: provider,
      apiKey: AppModel.appleOnDeviceApiKeySentinel,
      model: modelName,
      system: _dummyLedgerAppleSystem,
      user: jsonEncode(payload),
      maxOutputTokens: 2500,
    );
    model.recordLlmRequest(provider: provider, model: modelName);
    final obj = decodeLlmJsonObject(result.text);
    final assetsRaw = obj['assets'];
    final liabsRaw = obj['liabilities'];
    if (assetsRaw is! List || liabsRaw is! List) return false;

    final assetMaps = [for (final e in assetsRaw) if (e is Map) Map<String, dynamic>.from(e)];
    final liabMaps = [for (final e in liabsRaw) if (e is Map) Map<String, dynamic>.from(e)];

    _removeSeededDemoRows(model);
    model.assets.addAll(
      _assetsFromMaps(assetMaps, templates: templates),
    );
    model.liabilities.addAll(_liabilitiesFromMaps(liabMaps));
    _finishDemoLedgerSetup(model);
    return true;
  } catch (_) {
    return false;
  }
}

void applyFallbackDummyLedger(
  AppModel model, {
  required CurrencyCode primaryCurrency,
  CurrencyCode? secondaryCurrency,
  Iterable<CurrencyCode>? enabledCurrencies,
}) {
  final enabled = OnboardingDummyTemplates.enabledCurrencies(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    extraCurrencies: enabledCurrencies,
  );
  final templates = OnboardingDummyTemplates.assetTemplates(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    enabledCurrencies: enabled,
  );
  _removeSeededDemoRows(model);
  model.assets.addAll(
    _assetsFromMaps(
      templates.cast<Map<String, dynamic>>(),
      templates: templates,
    ),
  );
  model.liabilities.addAll(
    _liabilitiesFromMaps(
      OnboardingDummyTemplates.liabilityTemplates(primaryCurrency).cast<Map<String, dynamic>>(),
    ),
  );
  _finishDemoLedgerSetup(model);
}

void _removeSeededDemoRows(AppModel model) {
  final ids = {
    ...OnboardingDummyTemplates.allSeedAssetIds,
    ...OnboardingDummyTemplates.liabilityIds,
  };
  model.assets.removeWhere((a) => ids.contains(a.id));
  model.liabilities.removeWhere((l) => ids.contains(l.id));
}

/// Placeholder demo rows shown while Apple on-device customizes amounts.
void stageDemoLedgerPlaceholders(
  AppModel model, {
  required CurrencyCode primaryCurrency,
  CurrencyCode? secondaryCurrency,
  Iterable<CurrencyCode>? enabledCurrencies,
}) {
  final enabled = OnboardingDummyTemplates.enabledCurrencies(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    extraCurrencies: enabledCurrencies,
  );
  final templates = OnboardingDummyTemplates.assetTemplates(
    primaryCurrency: primaryCurrency,
    secondaryCurrency: secondaryCurrency,
    enabledCurrencies: enabled,
  );
  _removeSeededDemoRows(model);
  for (final t in templates) {
    model.assets.add(
      LedgerAssetRow(
        id: t['id']! as String,
        type: LedgerAssetTypeUi.fromApi(t['type']?.toString()),
        currencyCountry: t['currencyCountry']?.toString() ?? 'US',
        name: t['name']?.toString() ?? '',
        total: 0,
        label: '',
        comment: '',
        contextMarkdown: null,
      ),
    );
  }
  for (final t in OnboardingDummyTemplates.liabilityTemplates(primaryCurrency)) {
    model.liabilities.add(
      LedgerLiabilityRow(
        id: t['id']! as String,
        type: LedgerLiabilityTypeUi.fromApi(t['type']?.toString()),
        name: t['name']?.toString() ?? '',
        currencyCountry: t['currencyCountry']?.toString() ?? 'US',
        total: 0,
        interestRatePct: 0,
        comment: '',
        contextMarkdown: null,
      ),
    );
  }
  model.setDemoLedgerSetupInProgress(true);
}

void _finishDemoLedgerSetup(AppModel model) {
  model.clearDemoLedgerSetupInProgress();
}
