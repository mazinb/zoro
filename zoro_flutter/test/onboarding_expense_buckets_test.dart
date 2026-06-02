import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/currency.dart';
import 'package:zoro_flutter/features/onboarding/onboarding_expense_buckets.dart';
import 'package:zoro_flutter/shared/guided_mcq/structured_guide_page.dart';

void main() {
  group('onboardingTargetAnnualExpenseUsd', () {
    test('uses 30k floor when 30% is lower', () {
      expect(onboardingTargetAnnualExpenseUsd(100000), 30000);
    });

    test('uses 30% when above 30k', () {
      expect(onboardingTargetAnnualExpenseUsd(200000), 60000);
    });

    test('caps at 80% when 30k floor exceeds cap', () {
      expect(onboardingTargetAnnualExpenseUsd(25000), 20000);
    });

    test('30% and floor tie at 100k income', () {
      expect(onboardingTargetAnnualExpenseUsd(100000), 30000);
    });
  });

  group('deterministicOnboardingExpenseBuckets', () {
    test('monthly total near baseline for US high earner', () {
      final buckets = deterministicOnboardingExpenseBuckets(
        displayCurrency: CurrencyCode.usd,
        mcq: const StructuredGuideResult(answers: [], optionalNote: ''),
        netMonthlyIncomeUsd: 20000,
      );
      final sum = buckets.values.fold<double>(0, (a, b) => a + b);
      expect(sum, closeTo(6000, 2)); // 30% of 240k / 12
    });

    test('monthly total capped for low income', () {
      final buckets = deterministicOnboardingExpenseBuckets(
        displayCurrency: CurrencyCode.usd,
        mcq: const StructuredGuideResult(answers: [], optionalNote: ''),
        netMonthlyIncomeUsd: 2000,
      );
      final sum = buckets.values.fold<double>(0, (a, b) => a + b);
      expect(sum, closeTo(2000 * 12 * 0.8 / 12, 2));
    });
  });
}
