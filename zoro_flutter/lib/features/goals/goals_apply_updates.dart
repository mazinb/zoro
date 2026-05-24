import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';

/// Applies structured invest split and [goalUpdates] from Goals helper (§2) or LLM synth.
void applyGoalsGuideStructured(AppModel model, Map<String, Object?> structured, {String? focusGoalId}) {
  final invest = structured['allocInvestmentsMonthly'];
  final savings = structured['allocSavingsMonthly'];
  if (invest is num && savings is num) {
    model.setAllocationMonthlyExact(
      investMonthly: invest.toDouble(),
      savingsMonthly: savings.toDouble(),
    );
  } else {
    final frac = structured['allocInvestFraction'];
    if (frac is num) {
      model.setAllocInvestFraction(frac.toDouble().clamp(0.0, 1.0), quantize: false);
    }
  }

  final updatesRaw = structured['goalUpdates'];
  if (updatesRaw == null) return;

  final updates = <Map<String, Object?>>[];
  if (updatesRaw is List) {
    for (final e in updatesRaw) {
      if (e is Map) updates.add(Map<String, Object?>.from(e));
    }
  } else if (updatesRaw is Map) {
    updates.add(Map<String, Object?>.from(updatesRaw));
  }

  if (updates.isEmpty && focusGoalId != null) {
    final single = <String, Object?>{'goalId': focusGoalId};
    for (final k in [
      'name',
      'targetAmount',
      'targetDate',
      'corpusSurplus',
      'corpusAdjustment',
      'safeWithdrawalRatePct',
      'corpusBufferPct',
      'corpusAutoFromExpenses',
    ]) {
      if (structured.containsKey(k)) single[k] = structured[k];
    }
    if (single.length > 1) updates.add(single);
  }

  for (final u in updates) {
    final id = u['goalId']?.toString();
    if (id == null || id.isEmpty) continue;
    final existing = model.financialGoalById(id);
    if (existing == null) continue;

    var next = existing;
    final name = u['name']?.toString();
    if (name != null && name.trim().isNotEmpty) {
      next = next.copyWith(name: name.trim());
    }

    final target = u['targetAmount'];
    if (target is num) {
      next = next.copyWith(targetAmount: target.toDouble());
    }

    final td = u['targetDate'];
    if (td == null) {
      // omit
    } else if (td is String && td.trim().isEmpty) {
      next = next.copyWith(clearTargetDate: true);
    } else {
      final parsed = DateTime.tryParse(td.toString());
      if (parsed != null) next = next.copyWith(targetDate: parsed);
    }

    if (existing.isRetirement) {
      final cs = u['corpusSurplus'] ?? u['corpusAdjustment'];
      if (cs is num) next = next.copyWith(corpusSurplus: cs.toDouble());
      final swr = u['safeWithdrawalRatePct'];
      if (swr is num) next = next.copyWith(safeWithdrawalRatePct: clampWithdrawalRatePct(swr.toDouble()));
      final buf = u['corpusBufferPct'];
      if (buf is num) next = next.copyWith(corpusBufferPct: clampCorpusBufferPct(buf.toDouble()));
      if (u['corpusAutoFromExpenses'] is bool) {
        next = next.copyWith(corpusAutoFromExpenses: u['corpusAutoFromExpenses'] as bool);
      }
    }

    model.upsertFinancialGoal(next);
  }
  model.syncRetirementCorpusTarget(notify: false);
}

void applyRetirementCorpusStructured(
  AppModel model,
  Map<String, Object?> structured, {
  String contextMarkdown = '',
}) {
  final r = model.retirementGoal;
  if (r == null) return;
  var next = r;
  final swr = structured['safeWithdrawalRatePct'];
  if (swr is num) next = next.copyWith(safeWithdrawalRatePct: clampWithdrawalRatePct(swr.toDouble()));
  final buf = structured['corpusBufferPct'];
  if (buf is num) next = next.copyWith(corpusBufferPct: clampCorpusBufferPct(buf.toDouble()));
  if (structured['corpusAutoFromExpenses'] is bool) {
    next = next.copyWith(corpusAutoFromExpenses: structured['corpusAutoFromExpenses'] as bool);
  }
  final target = structured['targetAmount'];
  if (target is num) next = next.copyWith(targetAmount: target.toDouble());
  final surplus = structured['corpusSurplus'];
  if (surplus is num) {
    next = next.copyWith(corpusSurplus: surplus.toDouble().clamp(0, double.infinity));
  } else if (buf is num) {
    final base = model.goalRetirementCorpusBaseAmount(next);
    next = next.copyWith(
      corpusSurplus: surplusFromCorpusBufferPct(base, next.corpusBufferPct),
    );
  }
  final md = contextMarkdown.trim();
  if (md.isNotEmpty) next = next.copyWith(contextMarkdown: md);
  model.upsertFinancialGoal(next);
  model.syncRetirementCorpusTarget();
}

void applyGoalExpenseEstimatorStructured(
  AppModel model, {
  required Map<String, Object?> structured,
  required String goalId,
  String contextMarkdown = '',
}) {
  final bucketsRaw = structured['expenseBuckets'];
  if (bucketsRaw is Map) {
    for (final e in bucketsRaw.entries) {
      final key = e.key.toString();
      final v = e.value;
      if (v is num) model.setExpenseBucket(key, v.toDouble());
    }
    model.markExpenseEstimatesUpdated();
  }
  model.syncRetirementCorpusTarget(notify: false);
  final md = contextMarkdown.trim();
  if (md.isNotEmpty) {
    final g = model.financialGoalById(goalId);
    if (g != null) model.upsertFinancialGoal(g.copyWith(contextMarkdown: md));
  }
}
