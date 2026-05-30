/// Daily rotation topics for the on-device Home summary helper.
enum HomeSummaryFocusDomain {
  assets,
  liabilities,
  cashflow,
  context,
  goals,
}

extension HomeSummaryFocusDomainX on HomeSummaryFocusDomain {
  String get id => name;

  String get label => switch (this) {
        HomeSummaryFocusDomain.assets => 'Assets',
        HomeSummaryFocusDomain.liabilities => 'Liabilities',
        HomeSummaryFocusDomain.cashflow => 'Cash flow',
        HomeSummaryFocusDomain.context => 'Context',
        HomeSummaryFocusDomain.goals => 'Goals',
      };

}

HomeSummaryFocusDomain? homeSummaryFocusDomainFromId(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  for (final d in HomeSummaryFocusDomain.values) {
    if (d.id == raw) return d;
  }
  return null;
}

const _homeSummaryDefaultIncluded = HomeSummaryFocusDomain.values;

List<HomeSummaryFocusDomain> homeSummaryParseIncludedIds(Iterable<String>? ids) {
  if (ids == null) return List<HomeSummaryFocusDomain>.from(_homeSummaryDefaultIncluded);
  final out = <HomeSummaryFocusDomain>[];
  for (final id in ids) {
    final d = homeSummaryFocusDomainFromId(id);
    if (d != null && !out.contains(d)) out.add(d);
  }
  return out.isEmpty ? List<HomeSummaryFocusDomain>.from(_homeSummaryDefaultIncluded) : out;
}

String homeSummaryCalendarDayKey(DateTime d) {
  final y = d.year;
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '$y-$m-$day';
}

HomeSummaryFocusDomain homeSummaryDomainAtRotationIndex(
  List<HomeSummaryFocusDomain> enabled,
  int rotationIndex,
) {
  assert(enabled.isNotEmpty);
  return enabled[rotationIndex % enabled.length];
}

/// Stable checkbox / rotation order (enum declaration order).
List<HomeSummaryFocusDomain> homeSummaryDomainsInCanonicalOrder(
  Iterable<HomeSummaryFocusDomain> domains,
) {
  final selected = domains is Set<HomeSummaryFocusDomain> ? domains : domains.toSet();
  return [
    for (final d in HomeSummaryFocusDomain.values)
      if (selected.contains(d)) d,
  ];
}

/// Keeps "next up" on the same topic when toggling focus checkboxes.
int remapHomeSummaryRotationIndex({
  required List<HomeSummaryFocusDomain> oldEnabled,
  required List<HomeSummaryFocusDomain> newEnabled,
  required int rotationIndex,
}) {
  if (newEnabled.isEmpty) return 0;
  if (oldEnabled.isEmpty) return rotationIndex % newEnabled.length;

  final upcoming = homeSummaryDomainAtRotationIndex(oldEnabled, rotationIndex);
  final kept = newEnabled.indexOf(upcoming);
  if (kept >= 0) return kept;

  final oldSlot = rotationIndex % oldEnabled.length;
  for (var step = 1; step < oldEnabled.length; step++) {
    final candidate = oldEnabled[(oldSlot + step) % oldEnabled.length];
    final idx = newEnabled.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return rotationIndex % newEnabled.length;
}
