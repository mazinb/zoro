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

  final String deviceId;
  final bool isPro;
  final String? proExpiresAtIso;
  final int creditsBalance;
  final String? freeAiMonthKey;
  final bool freeAiUsed;
  final String updatedAtIso;

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

