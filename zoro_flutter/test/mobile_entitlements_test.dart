import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/entitlements/mobile_entitlements.dart';

void main() {
  test('effectiveIsPro respects grace after expiry', () {
    final expires = DateTime.utc(2026, 6, 1, 12);
    final duringGrace = expires.add(const Duration(days: 1));
    final afterGrace = expires.add(const Duration(days: MobileEntitlements.proGraceDays, hours: 1));

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
      MobileEntitlements.computeEffectiveIsPro(isPro: true, proExpiresAtIso: null),
      isTrue,
    );
    expect(
      MobileEntitlements.computeEffectiveIsPro(isPro: false, proExpiresAtIso: null),
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
      freeAiMonthKey: null,
      freeAiUsed: false,
      updatedAtIso: DateTime.now().toUtc().toIso8601String(),
    );
    expect(ent.isInProGracePeriod, isFalse);
  });
}
