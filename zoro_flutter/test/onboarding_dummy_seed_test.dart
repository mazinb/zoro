import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/currency.dart';
import 'package:zoro_flutter/core/state/ledger_rows.dart';
import 'package:zoro_flutter/features/onboarding/onboarding_dummy_seed.dart';

void main() {
  test('USD primary with AED secondary has no India row', () {
    final enabled = {CurrencyCode.usd, CurrencyCode.aed};
    final templates = OnboardingDummyTemplates.assetTemplates(
      primaryCurrency: CurrencyCode.usd,
      secondaryCurrency: CurrencyCode.aed,
      enabledCurrencies: enabled,
    );
    final countries = templates.map((t) => t['currencyCountry']).toList();
    expect(countries, contains('US'));
    expect(countries, isNot(contains('India')));
    expect(countries, isNot(contains('Thailand')));
    expect(countries, contains('UAE'));

    final india = templates.where((t) => t['id'] == SeedLedgerIds.assetIndiaIndex);
    expect(india, isNotEmpty);
    expect(india.first['name'], 'UAE savings');
    expect(india.first['currencyCountry'], 'UAE');
  });

  test('India index only when INR is enabled', () {
    final templates = OnboardingDummyTemplates.assetTemplates(
      primaryCurrency: CurrencyCode.usd,
      enabledCurrencies: {CurrencyCode.usd, CurrencyCode.inr},
    );
    final india = templates.singleWhere((t) => t['id'] == SeedLedgerIds.assetIndiaIndex);
    expect(india['name'], 'India Index Fund');
    expect(india['currencyCountry'], 'India');
  });

  test('Thailand cash only when THB is enabled', () {
    final templates = OnboardingDummyTemplates.assetTemplates(
      primaryCurrency: CurrencyCode.usd,
      enabledCurrencies: {CurrencyCode.usd, CurrencyCode.thb},
    );
    final cash = templates.singleWhere((t) => t['id'] == SeedLedgerIds.assetThaiCash);
    expect(cash['currencyCountry'], 'Thailand');
  });

  test('US brokerage always US', () {
    final templates = OnboardingDummyTemplates.assetTemplates(
      primaryCurrency: CurrencyCode.aed,
      enabledCurrencies: {CurrencyCode.aed},
    );
    final brokerage = templates.singleWhere((t) => t['id'] == SeedLedgerIds.assetUsBrokerage);
    expect(brokerage['currencyCountry'], 'US');
  });
}
