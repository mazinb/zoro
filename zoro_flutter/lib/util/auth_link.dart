/// Extracts `verification_token` from a pasted magic-link URL or raw token string.
String? parseVerificationTokenFromInput(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return null;

  final uri = Uri.tryParse(t);
  if (uri != null && uri.hasQuery) {
    final q = uri.queryParameters['token'];
    if (q != null && q.isNotEmpty) return q;
  }

  final m = RegExp(r'[?&]token=([^&\s#]+)').firstMatch(t);
  if (m != null) {
    try {
      return Uri.decodeComponent(m.group(1)!);
    } catch (_) {
      return m.group(1);
    }
  }

  if (RegExp(r'^[a-fA-F0-9]{32}$').hasMatch(t)) return t;
  return t.length >= 16 ? t : null;
}
