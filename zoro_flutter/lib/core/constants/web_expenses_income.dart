import 'package:flutter/material.dart';

/// Mirrors key UI field shapes from zoro-app (web) for UI parity.
///
/// Notes:
/// - This is UI-only, no DB/token logic.
/// - Country list and expense bucket ranges are taken from `zoro-app/src/components/retirement/countryData.ts`.

const expenseBucketKeys = <String>[
  'housing',
  'food',
  'transportation',
  'healthcare',
  'entertainment',
  'other',
];

/// Same as [expenseBucketKeys] (all buckets are monthly estimates).
const recurringExpenseBucketKeys = expenseBucketKeys;

class CountryPreset {
  const CountryPreset({
    required this.name,
    required this.flag,
    required this.currencySymbol,
    required this.buckets,
  });

  final String name;
  final String flag;
  final String currencySymbol;
  final Map<String, ExpenseBucketPreset> buckets;
}

class ExpenseBucketPreset {
  const ExpenseBucketPreset({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final double step;
}

const countryPresets = <CountryPreset>[
  CountryPreset(
    name: 'India',
    flag: '🇮🇳',
    currencySymbol: '₹',
    buckets: {
      'housing': ExpenseBucketPreset(label: 'Housing & Utilities', value: 15000, min: 5000, max: 50000, step: 1000),
      'food': ExpenseBucketPreset(label: 'Food & Dining', value: 12000, min: 5000, max: 30000, step: 1000),
      'transportation': ExpenseBucketPreset(label: 'Transportation', value: 5000, min: 2000, max: 20000, step: 500),
      'healthcare': ExpenseBucketPreset(label: 'Healthcare & Insurance', value: 8000, min: 3000, max: 25000, step: 1000),
      'entertainment': ExpenseBucketPreset(label: 'Entertainment & Leisure', value: 6000, min: 2000, max: 20000, step: 500),
      'other': ExpenseBucketPreset(label: 'Other Expenses', value: 4000, min: 1000, max: 15000, step: 500),
    },
  ),
  CountryPreset(
    name: 'Thailand',
    flag: '🇹🇭',
    currencySymbol: '฿',
    buckets: {
      'housing': ExpenseBucketPreset(label: 'Housing & Utilities', value: 48000, min: 12000, max: 120000, step: 1000),
      'food': ExpenseBucketPreset(label: 'Food & Dining', value: 22000, min: 6000, max: 50000, step: 500),
      'transportation': ExpenseBucketPreset(label: 'Transportation', value: 8000, min: 2000, max: 40000, step: 500),
      'healthcare': ExpenseBucketPreset(label: 'Healthcare & Insurance', value: 7500, min: 2000, max: 35000, step: 500),
      'entertainment': ExpenseBucketPreset(label: 'Entertainment & Leisure', value: 14000, min: 3000, max: 45000, step: 500),
      'other': ExpenseBucketPreset(label: 'Other Expenses', value: 12000, min: 2000, max: 35000, step: 500),
    },
  ),
  CountryPreset(
    name: 'US',
    flag: '🇺🇸',
    currencySymbol: '\$',
    buckets: {
      'housing': ExpenseBucketPreset(label: 'Housing & Utilities', value: 1800, min: 800, max: 4000, step: 100),
      'food': ExpenseBucketPreset(label: 'Food & Dining', value: 1000, min: 500, max: 2500, step: 50),
      'transportation': ExpenseBucketPreset(label: 'Transportation', value: 600, min: 300, max: 2000, step: 50),
      'healthcare': ExpenseBucketPreset(label: 'Healthcare & Insurance', value: 800, min: 400, max: 2000, step: 50),
      'entertainment': ExpenseBucketPreset(label: 'Entertainment & Leisure', value: 700, min: 200, max: 2000, step: 50),
      'other': ExpenseBucketPreset(label: 'Other Expenses', value: 400, min: 100, max: 1000, step: 50),
    },
  ),
];

CountryPreset presetForCountry(String name) {
  return countryPresets.firstWhere(
    (c) => c.name == name,
    orElse: () => countryPresets.first,
  );
}

String money(double v, {required String currencySymbol}) {
  final rounded = v.round();
  final s = rounded.toString();
  return '$currencySymbol$s';
}

Color bucketColor(String key) {
  switch (key) {
    case 'housing':
      return const Color(0xFF1D4ED8);
    case 'food':
      return const Color(0xFF7C3AED);
    case 'transportation':
      return const Color(0xFF0EA5E9);
    case 'healthcare':
      return const Color(0xFFDC2626);
    case 'entertainment':
      return const Color(0xFFF59E0B);
    case 'other':
      return const Color(0xFF64748B);
    case 'one_time':
      return const Color(0xFF6B7280);
    case 'travel':
      return const Color(0xFF14B8A6);
    default:
      return const Color(0xFF94A3B8);
  }
}

