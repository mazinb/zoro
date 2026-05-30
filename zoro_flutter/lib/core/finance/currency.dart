import 'package:flutter/services.dart';

/// Canonical currencies supported for asset valuation in the UI mock.
///
/// Important: Exchange rates are intentionally hard-coded for now.
/// Currency conversion is currently hard-coded (UI-first build).
enum CurrencyCode { thb, inr, usd, aed, sgd, aud, eur, jpy, hkd }

/// Order for display-currency dropdowns (Home, Settings).
const List<CurrencyCode> kDisplayCurrencyPickerOptions = [
  CurrencyCode.usd,
  CurrencyCode.thb,
  CurrencyCode.inr,
  CurrencyCode.aed,
  CurrencyCode.sgd,
  CurrencyCode.aud,
  CurrencyCode.eur,
  CurrencyCode.jpy,
  CurrencyCode.hkd,
];

/// Ledger asset/liability currency dropdown (all supported codes).
const List<CurrencyCode> kLedgerCurrencyPickerOptions = kDisplayCurrencyPickerOptions;

/// Resolves stored ledger `currencyCountry` (ISO code or legacy country name).
CurrencyCode ledgerCurrencyCodeFromRaw(String raw) =>
    tryCurrencyCodeForPresetCountry(raw) ?? CurrencyCode.usd;

/// Canonical ISO code stored on new/edited ledger rows.
String ledgerCurrencyStorageValue(CurrencyCode c) => c.code;

/// Picker value for a stored ledger currency (normalizes legacy country names).
String ledgerCurrencyPickerValue(String raw) => ledgerCurrencyCodeFromRaw(raw).code;

/// Compact dropdown label, e.g. "🇭🇰 HKD (H$)".
String ledgerCurrencyPickerLabel(CurrencyCode c) {
  final sym = c.symbol.trim();
  return '${c.flag} ${c.code} ($sym)';
}

String ledgerCurrencyDisplayLabel(String raw) =>
    ledgerCurrencyPickerLabel(ledgerCurrencyCodeFromRaw(raw));

String ledgerCurrencyFlag(String raw) => ledgerCurrencyCodeFromRaw(raw).flag;

extension CurrencyCodeUi on CurrencyCode {
  String get flag => switch (this) {
    CurrencyCode.usd => '🇺🇸',
    CurrencyCode.thb => '🇹🇭',
    CurrencyCode.inr => '🇮🇳',
    CurrencyCode.aed => '🇦🇪',
    CurrencyCode.sgd => '🇸🇬',
    CurrencyCode.aud => '🇦🇺',
    CurrencyCode.eur => '🇪🇺',
    CurrencyCode.jpy => '🇯🇵',
    CurrencyCode.hkd => '🇭🇰',
  };

  String get code => switch (this) {
    CurrencyCode.thb => 'THB',
    CurrencyCode.inr => 'INR',
    CurrencyCode.usd => 'USD',
    CurrencyCode.aed => 'AED',
    CurrencyCode.sgd => 'SGD',
    CurrencyCode.aud => 'AUD',
    CurrencyCode.eur => 'EUR',
    CurrencyCode.jpy => 'JPY',
    CurrencyCode.hkd => 'HKD',
  };

  String get symbol => switch (this) {
    CurrencyCode.thb => '฿',
    CurrencyCode.inr => '₹',
    CurrencyCode.usd => '\$',
    // The official new UAE Dirham mark is an SVG (see dirham_symbol package).
    // String contexts use the ISO code prefix "AED " so labels read
    // "AED 1,234"; UI fields render the proper symbol via DirhamIcon.
    CurrencyCode.aed => 'AED ',
    CurrencyCode.sgd => 'S\$',
    CurrencyCode.aud => 'A\$',
    CurrencyCode.eur => '€',
    CurrencyCode.jpy => '¥',
    CurrencyCode.hkd => 'H\$',
  };

  /// Hard-coded spot FX rate expressed as: 1 unit of this currency == X USD.
  double get usdPerUnit => switch (this) {
    CurrencyCode.usd => 1.0,
    CurrencyCode.thb => 0.0277, // ~ 1 THB = 0.0277 USD  (≈ 36.1 THB/USD)
    CurrencyCode.inr => 0.0120, // ~ 1 INR = 0.0120 USD (≈ 83.3 INR/USD)
    CurrencyCode.aed => 0.272, // ~ 3.67 AED/USD
    CurrencyCode.sgd => 0.741, // ~ 1.35 SGD/USD
    CurrencyCode.aud => 0.649, // ~ 1.54 AUD/USD
    CurrencyCode.eur => 1.075, // ~ 0.93 EUR/USD
    CurrencyCode.jpy => 0.00671, // ~ 149 JPY/USD
    CurrencyCode.hkd => 0.128, // ~ 7.8 HKD/USD
  };

