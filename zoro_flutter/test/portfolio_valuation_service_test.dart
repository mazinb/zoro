import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:zoro_flutter/core/api/portfolio_valuation_service.dart';

void main() {
  test('PortfolioValuationService parses live NAV', () async {
    final client = MockClient((req) async {
      expect(req.url.path, '/api/zoro/valuation');
      expect(req.url.queryParameters['token'], 'zorolk_abc');
      return http.Response(
        '{"ok":true,"currency":"USD","nav":12345.67,"cash":100,"as_of":"now","source":"live",'
        '"label":"IBKR Covered Call Assistant","portfolio_url":"https://portfolio.getzoro.com"}',
        200,
        headers: {'content-type': 'application/json'},
      );
    });
    final svc = PortfolioValuationService(client: client);
    final v = await svc.fetch('zorolk_abc');
    expect(v.ok, isTrue);
    expect(v.nav, 12345.67);
    expect(v.source, 'live');
  });

  test('invalid token maps error', () async {
    final client = MockClient((req) async {
      return http.Response('{"ok":false,"error":"invalid_token"}', 401);
    });
    final svc = PortfolioValuationService(client: client);
    final v = await svc.fetch('zorolk_bad');
    expect(v.ok, isFalse);
    expect(v.error, 'invalid_token');
  });
}
