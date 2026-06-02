/// Annual total-return series for corpus backtesting (import/export friendly).
enum HistoricalAssetClass {
  equity,
  debt,
  other;

  String get label => switch (this) {
        HistoricalAssetClass.equity => 'Equity',
        HistoricalAssetClass.debt => 'Cash / FD',
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

/// Default non-equity leg for corpus backtest (1-year FD / CD coupon, not bond total return).
const kDefaultCashFdSeriesId = 'us-fd-1y-cd';

/// Legacy default; migrated to [kDefaultCashFdSeriesId] on load.
const kDefaultUsAggBondSeriesId = 'us-agg-bond-total-return';

const kUaeFdPolicyProxySeriesId = 'uae-fd-policy-proxy';
const kIndiaFd1yTypicalSeriesId = 'in-fd-1y-typical';

List<HistoricalReturnYear> _years(Map<int, double> data) =>
    data.entries.map((e) => HistoricalReturnYear(year: e.key, returnPct: e.value)).toList()
      ..sort((a, b) => a.year.compareTo(b.year));

/// Built-in historical series for corpus backtest (calendar years 1995–2024).
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
        id: kDefaultCashFdSeriesId,
        name: 'US 1Y CD / FD',
        assetClass: HistoricalAssetClass.debt,
        region: 'US',
        builtin: true,
        notes:
            'Approx. calendar-year return from national avg 1-year CD APY (Bankrate / FRED BRMCDS0101 style), not bond price moves.',
        returnsByYear: _years(const {
          1995: 5.57,
          1996: 5.30,
          1997: 5.46,
          1998: 5.20,
          1999: 5.00,
          2000: 6.40,
          2001: 3.50,
          2002: 1.80,
          2003: 1.20,
          2004: 2.30,
          2005: 3.90,
          2006: 5.00,
          2007: 5.30,
          2008: 3.20,
          2009: 1.50,
          2010: 0.91,
          2011: 0.52,
          2012: 0.33,
          2013: 0.23,
          2014: 0.20,
          2015: 0.20,
          2016: 0.21,
          2017: 0.22,
          2018: 0.29,
          2019: 0.61,
          2020: 0.48,
          2021: 0.15,
          2022: 1.75,
          2023: 4.75,
          2024: 4.50,
        }),
      ),
      HistoricalReturnSeries(
        id: kUaeFdPolicyProxySeriesId,
        name: 'UAE FD (policy proxy)',
        assetClass: HistoricalAssetClass.debt,
        region: 'UAE',
        builtin: true,
        notes:
            'UAE central-bank policy / deposit-rate proxy for typical AED/USD FD coupons (2007+); earlier years from deposit-rate benchmarks.',
        returnsByYear: _years(const {
          1995: 7.00,
          1996: 6.80,
          1997: 6.50,
          1998: 6.20,
          1999: 6.00,
          2000: 6.20,
          2001: 3.60,
          2002: 3.50,
          2003: 3.20,
          2004: 3.00,
          2005: 3.50,
          2006: 4.00,
          2007: 4.75,
          2008: 4.25,
          2009: 1.25,
          2010: 0.75,
          2011: 1.00,
          2012: 1.00,
          2013: 1.00,
          2014: 1.00,
          2015: 1.00,
          2016: 1.75,
          2017: 2.00,
          2018: 2.75,
          2019: 2.50,
          2020: 0.50,
          2021: 0.15,
          2022: 2.50,
          2023: 5.00,
          2024: 4.75,
        }),
      ),
      HistoricalReturnSeries(
        id: kIndiaFd1yTypicalSeriesId,
        name: 'India 1Y FD (typical)',
        assetClass: HistoricalAssetClass.debt,
        region: 'IN',
        builtin: true,
        notes:
            'Representative 1-year bank / post-office FD rates by calendar year (India), not bond index returns.',
        returnsByYear: _years(const {
          1995: 12.00,
          1996: 11.00,
          1997: 10.50,
          1998: 10.00,
          1999: 9.50,
          2000: 10.50,
          2001: 9.00,
          2002: 7.50,
          2003: 6.50,
          2004: 6.00,
          2005: 6.50,
          2006: 8.00,
          2007: 9.00,
          2008: 9.00,
          2009: 8.00,
          2010: 8.00,
          2011: 9.00,
          2012: 8.50,
          2013: 8.00,
          2014: 8.50,
          2015: 7.50,
          2016: 7.00,
          2017: 6.50,
          2018: 7.00,
          2019: 6.50,
          2020: 5.50,
          2021: 5.50,
          2022: 5.80,
          2023: 7.00,
          2024: 7.20,
        }),
      ),
      HistoricalReturnSeries(
        id: kDefaultUsAggBondSeriesId,
        name: 'US Aggregate Bond (legacy)',
        assetClass: HistoricalAssetClass.debt,
        region: 'US',
        builtin: true,
        notes: 'Bloomberg US Aggregate Bond Index total return — optional; FD series is usually a better cash leg.',
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
  int? startYear,
}) =>
    {
      'equityPct': equityPct,
      'equitySeriesId': equitySeriesId,
      'debtSeriesId': debtSeriesId,
      'startYear': startYear,
    };

void decodeCorpusBacktestPrefs(
  Map<String, dynamic>? raw, {
  required void Function(double equityPct) onEquityPct,
  required void Function(String equitySeriesId) onEquitySeriesId,
  required void Function(String debtSeriesId) onDebtSeriesId,
  void Function(int startYear)? onStartYear,
}) {
  if (raw == null) return;
  final eq = raw['equityPct'];
  if (eq is num) onEquityPct(eq.toDouble().clamp(0, 100));
  final es = raw['equitySeriesId']?.toString();
  if (es != null && es.isNotEmpty) onEquitySeriesId(es);
  final ds = raw['debtSeriesId']?.toString();
  if (ds != null && ds.isNotEmpty) {
    onDebtSeriesId(ds == kDefaultUsAggBondSeriesId ? kDefaultCashFdSeriesId : ds);
  }
  final sy = raw['startYear'];
  if (onStartYear != null && sy is num) onStartYear(sy.round());
}
