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
        equitySeries: equity,
        debtSeries: debt,
        equityPct: 60,
      );

      expect(result.years.length, 2);
      expect(result.years.first.year, 2000);
      expect(result.years.first.blendedReturnPct, closeTo(8, 0.01)); // 0.6*10 + 0.4*5
      expect(result.years.first.corpusEnd, greaterThan(0));
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
        equitySeries: oneYear,
        debtSeries: oneYear,
        equityPct: 50,
      );
      expect(result.survived, isFalse);
      expect(result.firstDepletionYear, 2008);
      expect(result.years.single.depleted, isTrue);
    });
  });

  group('defaultHistoricalReturnSeries', () {
    test('includes 30 years of US equity and bond data', () {
      final series = defaultHistoricalReturnSeries();
      expect(series.length, 2);
      final sp = series.firstWhere((s) => s.id == kDefaultUsSp500SeriesId);
      final bond = series.firstWhere((s) => s.id == kDefaultUsAggBondSeriesId);
      expect(sp.years.length, 30);
      expect(bond.years.length, 30);
      expect(sp.years.first, 1995);
      expect(sp.years.last, 2024);
    });
  });
}
