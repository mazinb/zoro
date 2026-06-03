class MobileEntitlements {
  const MobileEntitlements({
    required this.deviceId,
    required this.isPro,
    required this.creditsBalance,
    required this.freeAiMonthKey,
    required this.freeAiUsed,
    required this.updatedAtIso,
    this.proExpiresAtIso,
  });

  /// Days after [proExpiresAtIso] that Pro stays active when billing lapses.
  static const int proGraceDays = 3;

  final String deviceId;
  /// Server flag; use [effectiveIsPro] for gating features.
  final bool isPro;
  final String? proExpiresAtIso;
  final int creditsBalance;
  final String? freeAiMonthKey;
  final bool freeAiUsed;
  final String updatedAtIso;

  /// Paid period end + [proGraceDays]; if no expiry, uses [isPro].
  bool get effectiveIsPro => computeEffectiveIsPro(isPro: isPro, proExpiresAtIso: proExpiresAtIso);

  static bool computeEffectiveIsPro({
    required bool isPro,
    String? proExpiresAtIso,
    DateTime? now,
  }) {
    final raw = proExpiresAtIso?.trim();
    if (raw == null || raw.isEmpty) return isPro;
    final expires = DateTime.tryParse(raw);
    if (expires == null) return isPro;
    final graceEnd = expires.toUtc().add(const Duration(days: proGraceDays));
    final t = (now ?? DateTime.now()).toUtc();
    return t.isBefore(graceEnd);
  }

  /// True when the paid period ended but grace has not.
  bool get isInProGracePeriod {
    final raw = proExpiresAtIso?.trim();
    if (raw == null || raw.isEmpty) return false;
    final expires = DateTime.tryParse(raw);
    if (expires == null) return false;
    final t = DateTime.now().toUtc();
    final end = expires.toUtc();
    final graceEnd = end.add(const Duration(days: proGraceDays));
    return !t.isBefore(end) && t.isBefore(graceEnd);
  }

  DateTime? get proGraceEndsAt {
    final raw = proExpiresAtIso?.trim();
    if (raw == null || raw.isEmpty) return null;
    final expires = DateTime.tryParse(raw);
    if (expires == null) return null;
    return expires.toUtc().add(const Duration(days: proGraceDays));
  }

  static MobileEntitlements? tryFromApi(Map<String, dynamic> body) {
    final data = body['data'];
    if (data is! Map) return null;
    final m = Map<String, dynamic>.from(data);
    final deviceId = (m['deviceId'] ?? '').toString().trim();
    if (deviceId.isEmpty) return null;
    final isPro = m['isPro'] == true;
    final proExpiresAtIso = m['proExpiresAt']?.toString();
    final credits = int.tryParse((m['creditsBalance'] ?? '0').toString()) ?? 0;
    final freeAiMonthKey = m['freeAiMonthKey']?.toString();
    final freeAiUsed = m['freeAiUsed'] == true;
    final updatedAt = (m['updatedAt'] ?? '').toString();
    if (updatedAt.trim().isEmpty) return null;
    return MobileEntitlements(
      deviceId: deviceId,
      isPro: isPro,
      proExpiresAtIso: proExpiresAtIso,
      creditsBalance: credits < 0 ? 0 : credits,
      freeAiMonthKey: freeAiMonthKey,
      freeAiUsed: freeAiUsed,
      updatedAtIso: updatedAt,
    );
  }
}