  Color get chipColor => switch (this) {
    CurrencyCode.usd => const Color(0xFF1D4ED8), // blueDark
    CurrencyCode.thb => const Color(0xFF3B82F6), // blue
    CurrencyCode.inr => const Color(0xFF93C5FD), // blueLight
    CurrencyCode.aed => const Color(0xFF0EA5E9),
    CurrencyCode.sgd => const Color(0xFF6366F1),
    CurrencyCode.aud => const Color(0xFF14B8A6),
    CurrencyCode.eur => const Color(0xFF8B5CF6),
    CurrencyCode.jpy => const Color(0xFFF43F5E),
    CurrencyCode.hkd => const Color(0xFF22C55E),
  };
}

double convertCurrency({
  required double value,
  required CurrencyCode from,
  required CurrencyCode to,

  /// When set, maps each [CurrencyCode] to USD per 1 unit of that currency (same semantics as [CurrencyCodeUi.usdPerUnit]).
  Map<CurrencyCode, double>? usdPerUnitOverrides,
}) {
  if (from == to) return value;
  double usdPer(CurrencyCode c) => usdPerUnitOverrides?[c] ?? c.usdPerUnit;
  final usd = value * usdPer(from);
  return usd / usdPer(to);
}

String formatMoney(double v, {required CurrencyCode currency, int? decimals}) {
  final d = decimals ?? (v.abs() >= 100 ? 0 : 2);
  return '${currency.symbol}${v.toStringAsFixed(d)}';
}

/// Indian numbering: groups of 2 after the first 3 from the right (e.g. 12,34,567).
String _formatEnInInteger(int n) {
  final neg = n < 0;
  final s = (neg ? -n : n).toString();
  if (s.length <= 3) return neg ? '-$s' : s;
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[last3];
  while (rest.isNotEmpty) {
    if (rest.length <= 2) {
      parts.insert(0, rest);
      break;
    }
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  final out = parts.join(',');
  return neg ? '-$out' : out;
}

/// Western grouping: thousands separators (e.g. 5,012,508).
String _formatEnUsInteger(int n) {
  final neg = n < 0;
  final digits = (neg ? -n : n).toString();
  final rev = digits.split('').reversed.join();
  final buf = StringBuffer();
  for (var i = 0; i < rev.length; i++) {
    if (i > 0 && i % 3 == 0) buf.write(',');
    buf.write(rev[i]);
  }
  final out = buf.toString().split('').reversed.join();
  return neg ? '-$out' : out;
}

String _formatMillionsCompact(double amountAbs, String symbol) {
  final m = amountAbs / 1000000;
  final fmt = m >= 100
      ? m.toStringAsFixed(0)
      : m >= 10
      ? m.toStringAsFixed(1)
      : m.toStringAsFixed(2);
  return '$symbol$fmt M';
}

/// Display formatting aligned with web `formatCurrency` in
/// `zoro-app/src/components/retirement/utils.ts`.
///
/// INR: `Cr` / `L` abbreviations or `en-IN` comma grouping.
/// USD/THB: `M` suffix above 1e6 else `en-US` grouping.
/// Replaces every ASCII digit with `*` (commas/symbols unchanged). Used for privacy mode.
String maskSensitiveNumberString(String input) =>
    input.replaceAll(RegExp(r'[0-9]'), '*');

String formatCurrencyDisplay(double amount, {required CurrencyCode currency}) {
  final neg = amount < 0;
  final a = amount.abs();

  late final String body;
  switch (currency) {
    case CurrencyCode.inr:
      if (a >= 10000000) {
        body = '₹${(a / 10000000).toStringAsFixed(2)} Cr';
      } else if (a >= 100000) {
        body = '₹${(a / 100000).toStringAsFixed(2)} L';
      } else {
        body = '₹${_formatEnInInteger(a.round())}';
      }
    case CurrencyCode.usd:
    case CurrencyCode.thb:
    case CurrencyCode.aed:
    case CurrencyCode.sgd:
    case CurrencyCode.aud:
    case CurrencyCode.eur:
    case CurrencyCode.jpy:
    case CurrencyCode.hkd:
      final sym = currency.symbol;
      if (a >= 1000000) {
        body = _formatMillionsCompact(a, sym);
      } else {
        body = '$sym${_formatEnUsInteger(a.round())}';
      }
  }

  return neg ? '-$body' : body;
}

String formatCurrencyCompactShort(
  double amount, {
  required CurrencyCode currency,
}) {
  final neg = amount < 0;
  final a = amount.abs();

  String withSign(String s) => neg ? '-$s' : s;

  String fmtUnit(double v) {
    // Keep it readable on small screens:
    // - 2.3K (1 decimal) when < 10
    // - 17K / 276K (0 decimals) when >= 10
    final d = v >= 10 ? 0 : 1;
    return v.toStringAsFixed(d);
  }

  switch (currency) {
    case CurrencyCode.inr:
      if (a >= 10000000) {
        return withSign('₹${fmtUnit(a / 10000000)}C');
      }
      if (a >= 100000) {
        return withSign('₹${fmtUnit(a / 100000)}L');
      }
      return withSign('₹${_formatEnInInteger(a.round())}');
    case CurrencyCode.usd:
    case CurrencyCode.thb:
    case CurrencyCode.aed:
    case CurrencyCode.sgd:
    case CurrencyCode.aud:
    case CurrencyCode.eur:
    case CurrencyCode.jpy:
    case CurrencyCode.hkd:
      final sym = currency.symbol;
      if (a >= 1000000000) {
        return withSign('$sym${fmtUnit(a / 1000000000)}B');
      }
      if (a >= 1000000) {
        return withSign('$sym${fmtUnit(a / 1000000)}M');
      }
      if (a >= 1000) {
        return withSign('$sym${fmtUnit(a / 1000)}K');
      }
      return withSign('$sym${_formatEnUsInteger(a.round())}');
  }
}

String formatGroupedInteger(int value, {required CurrencyCode currency}) {
  return switch (currency) {
    CurrencyCode.inr => _formatEnInInteger(value),
    CurrencyCode.usd ||
    CurrencyCode.thb ||
    CurrencyCode.aed ||
    CurrencyCode.sgd ||
    CurrencyCode.aud ||
    CurrencyCode.eur ||
    CurrencyCode.jpy ||
    CurrencyCode.hkd => _formatEnUsInteger(value),
  };
}

class GroupedIntegerTextInputFormatter extends TextInputFormatter {
  GroupedIntegerTextInputFormatter({required this.currency});

  final CurrencyCode currency;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final rawDigits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (rawDigits.isEmpty) {
      return const TextEditingValue(text: '');
    }
    final v = int.tryParse(rawDigits) ?? 0;
    final formatted = formatGroupedInteger(v, currency: currency);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
      composing: TextRange.empty,
    );
  }
}

