import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/entitlements/mobile_entitlements.dart';
import 'package:zoro_flutter/core/entitlements/token_billing.dart';

void main() {
  test('effectiveIsPro respects grace after expiry', () {
    final expires = DateTime.utc(2026, 6, 1, 12);
    final duringGrace = expires.add(const Duration(days: 1));
    final afterGrace = expires.add(
      const Duration(days: MobileEntitlements.proGraceDays, hours: 1),
    );

    expect(
      MobileEntitlements.computeEffectiveIsPro(
        isPro: true,
        proExpiresAtIso: expires.toIso8601String(),
        now: duringGrace,
      ),
      isTrue,
    );
    expect(
      MobileEntitlements.computeEffectiveIsPro(
        isPro: true,
        proExpiresAtIso: expires.toIso8601String(),
        now: afterGrace,
      ),
      isFalse,
    );
  });

  test('effectiveIsPro without expiry uses isPro flag', () {
    expect(
      MobileEntitlements.computeEffectiveIsPro(
        isPro: true,
        proExpiresAtIso: null,
      ),
      isTrue,
    );
    expect(
      MobileEntitlements.computeEffectiveIsPro(
        isPro: false,
        proExpiresAtIso: null,
      ),
      isFalse,
    );
  });

  test('isInProGracePeriod is false while subscription still active', () {
    final expires = DateTime.now().toUtc().add(const Duration(days: 10));
    final ent = MobileEntitlements(
      deviceId: 'd',
      isPro: true,
      proExpiresAtIso: expires.toIso8601String(),
      creditsBalance: 0,
      tokenBalance: 0,
      tokensUsedTotal: 0,
      freeAiMonthKey: null,
      freeAiUsed: false,
      updatedAtIso: DateTime.now().toUtc().toIso8601String(),
    );
    expect(ent.isInProGracePeriod, isFalse);
  });

  test('tryFromApi prefers tokenBalance', () {
    final ent = MobileEntitlements.tryFromApi({
      'data': {
        'deviceId': 'd',
        'isPro': false,
        'creditsBalance': 2,
        'tokenBalance': 150000,
        'tokensUsedTotal': 40,
        'freeAiUsed': false,
        'updatedAt': '2026-08-17T00:00:00.000Z',
      },
    });
    expect(ent, isNotNull);
    expect(ent!.tokenBalance, 150000);
    expect(ent.tokensUsedTotal, 40);
    expect(ent.creditsBalance, 2);
  });

  test('tryFromApi falls back to credits times pack size', () {
    final ent = MobileEntitlements.tryFromApi({
      'data': {
        'deviceId': 'd',
        'isPro': false,
        'creditsBalance': 2,
        'freeAiUsed': false,
        'updatedAt': '2026-08-17T00:00:00.000Z',
      },
    });
    expect(ent, isNotNull);
    expect(ent!.tokenBalance, 2 * TokenBilling.tokensPerPack);
  });
}
