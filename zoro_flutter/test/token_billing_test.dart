import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/entitlements/token_billing.dart';
import 'package:zoro_flutter/core/state/app_model.dart';

void main() {
  test('formatCount uses compact suffixes', () {
    expect(TokenBilling.formatCount(0), '0');
    expect(TokenBilling.formatCount(999), '999');
    expect(TokenBilling.formatCount(1000), '1k');
    expect(TokenBilling.formatCount(1500), '1.5k');
    expect(TokenBilling.formatCount(100000), '100k');
    expect(TokenBilling.formatCount(1000000), '1M');
  });

  test('recordLlmRequest accumulates tokens by provider', () {
    final model = AppModel();
    model.recordLlmRequest(provider: LlmProvider.appleFoundation, model: 'system', tokensUsed: 120);
    model.recordLlmRequest(provider: LlmProvider.zoroCloud, model: 'gemini', tokensUsed: 80);
    model.recordLlmRequest(provider: LlmProvider.openai, model: 'gpt-4o', tokensUsed: 40);
    expect(model.overallTokensUsed, 240);
    expect(model.onDeviceTokensUsed, 120);
    expect(model.cloudTokensUsed, 80);
    expect(model.byoKeyTokensUsed, 40);
  });

  test('recordImportRequest stores cloud tokens under zoroCloud import key', () {
    final model = AppModel();
    model.recordImportRequest(cloud: true, tokensUsed: 900);
    expect(model.cloudTokensUsed, 900);
    expect(model.overallTokensUsed, 900);
    expect(model.onDeviceTokensUsed, 0);
  });
}
