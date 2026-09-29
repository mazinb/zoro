import 'dart:convert';

import 'package:http/http.dart' as http;

/// Live valuation from Covered Call Assistant (`portfolio.getzoro.com`).
class PortfolioValuation {
  const PortfolioValuation({
    required this.ok,
    required this.currency,
    required this.nav,
    required this.cash,
    required this.asOf,
    required this.source,
    required this.label,
    required this.portfolioUrl,
    this.error,
  });

  final bool ok;
  final String currency;
  final double? nav;
  final double? cash;
  final String? asOf;
  final String? source;
  final String label;
  final String portfolioUrl;
  final String? error;

  factory PortfolioValuation.fromJson(Map<String, dynamic> j) {
    final navRaw = j['nav'];
    final cashRaw = j['cash'];
    return PortfolioValuation(
      ok: j['ok'] == true,
      currency: (j['currency'] as String?)?.trim().isNotEmpty == true
          ? (j['currency'] as String).trim()
          : 'USD',
      nav: navRaw is num ? navRaw.toDouble() : double.tryParse('$navRaw'),
      cash: cashRaw is num ? cashRaw.toDouble() : double.tryParse('$cashRaw'),
      asOf: j['as_of']?.toString(),
      source: j['source']?.toString(),
      label: (j['label'] as String?)?.trim().isNotEmpty == true
          ? (j['label'] as String).trim()
          : 'IBKR Covered Call Assistant',
      portfolioUrl: (j['portfolio_url'] as String?)?.trim().isNotEmpty == true
          ? (j['portfolio_url'] as String).trim()
          : PortfolioValuationService.defaultBase,
      error: j['error']?.toString(),
    );
  }
}

class PortfolioValuationService {
  PortfolioValuationService({
    this.baseUrl = defaultBase,
    http.Client? client,
  }) : _client = client ?? http.Client();

  static const defaultBase = 'https://portfolio.getzoro.com';

  final String baseUrl;
  final http.Client _client;

  Uri valuationUri(String token) {
    final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$base/api/zoro/valuation').replace(queryParameters: {'token': token});
  }

  Future<PortfolioValuation> fetch(String token) async {
    final t = token.trim();
    if (t.isEmpty) {
      return const PortfolioValuation(
        ok: false,
        currency: 'USD',
        nav: null,
        cash: null,
        asOf: null,
        source: null,
        label: 'IBKR Covered Call Assistant',
        portfolioUrl: defaultBase,
        error: 'missing_token',
      );
    }
    final r = await _client.get(valuationUri(t)).timeout(const Duration(seconds: 45));
    Map<String, dynamic> body = {};
    try {
      final decoded = jsonDecode(r.body);
      if (decoded is Map<String, dynamic>) body = decoded;
    } catch (_) {}
    if (r.statusCode >= 400) {
      return PortfolioValuation(
        ok: false,
        currency: 'USD',
        nav: null,
        cash: null,
        asOf: null,
        source: null,
        label: 'IBKR Covered Call Assistant',
        portfolioUrl: defaultBase,
        error: body['error']?.toString() ?? 'http_${r.statusCode}',
      );
    }
    return PortfolioValuation.fromJson(body);
  }
}
