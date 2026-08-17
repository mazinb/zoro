import '../state/financial_goals.dart';
import 'hermes_home_paths.dart';
import 'retirement_plan_codec.dart';

/// Builds the first `retirement.md` from the in-memory retirement goal.
String seedRetirementMarkdown({
  required FinancialGoal goal,
  required double investMonthly,
}) {
  final doc = RetirementPlanDoc(
    rev: 1,
    retireBy: goal.targetDate,
    swrPct: goal.safeWithdrawalRatePct,
    investMonthly: investMonthly,
    body: _body(goal),
  );
  return doc.encode();
}

String _body(FinancialGoal goal) {
  final existing = goal.contextMarkdown.trim();
  final name = goal.name.trim().isEmpty ? 'Retirement' : goal.name.trim();
  final buf = StringBuffer();
  buf.writeln('# $name');
  buf.writeln();
  if (existing.isNotEmpty) {
    buf.writeln(existing);
    buf.writeln();
  } else {
    buf.writeln(
      'Living plan. Edit this file instead of overwriting a JSON field.',
    );
    buf.writeln();
  }
  buf.writeln('## Numbers');
  buf.writeln();
  buf.writeln('- Corpus target: ${goal.targetAmount.round()}');
  buf.writeln('- Surplus: ${goal.corpusSurplus.round()}');
  buf.writeln('- Buffer %: ${goal.corpusBufferPct}');
  buf.writeln('- Auto corpus from expenses: ${goal.corpusAutoFromExpenses}');
  buf.writeln();
  return buf.toString();
}

void applyDocToGoal(FinancialGoal goal, RetirementPlanDoc doc) {
  if (doc.retireBy != null) goal.targetDate = doc.retireBy;
  if (doc.swrPct != null) goal.safeWithdrawalRatePct = doc.swrPct!;
}

bool looksLikeRetirementDoc(String id) => id == HermesHomePaths.retirementDocId;
