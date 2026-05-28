import 'historical_returns.dart';

class CorpusBacktestYearRow {
  const CorpusBacktestYearRow({
    required this.year,
    required this.expenseAnnual,
    required this.corpusStart,
    required this.blendedReturnPct,
    required this.corpusEnd,
    required this.monthlyExpense,
    required this.depleted,
  });

  final int year;
  final double expenseAnnual;
  final double corpusStart;
  final double blendedReturnPct;
  final double corpusEnd;
  final double monthlyExpense;
  final bool depleted;
}

class CorpusBacktestResult {
  const CorpusBacktestResult({
    required this.initialCorpus,
    required this.years,
    required this.survived,
    required this.firstDepletionYear,
    required this.equityPct,
    required this.equitySeriesName,
    required this.debtSeriesName,
    required this.startYear,
    required this.inflationPctAnnual,
  });

  final double initialCorpus;
  final List<CorpusBacktestYearRow> years;
  final bool survived;
  final int? firstDepletionYear;
  final double equityPct;
  final String equitySeriesName;
  final String debtSeriesName;
  final int startYear;
  final double inflationPctAnnual;
}

/// Simulate annual drawdown: withdraw inflation-adjusted expenses at year start,
/// then apply blended return. Expenses grow by [inflationPctAnnual] each year.
List<CorpusBacktestYearRow> simulateCorpusBacktest({
  required double initialCorpus,
  required double annualExpenseInitial,
  required double inflationPctAnnual,
  required HistoricalReturnSeries equitySeries,
  required HistoricalReturnSeries debtSeries,
  required double equityPct,
  int? startYear,
}) {
  final eqW = equityPct.clamp(0, 100) / 100;
  final debtW = 1 - eqW;
  final overlap = equitySeries.years.toSet().intersection(debtSeries.years.toSet()).toList()..sort();
  final years = startYear == null ? overlap : overlap.where((y) => y >= startYear).toList();
  var corpus = initialCorpus;
  final rows = <CorpusBacktestYearRow>[];
  final inf = (inflationPctAnnual / 100).clamp(-0.5, 2.0);
  var annualExpense = annualExpenseInitial;

  for (final year in years) {
    final eqRet = equitySeries.returnPctFor(year);
    final debtRet = debtSeries.returnPctFor(year);
    if (eqRet == null || debtRet == null) continue;
    final blended = eqW * eqRet + debtW * debtRet;
    final corpusStart = corpus;
    final depleted = corpusStart + 0.5 < annualExpense;
    final afterWithdrawal = (corpusStart - annualExpense).clamp(0, double.infinity);
    final corpusEnd = depleted ? 0.0 : afterWithdrawal * (1 + blended / 100);
    rows.add(
      CorpusBacktestYearRow(
        year: year,
        expenseAnnual: annualExpense,
        corpusStart: corpusStart,
        blendedReturnPct: blended,
        corpusEnd: corpusEnd,
        monthlyExpense: annualExpense / 12,
        depleted: depleted,
      ),
    );
    corpus = corpusEnd;
    if (depleted) break;
    annualExpense = (annualExpense * (1 + inf)).clamp(0, double.infinity);
  }

  return rows;
}

CorpusBacktestResult runCorpusBacktest({
  required double initialCorpus,
  required double monthlyExpense,
  required double inflationPctAnnual,
  required HistoricalReturnSeries equitySeries,
  required HistoricalReturnSeries debtSeries,
  required double equityPct,
  int? startYear,
}) {
  final annual = monthlyExpense * 12;
  final rows = simulateCorpusBacktest(
    initialCorpus: initialCorpus,
    annualExpenseInitial: annual,
    inflationPctAnnual: inflationPctAnnual,
    equitySeries: equitySeries,
    debtSeries: debtSeries,
    equityPct: equityPct,
    startYear: startYear,
  );
  final firstDepletion = rows.where((r) => r.depleted).map((r) => r.year).cast<int?>().firstOrNull;
  final survived = rows.isNotEmpty && firstDepletion == null;
  return CorpusBacktestResult(
    initialCorpus: initialCorpus,
    years: rows,
    survived: survived,
    firstDepletionYear: firstDepletion,
    equityPct: equityPct.clamp(0, 100),
    equitySeriesName: equitySeries.name,
    debtSeriesName: debtSeries.name,
    startYear: rows.isEmpty ? (startYear ?? 0) : rows.first.year,
    inflationPctAnnual: inflationPctAnnual,
  );
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
