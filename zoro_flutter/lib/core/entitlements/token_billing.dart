/// Cloud AI billing. Pro is unlimited; Free spends [tokenBalance].
/// IAP product [IapProductIds.credit1] still grants one pack (App Store id unchanged).
abstract final class TokenBilling {
  static const int tokensPerPack = 100000;
  static const int monthlyFreeTokens = 100000;

  static int parseCount(Object? raw, {int fallback = 0}) {
    if (raw is int) return raw < 0 ? 0 : raw;
    if (raw is num) {
      final n = raw.round();
      return n < 0 ? 0 : n;
    }
    final n = int.tryParse(raw?.toString() ?? '');
    if (n == null) return fallback;
    return n < 0 ? 0 : n;
  }

  static String formatCount(int n) {
    final v = n < 0 ? 0 : n;
    if (v >= 1000000) {
      final m = v / 1000000;
      if ((m - m.round()).abs() < 0.05) return '${m.round()}M';
      return '${m.toStringAsFixed(1)}M';
    }
    if (v >= 10000) return '${(v / 1000).round()}k';
    if (v >= 1000) {
      final k = v / 1000;
      if ((k - k.round()).abs() < 0.05) return '${k.round()}k';
      return '${k.toStringAsFixed(1)}k';
    }
    return '$v';
  }
}