/// Maps web assets row `currency` (country preset name) to a conversion bucket.
/// Keep in sync with `countryPresets` names in `web_expenses_income.dart`.
CurrencyCode? tryCurrencyCodeForPresetCountry(String countryNameRaw) {
  final t = countryNameRaw.trim();
  if (t.isEmpty) return null;
  final u = t.toUpperCase();
  if (u == 'INR' || _ciEq(t, 'India')) return CurrencyCode.inr;
  if (u == 'THB' || _ciEq(t, 'Thailand')) return CurrencyCode.thb;
  if (u == 'USD' || _ciEq(t, 'US') || _ciEq(t, 'United States')) {
    return CurrencyCode.usd;
  }
  if (u == 'AED' || _ciEq(t, 'UAE') || _ciEq(t, 'United Arab Emirates')) {
    return CurrencyCode.aed;
  }
  if (u == 'SGD' || _ciEq(t, 'Singapore')) return CurrencyCode.sgd;
  if (u == 'AUD' || _ciEq(t, 'Australia')) return CurrencyCode.aud;
  if (u == 'EUR' || _ciEq(t, 'Euro')) return CurrencyCode.eur;
  if (u == 'JPY' || _ciEq(t, 'Japan')) return CurrencyCode.jpy;
  if (u == 'HKD' ||
      _ciEq(t, 'Hong Kong') ||
      _ciEq(t, 'HK') ||
      _ciEq(t, 'HKSAR') ||
      _ciEq(t, 'Hong Kong SAR')) {
    return CurrencyCode.hkd;
  }
  return null;
}

CurrencyCode currencyCodeForPresetCountry(String countryName) {
  return tryCurrencyCodeForPresetCountry(countryName) ?? CurrencyCode.usd;
}

bool _ciEq(String a, String b) =>
    a.toLowerCase().trim() == b.toLowerCase().trim();

/// Income lines may use preset country names, ISO codes, or arbitrary labels.
/// Unknown values use USD grouping and FX so the field stays free-form.
CurrencyCode currencyCodeForIncomeLineCurrency(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return CurrencyCode.usd;
  final u = t.toUpperCase();
  if (u == 'INR' || _ciEq(t, 'India')) return CurrencyCode.inr;
  if (u == 'THB' || _ciEq(t, 'Thailand')) return CurrencyCode.thb;
  if (u == 'USD' || _ciEq(t, 'US') || _ciEq(t, 'United States')) {
    return CurrencyCode.usd;
  }
  if (u == 'AED' || _ciEq(t, 'UAE') || _ciEq(t, 'United Arab Emirates')) {
    return CurrencyCode.aed;
  }
  if (u == 'SGD' || _ciEq(t, 'Singapore')) return CurrencyCode.sgd;
  if (u == 'AUD' || _ciEq(t, 'Australia')) return CurrencyCode.aud;
  if (u == 'EUR' || _ciEq(t, 'Euro')) return CurrencyCode.eur;
  if (u == 'JPY' || _ciEq(t, 'Japan')) return CurrencyCode.jpy;
  if (u == 'HKD' ||
      _ciEq(t, 'Hong Kong') ||
      _ciEq(t, 'HK') ||
      _ciEq(t, 'HKSAR') ||
      _ciEq(t, 'Hong Kong SAR')) {
    return CurrencyCode.hkd;
  }
  return CurrencyCode.usd;
}
