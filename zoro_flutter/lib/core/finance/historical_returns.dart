/// Annual total-return series for corpus backtesting (import/export friendly).
enum HistoricalAssetClass {
  equity,
  debt,
  other;

  String get label => switch (this) {
        HistoricalAssetClass.equity => 'Equity',
        HistoricalAssetClass.debt => 'Debt',
        HistoricalAssetClass.other => 'Other',
      };

  static HistoricalAssetClass fromApi(String? raw) => switch (raw?.trim().toLowerCase()) {
        'equity' => HistoricalAssetClass.equity,
        'debt' => HistoricalAssetClass.debt,
        _ => HistoricalAssetClass.other,
      };

  String get apiValue => name;
}

class HistoricalReturnYear {
  const HistoricalReturnYear({required this.year, required this.returnPct});

  final int year;

  /// Calendar-year total return (%).
  final double returnPct;
}

class HistoricalReturnSeries {
  const HistoricalReturnSeries({
    required this.id,
    required this.name,
    required this.assetClass,
    required this.region,
    required this.returnsByYear,
    this.builtin = false,
    this.notes,
  });

  final String id;
  final String name;
  final HistoricalAssetClass assetClass;
  final String region;
  final List<HistoricalReturnYear> returnsByYear;
  final bool builtin;
  final String? notes;

  List<int> get years => returnsByYear.map((e) => e.year).toList()..sort();

  double? returnPctFor(int year) {
    for (final r in returnsByYear) {
      if (r.year == year) return r.returnPct;
    }
    return null;
  }

  HistoricalReturnSeries copyWith({
    String? id,
    String? name,
    HistoricalAssetClass? assetClass,
    String? region,
    List<HistoricalReturnYear>? returnsByYear,
    bool? builtin,
    String? notes,
  }) =>
      HistoricalReturnSeries(
        id: id ?? this.id,
        name: name ?? this.name,
        assetClass: assetClass ?? this.assetClass,
        region: region ?? this.region,
        returnsByYear: returnsByYear ?? this.returnsByYear,
        builtin: builtin ?? this.builtin,
        notes: notes ?? this.notes,
      );
}

const kDefaultUsSp500SeriesId = 'us-sp500-total-return';
const kDefaultUsAggBondSeriesId = 'us-agg-bond-total-return';

List<HistoricalReturnYear> _years(Map<int, double> data) =>
    data.entries.map((e) => HistoricalReturnYear(year: e.key, returnPct: e.value)).toList()
      ..sort((a, b) => a.year.compareTo(b.year));

/// Built-in US indices — calendar-year total returns, 1995–2024.
List<HistoricalReturnSeries> defaultHistoricalReturnSeries() => [
      HistoricalReturnSeries(
        id: kDefaultUsSp500SeriesId,
        name: 'S&P 500 (US)',
        assetClass: HistoricalAssetClass.equity,
        region: 'US',
        builtin: true,
        notes: 'S&P 500 total return index, calendar years.',
        returnsByYear: _years(const {
          1995: 37.58,
          1996: 22.96,
          1997: 33.10,
          1998: 28.58,
          1999: 21.04,
          2000: -9.10,
          2001: -11.89,
          2002: -22.10,
          2003: 28.68,
          2004: 10.88,
          2005: 4.91,
          2006: 15.79,
          2007: 5.49,
          2008: -37.00,
          2009: 26.46,
          2010: 15.06,
          2011: 2.11,
          2012: 16.00,
          2013: 32.39,
          2014: 13.69,
          2015: 1.38,
          2016: 11.96,
          2017: 21.83,
          2018: -4.38,
          2019: 31.49,
          2020: 18.40,
          2021: 28.71,
          2022: -18.11,
          2023: 26.29,
          2024: 24.23,
        }),
      ),
      HistoricalReturnSeries(
        id: kDefaultUsAggBondSeriesId,
        name: 'US Aggregate Bond',
        assetClass: HistoricalAssetClass.debt,
        region: 'US',
        builtin: true,
        notes: 'Bloomberg US Aggregate Bond Index total return, calendar years.',
        returnsByYear: _years(const {
          1995: 18.46,
          1996: 3.93,
          1997: 9.69,
          1998: 8.73,
          1999: -0.82,
          2000: 11.63,
          2001: 8.43,
          2002: 10.26,
          2003: 4.10,
          2004: 4.34,
          2005: 2.43,
          2006: 4.33,
          2007: 7.03,
          2008: 5.24,
          2009: 5.93,
          2010: 6.54,
          2011: 7.84,
          2012: 4.21,
          2013: -2.02,
          2014: 6.04,
          2015: 0.55,
          2016: 2.65,
          2017: 3.54,
          2018: 0.01,
          2019: 8.72,
          2020: 7.51,
          2021: -1.54,
          2022: -13.01,
          2023: 5.53,
          2024: 1.25,
        }),
      ),
    ];

