import 'package:flutter/services.dart';

/// Canonical currencies supported for asset valuation in the UI mock.
///
/// Important: Exchange rates are intentionally hard-coded for now.
/// Currency conversion is currently hard-coded (UI-first build).
enum CurrencyCode { thb, inr, usd }

extension CurrencyCodeUi on CurrencyCode {
  String get code => switch (this) {
        CurrencyCode.thb => 'THB',
        CurrencyCode.inr => 'INR',
        CurrencyCode.usd => 'USD',
      };

  String get symbol => switch (this) {
        CurrencyCode.thb => '฿',
        CurrencyCode.inr => '₹',
        CurrencyCode.usd => '\$',
      };

  /// Hard-coded spot FX rate expressed as: 1 unit of this currency == X USD.
  double get usdPerUnit => switch (this) {
        CurrencyCode.usd => 1.0,
        CurrencyCode.thb => 0.0277, // ~ 1 THB = 0.0277 USD  (≈ 36.1 THB/USD)
        CurrencyCode.inr => 0.0120, // ~ 1 INR = 0.0120 USD (≈ 83.3 INR/USD)
      };

  Color get chipColor => switch (this) {
        CurrencyCode.usd => const Color(0xFF1D4ED8), // blueDark
        CurrencyCode.thb => const Color(0xFF3B82F6), // blue
        CurrencyCode.inr => const Color(0xFF93C5FD), // blueLight
      };
}

double convertCurrency({
  required double value,
  required CurrencyCode from,
  required CurrencyCode to,
}) {
  if (from == to) return value;
  final usd = value * from.usdPerUnit;
  return usd / to.usdPerUnit;
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
String maskSensitiveNumberString(String input) => input.replaceAll(RegExp(r'[0-9]'), '*');

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
      final sym = currency.symbol;
      if (a >= 1000000) {
        body = _formatMillionsCompact(a, sym);
      } else {
        body = '$sym${_formatEnUsInteger(a.round())}';
      }
  }

  return neg ? '-$body' : body;
}

String formatCurrencyCompactShort(double amount, {required CurrencyCode currency}) {
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
    CurrencyCode.usd || CurrencyCode.thb => _formatEnUsInteger(value),
  };
}

class GroupedIntegerTextInputFormatter extends TextInputFormatter {
  GroupedIntegerTextInputFormatter({required this.currency});

  final CurrencyCode currency;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
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
CurrencyCode currencyCodeForPresetCountry(String countryName) {
  switch (countryName) {
    case 'India':
      return CurrencyCode.inr;
    case 'Thailand':
      return CurrencyCode.thb;
    case 'US':
      return CurrencyCode.usd;
    default:
      return CurrencyCode.usd;
  }
}

