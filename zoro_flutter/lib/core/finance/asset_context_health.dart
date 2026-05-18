import '../state/ledger_rows.dart';

enum ContextHealthLevel { ok, caution, broken }

class AssetContextHealth {
  const AssetContextHealth({
    required this.level,
    required this.title,
    required this.detail,
  });

  final ContextHealthLevel level;
  final String title;
  final String detail;

  bool get isOk => level == ContextHealthLevel.ok;
}

final _dollarAmount = RegExp(r'\$[\d,]+(?:\.\d{1,2})?|\b[\d,]+\.\d{2}\b');

final _unknownRestPhrases = RegExp(
  r'rest|remainder|unknown|unspecified|other holdings|not listed|unexplained',
  caseSensitive: false,
);

/// Lightweight investment-account note vs ledger total check.
AssetContextHealth assessAssetContextHealth({
  required LedgerAssetRow asset,
  required double displayValue,
}) {
  if (asset.type != LedgerAssetType.investments) {
    return const AssetContextHealth(
      level: ContextHealthLevel.ok,
      title: '',
      detail: '',
    );
  }

  final md = (asset.contextMarkdown ?? '').trim();
  if (md.isEmpty || displayValue <= 0) {
    return const AssetContextHealth(
      level: ContextHealthLevel.ok,
      title: '',
      detail: '',
    );
  }

  var explained = 0.0;
  for (final m in _dollarAmount.allMatches(md)) {
    final raw = m.group(0) ?? '';
    final cleaned = raw.replaceAll(RegExp(r'[^\d.]'), '');
    final v = double.tryParse(cleaned);
    if (v != null && v > 0) explained += v;
  }

  if (explained <= 0) {
    return const AssetContextHealth(
      level: ContextHealthLevel.ok,
      title: '',
      detail: '',
    );
  }

  final gap = displayValue - explained;
  final gapPct = gap.abs() / displayValue;
  final hasUnknownPhrase = _unknownRestPhrases.hasMatch(md);

  if (gapPct > 0.40 && !hasUnknownPhrase) {
    return AssetContextHealth(
      level: ContextHealthLevel.broken,
      title: 'Context doesn\'t match balance',
      detail: 'Described holdings sum to about \$${explained.toStringAsFixed(0)} vs ledger \$${displayValue.toStringAsFixed(0)}.',
    );
  }

  if (gapPct > 0.15 && !hasUnknownPhrase) {
    return AssetContextHealth(
      level: ContextHealthLevel.caution,
      title: 'Context may be incomplete',
      detail: 'Explained amounts are short of the account total — note what\'s missing.',
    );
  }

  return const AssetContextHealth(
    level: ContextHealthLevel.ok,
    title: '',
    detail: '',
  );
}
