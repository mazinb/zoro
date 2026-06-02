import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/finance/corpus_backtest.dart';
import 'package:zoro_flutter/core/finance/historical_returns.dart';

void main() {
  group('runCorpusBacktest', () {
    test('simulates drawdown with blended returns over overlapping years', () {
      final equity = HistoricalReturnSeries(
        id: 'eq',
        name: 'Test equity',
        assetClass: HistoricalAssetClass.equity,
        region: 'US',
        returnsByYear: const [
          HistoricalReturnYear(year: 2000, returnPct: 10),
          HistoricalReturnYear(year: 2001, returnPct: -20),
        ],
      );
      final debt = HistoricalReturnSeries(
        id: 'debt',
        name: 'Test debt',
        assetClass: HistoricalAssetClass.debt,
        region: 'US',
        returnsByYear: const [
          HistoricalReturnYear(year: 2000, returnPct: 5),
          HistoricalReturnYear(year: 2001, returnPct: 5),
        ],
      );

      final result = runCorpusBacktest(
        initialCorpus: 1_000_000,
        monthlyExpense: 5000,
        inflationPctAnnual: 3,
        equitySeries: equity,
        debtSeries: debt,
        equityPct: 60,
      );

      expect(result.years.length, 2);
      expect(result.years.first.year, 2000);
      expect(result.years.first.blendedReturnPct, closeTo(8, 0.01)); // 0.6*10 + 0.4*5
      expect(result.years.first.corpusEnd, greaterThan(0));
      expect(result.years[1].expenseAnnual, greaterThan(result.years[0].expenseAnnual));
    });

    test('flags depletion when annual expense exceeds corpus', () {
      final oneYear = HistoricalReturnSeries(
        id: 'eq',
        name: 'Flat',
        assetClass: HistoricalAssetClass.equity,
        region: 'US',
        returnsByYear: const [HistoricalReturnYear(year: 2008, returnPct: 0)],
      );
      final result = runCorpusBacktest(
        initialCorpus: 10_000,
        monthlyExpense: 2000,
        inflationPctAnnual: 0,
        equitySeries: oneYear,
        debtSeries: oneYear,
        equityPct: 50,
      );
      expect(result.survived, isFalse);
      expect(result.firstDepletionYear, 2008);
      expect(result.years.single.depleted, isTrue);
    });

    test('startYear begins the simulation later', () {
      final equity = HistoricalReturnSeries(
        id: 'eq',
        name: 'Eq',
        assetClass: HistoricalAssetClass.equity,
        region: 'US',
        returnsByYear: const [
          HistoricalReturnYear(year: 2000, returnPct: 0),
          HistoricalReturnYear(year: 2001, returnPct: 0),
          HistoricalReturnYear(year: 2002, returnPct: 0),
        ],
      );
      final debt = HistoricalReturnSeries(
        id: 'debt',
        name: 'Debt',
        assetClass: HistoricalAssetClass.debt,
        region: 'US',
        returnsByYear: const [
          HistoricalReturnYear(year: 2000, returnPct: 0),
          HistoricalReturnYear(year: 2001, returnPct: 0),
          HistoricalReturnYear(year: 2002, returnPct: 0),
        ],
      );
      final result = runCorpusBacktest(
        initialCorpus: 1_000_000,
        monthlyExpense: 1000,
        inflationPctAnnual: 0,
        equitySeries: equity,
        debtSeries: debt,
        equityPct: 50,
        startYear: 2001,
      );
      expect(result.years.first.year, 2001);
    });
  });

  group('defaultHistoricalReturnSeries', () {
    test('includes equity, FD, and optional bond builtins', () {
      final series = defaultHistoricalReturnSeries();
      expect(series.length, greaterThanOrEqualTo(4));
      final sp = series.firstWhere((s) => s.id == kDefaultUsSp500SeriesId);
      final fd = series.firstWhere((s) => s.id == kDefaultCashFdSeriesId);
      final bond = series.firstWhere((s) => s.id == kDefaultUsAggBondSeriesId);
      expect(sp.years.length, 30);
      expect(fd.years.length, 30);
      expect(bond.years.length, 30);
      expect(sp.years.first, 1995);
      expect(sp.years.last, 2024);
      expect(fd.returnPctFor(2022), greaterThan(0));
      expect(bond.returnPctFor(2022)!, lessThan(0));
    });

    test('decode migrates legacy bond default to FD series', () {
      var debtId = kDefaultUsAggBondSeriesId;
      decodeCorpusBacktestPrefs(
        {'debtSeriesId': kDefaultUsAggBondSeriesId},
        onEquityPct: (_) {},
        onEquitySeriesId: (_) {},
        onDebtSeriesId: (v) => debtId = v,
      );
      expect(debtId, kDefaultCashFdSeriesId);
    });
  });
}