HistoricalReturnSeries? historicalReturnSeriesById(
  Iterable<HistoricalReturnSeries> series,
  String id,
) {
  for (final s in series) {
    if (s.id == id) return s;
  }
  return null;
}

List<HistoricalReturnSeries> historicalReturnSeriesForClass(
  Iterable<HistoricalReturnSeries> series,
  HistoricalAssetClass assetClass,
) =>
    series.where((s) => s.assetClass == assetClass).toList()
      ..sort((a, b) => a.name.compareTo(b.name));

/// Merge imported series by id; built-ins are refreshed from defaults, not overwritten.
List<HistoricalReturnSeries> mergeHistoricalReturnSeries({
  required Iterable<HistoricalReturnSeries> stored,
  required Iterable<HistoricalReturnSeries> incoming,
}) {
  final builtins = {for (final s in defaultHistoricalReturnSeries()) s.id: s};
  final byId = <String, HistoricalReturnSeries>{...builtins};
  for (final s in stored) {
    if (builtins.containsKey(s.id)) continue;
    byId[s.id] = s;
  }
  for (final s in incoming) {
    if (builtins.containsKey(s.id)) continue;
    byId[s.id] = s;
  }
  return byId.values.toList()..sort((a, b) => a.name.compareTo(b.name));
}

Map<String, dynamic> encodeHistoricalReturnSeries(HistoricalReturnSeries s) => {
      'id': s.id,
      'name': s.name,
      'assetClass': s.assetClass.apiValue,
      'region': s.region,
      if (s.builtin) 'builtin': true,
      if (s.notes != null && s.notes!.trim().isNotEmpty) 'notes': s.notes,
      'returnsByYear': [
        for (final y in s.returnsByYear) {'year': y.year, 'returnPct': y.returnPct},
      ],
    };

HistoricalReturnSeries? decodeHistoricalReturnSeries(Object? raw) {
  if (raw is! Map) return null;
  final m = Map<String, dynamic>.from(raw);
  final id = m['id']?.toString().trim();
  if (id == null || id.isEmpty) return null;
  final name = m['name']?.toString().trim();
  if (name == null || name.isEmpty) return null;
  final region = m['region']?.toString().trim();
  if (region == null || region.isEmpty) return null;
  final yearsRaw = m['returnsByYear'];
  if (yearsRaw is! List || yearsRaw.isEmpty) return null;
  final years = <HistoricalReturnYear>[];
  for (final row in yearsRaw) {
    if (row is! Map) continue;
    final rm = Map<String, dynamic>.from(row);
    final year = rm['year'];
    final ret = rm['returnPct'] ?? rm['return'];
    if (year is! num || ret is! num) continue;
    years.add(HistoricalReturnYear(year: year.round(), returnPct: ret.toDouble()));
  }
  if (years.isEmpty) return null;
  years.sort((a, b) => a.year.compareTo(b.year));
  return HistoricalReturnSeries(
    id: id,
    name: name,
    assetClass: HistoricalAssetClass.fromApi(m['assetClass']?.toString()),
    region: region,
    returnsByYear: years,
    builtin: m['builtin'] == true,
    notes: m['notes']?.toString(),
  );
}

Map<String, dynamic> encodeCorpusBacktestPrefs({
  required double equityPct,
  required String equitySeriesId,
  required String debtSeriesId,
}) =>
    {
      'equityPct': equityPct,
      'equitySeriesId': equitySeriesId,
      'debtSeriesId': debtSeriesId,
    };

void decodeCorpusBacktestPrefs(
  Map<String, dynamic>? raw, {
  required void Function(double equityPct) onEquityPct,
  required void Function(String equitySeriesId) onEquitySeriesId,
  required void Function(String debtSeriesId) onDebtSeriesId,
}) {
  if (raw == null) return;
  final eq = raw['equityPct'];
  if (eq is num) onEquityPct(eq.toDouble().clamp(0, 100));
  final es = raw['equitySeriesId']?.toString();
  if (es != null && es.isNotEmpty) onEquitySeriesId(es);
  final ds = raw['debtSeriesId']?.toString();
  if (ds != null && ds.isNotEmpty) onDebtSeriesId(ds);
}
