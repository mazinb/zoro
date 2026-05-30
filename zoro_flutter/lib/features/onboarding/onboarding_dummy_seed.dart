import 'dart:convert';

import '../../core/finance/currency.dart';
import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_json.dart';
import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';

/// Template rows used when Apple on-device is unavailable.
class OnboardingDummyTemplates {
  static const assetIds = [
    SeedLedgerIds.assetCondo,
    SeedLedgerIds.assetUsBrokerage,
    SeedLedgerIds.assetIndiaIndex,
    SeedLedgerIds.assetThaiCash,
  ];

  static const liabilityIds = ['l-seed-condo', 'l-seed-car'];

  static List<Map<String, Object?>> assetTemplates(CurrencyCode primary) {
    final country = _countryName(primary);
    return [
      {
        'id': SeedLedgerIds.assetCondo,
        'type': LedgerAssetType.property.apiValue,
        'currencyCountry': country,
        'name': country == 'Thailand' ? 'Bangkok Condo' : 'Primary residence',
        'total': country == 'US' ? 650000.0 : (country == 'Thailand' ? 9500000.0 : 4200000.0),
        'contextMarkdown': _condoContext(country),
      },
      {
        'id': SeedLedgerIds.assetUsBrokerage,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': 'US',
        'name': 'US Brokerage',
        'total': 350000,
        'contextMarkdown': _usBrokerageContext(),
      },
      {
        'id': SeedLedgerIds.assetIndiaIndex,
        'type': LedgerAssetType.investments.apiValue,
        'currencyCountry': 'India',
        'name': 'India Index Fund',
        'total': 2000000,
        'contextMarkdown': _indiaFundContext(),
      },
      {
        'id': SeedLedgerIds.assetThaiCash,
        'type': LedgerAssetType.savings.apiValue,
        'currencyCountry': country == 'Thailand' ? 'Thailand' : 'US',
        'name': country == 'Thailand' ? 'Thai Cash' : 'Cash reserve',
        'total': country == 'Thailand' ? 1500000.0 : 25000.0,
        'contextMarkdown': _thaiCashContext(),
      },
    ];
  }

  static List<Map<String, Object?>> liabilityTemplates(CurrencyCode primary) {
    final country = _countryName(primary);
    final thb = country == 'Thailand';
    return [
      {
        'id': 'l-seed-condo',
        'type': LedgerLiabilityType.mortgage.apiValue,
        'name': thb ? 'Condo mortgage' : 'Home mortgage',
        'currencyCountry': country,
        'total': thb ? 4200000.0 : 320000.0,
        'interestRatePct': 6.25,
        'contextMarkdown': _mortgageContext(country),
      },
      {
        'id': 'l-seed-car',
        'type': LedgerLiabilityType.carLoan.apiValue,
        'name': 'Car loan',
        'currencyCountry': country,
        'total': thb ? 750000.0 : 28000.0,
        'interestRatePct': 3.1,
        'contextMarkdown': _carLoanContext(country),
      },
    ];
  }

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

String _countryName(CurrencyCode c) => switch (c) {
      CurrencyCode.thb => 'Thailand',
      CurrencyCode.inr => 'India',
      CurrencyCode.usd => 'US',
      _ => 'US',
    };

const _dummyLedgerAppleSystem = '''
You customize demo ledger rows for a new user. Reply with ONE JSON object only:
{
  "assets": [
    {"id":"a-seed-condo","type":"property","currencyCountry":"Thailand","name":"...","total":0,"contextMarkdown":"..."}
  ],
  "liabilities": [
    {"id":"l-seed-condo","type":"mortgage","name":"...","currencyCountry":"Thailand","total":0,"interestRatePct":6.25,"contextMarkdown":"..."}
  ]
}

Rules:
- Keep the same ids as payload.templateAssets and payload.templateLiabilities.
- Set currencyCountry to a country name matching the user's primary currency (payload.primaryCurrencyCountry).
- Scale totals to realistic local amounts (property, investments, cash, loans).
- contextMarkdown: short structured notes in English.
- Do not invent cash-flow months or expense data.
''';

List<LedgerAssetRow> _assetsFromMaps(List<Map<String, dynamic>> maps) {
  final out = <LedgerAssetRow>[];
  for (final m in maps) {
    final id = m['id']?.toString();
    if (id == null) continue;
    final type = LedgerAssetTypeUi.fromApi(m['type']?.toString());
    final country = m['currencyCountry']?.toString() ?? 'US';
    final totalRaw = m['total'];
    final total = totalRaw is num
        ? totalRaw.toDouble()
        : double.tryParse(totalRaw?.toString() ?? '') ?? 0;
    out.add(
      LedgerAssetRow(
        id: id,
        type: type,
        currencyCountry: country,
        name: m['name']?.toString() ?? '',
        total: total,
        label: '',
        comment: '',
        contextMarkdown: m['contextMarkdown']?.toString(),
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
  required CurrencyCode primaryCurrency,
  CurrencyCode? secondaryCurrency,
}) async {
  if (!model.appleFoundationRuntimeAvailable) return false;
  final payload = {
    'primaryCurrencyCountry': _countryName(primaryCurrency),
    'secondaryCurrencyCountry': secondaryCurrency == null ? null : _countryName(secondaryCurrency),
    'templateAssets': OnboardingDummyTemplates.assetTemplates(primaryCurrency),
    'templateLiabilities': OnboardingDummyTemplates.liabilityTemplates(primaryCurrency),
  };
  try {
    final result = await LlmClient().complete(
      provider: LlmProvider.appleFoundation,
      apiKey: AppModel.appleOnDeviceApiKeySentinel,
      model: 'default',
      system: _dummyLedgerAppleSystem,
      user: jsonEncode(payload),
      maxOutputTokens: 2500,
    );
    model.recordLlmRequest(provider: LlmProvider.appleFoundation, model: 'default');
    final obj = decodeLlmJsonObject(result.text);
    final assetsRaw = obj['assets'];
    final liabsRaw = obj['liabilities'];
    if (assetsRaw is! List || liabsRaw is! List) return false;

    final assetMaps = [for (final e in assetsRaw) if (e is Map) Map<String, dynamic>.from(e)];
    final liabMaps = [for (final e in liabsRaw) if (e is Map) Map<String, dynamic>.from(e)];

    _removeSeededDemoRows(model);
    model.assets.addAll(_assetsFromMaps(assetMaps));
    model.liabilities.addAll(_liabilitiesFromMaps(liabMaps));
    return true;
  } catch (_) {
    return false;
  }
}

void applyFallbackDummyLedger(
  AppModel model, {
  required CurrencyCode primaryCurrency,
  CurrencyCode? secondaryCurrency,
}) {
  _removeSeededDemoRows(model);
  model.assets.addAll(
    _assetsFromMaps(
      OnboardingDummyTemplates.assetTemplates(primaryCurrency).cast<Map<String, dynamic>>(),
    ),
  );
  model.liabilities.addAll(
    _liabilitiesFromMaps(
      OnboardingDummyTemplates.liabilityTemplates(primaryCurrency).cast<Map<String, dynamic>>(),
    ),
  );
}

void _removeSeededDemoRows(AppModel model) {
  final ids = {
    ...OnboardingDummyTemplates.assetIds,
    ...OnboardingDummyTemplates.liabilityIds,
  };
  model.assets.removeWhere((a) => ids.contains(a.id));
  model.liabilities.removeWhere((l) => ids.contains(l.id));
}
