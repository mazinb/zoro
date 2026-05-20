import 'package:flutter/material.dart';

import '../../core/finance/goal_asset_buckets.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/guided_mcq/structured_guide_page.dart';
import 'goal_widgets.dart';
import 'goals_apply_updates.dart';
import 'goals_structured_llm.dart';

String? goalsSectionLastUpdatedLabel(DateTime? at, {DateTime? now}) {
  if (at == null) return null;
  return formatAgentLastRunRelative(at, now: now);
}

List<StructuredGuideStep> corpusGuideSteps(AppModel model) {
  final r = model.retirementGoal;
  final swr = r?.safeWithdrawalRatePct.round() ?? 4;
  final buf = r?.corpusBufferPct.round() ?? 0;
  final auto = r?.corpusAutoFromExpenses ?? true;
  return [
    StructuredGuideStep(
      id: 'swr',
      prompt: 'Safe withdrawal rate (annual % of corpus)',
      hint: 'Currently $swr%. Lower rate → larger corpus.',
      choices: const [
        StructuredGuideChoice(id: 'swr_3', label: '3% — conservative'),
        StructuredGuideChoice(id: 'swr_35', label: '3.5%'),
        StructuredGuideChoice(id: 'swr_4', label: '4% — classic rule'),
        StructuredGuideChoice(id: 'swr_45', label: '4.5%'),
        StructuredGuideChoice(id: 'swr_5', label: '5% — aggressive'),
      ],
    ),
    StructuredGuideStep(
      id: 'buffer',
      prompt: 'Safety buffer on top of base corpus',
      hint: 'Currently $buf% buffer.',
      choices: const [
        StructuredGuideChoice(id: 'buf_0', label: '0% — expenses only'),
        StructuredGuideChoice(id: 'buf_10', label: '10%'),
        StructuredGuideChoice(id: 'buf_15', label: '15%'),
        StructuredGuideChoice(id: 'buf_20', label: '20%'),
        StructuredGuideChoice(id: 'buf_25', label: '25% — extra cushion'),
      ],
    ),
    StructuredGuideStep(
      id: 'auto_expenses',
      prompt: 'Corpus from recurring expenses?',
      choices: [
        StructuredGuideChoice(
          id: 'auto_yes',
          label: auto ? 'Yes — keep linked to ledger expenses' : 'Yes — link to ledger expenses',
        ),
        const StructuredGuideChoice(id: 'auto_no', label: 'No — I will set a fixed corpus amount'),
        if (model.recurringExpensesMonthly <= 0)
          const StructuredGuideChoice(
            id: 'auto_setup',
            label: 'Expenses missing — set up in Ledger first',
          ),
      ],
    ),
  ];
}

Map<String, Object?> corpusStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  const swrMap = {
    'swr_3': 3.0,
    'swr_35': 3.5,
    'swr_4': 4.0,
    'swr_45': 4.5,
    'swr_5': 5.0,
  };
  const bufMap = {
    'buf_0': 0.0,
    'buf_10': 10.0,
    'buf_15': 15.0,
    'buf_20': 20.0,
    'buf_25': 25.0,
  };
  final swr = swrMap[result.singleFor('swr')] ?? model.retirementGoal?.safeWithdrawalRatePct ?? 4;
  final buf = bufMap[result.singleFor('buffer')] ?? model.retirementGoal?.corpusBufferPct ?? 0;
  final autoId = result.singleFor('auto_expenses');
  final auto = switch (autoId) {
    'auto_yes' => true,
    'auto_no' => false,
    'auto_setup' => model.recurringExpensesMonthly > 0,
    _ => model.retirementGoal?.corpusAutoFromExpenses ?? true,
  };
  final corpus = computeRetirementCorpus(
    recurringExpensesMonthly: model.recurringExpensesMonthly,
    safeWithdrawalRatePct: swr,
    corpusBufferPct: buf,
  );
  return {
    'safeWithdrawalRatePct': swr,
    'corpusBufferPct': buf,
    'corpusAutoFromExpenses': auto,
    'targetAmount': corpus,
    'summary': 'Corpus ${auto ? "from expenses" : "manual"} at ${swr.round()}% SWR, ${buf.round()}% buffer',
  };
}

Future<void> openCorpusStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Retirement corpus',
        steps: corpusGuideSteps(model),
        optionalNoteHint: 'e.g. healthcare, relocation, one-off costs…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  if (res.optionalNote.isNotEmpty) {
    final structured = await _runCorpusLlm(context, model, res);
    if (!context.mounted) return;
    if (structured == null) {
      _showLlmUnavailable(context, model);
      return;
    }
    await _showApplyReview(
      context: context,
      model: model,
      title: 'Review corpus',
      lines: _corpusReviewLines(model, structured),
      onApply: () {
        applyRetirementCorpusStructured(
          model,
          structured,
          contextMarkdown: structured['contextMarkdown']?.toString() ?? '',
        );
        model.markRetirementCorpusUpdated();
        model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementCorpus, structured);
      },
    );
    return;
  }

  final structured = corpusStructuredFromAnswers(model, res);
  applyRetirementCorpusStructured(model, structured);
  model.markRetirementCorpusUpdated();
  model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementCorpus, structured);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Retirement corpus updated'), behavior: SnackBarBehavior.floating),
  );
}

Future<Map<String, Object?>?> _runCorpusLlm(
  BuildContext context,
  AppModel model,
  StructuredGuideResult res,
) async {
  final r = model.retirementGoal;
  if (r == null) return null;
  return synthesizeGoalsSectionWithLlm(
    model: model,
    agentId: InternalAppAgentIds.goalsRetirementCorpus,
    optionalNote: res.optionalNote,
    answers: res.answers,
    payload: {
      'recurringExpensesMonthly': model.recurringExpensesMonthly,
      'safeWithdrawalRatePct': r.safeWithdrawalRatePct,
      'corpusBufferPct': r.corpusBufferPct,
      'corpusAutoFromExpenses': r.corpusAutoFromExpenses,
      'computedCorpus': model.goalEffectiveTargetAmount(r),
    },
  );
}

List<String> _corpusReviewLines(AppModel model, Map<String, Object?> s) {
  final lines = <String>[];
  final summary = s['summary']?.toString();
  if (summary != null && summary.isNotEmpty) lines.add(summary);
  final swr = s['safeWithdrawalRatePct'];
  if (swr is num) lines.add('Safe withdrawal: ${swr.round()}%');
  final buf = s['corpusBufferPct'];
  if (buf is num) lines.add('Buffer: ${buf.round()}%');
  final corpus = s['targetAmount'];
  if (corpus is num) lines.add('Target corpus: ${goalMoney(model, corpus.toDouble())}');
  return lines;
}

List<StructuredGuideStep> splitGuideSteps(AppModel model) {
  final r = model.retirementGoal;
  final feas = r == null ? null : model.retirementInvestFeasibility(r);
  final pct = (model.allocInvestFraction * 100).round();
  final required = r == null ? 0.0 : model.goalRequiredMonthlySavingsFor(r);
  final fmt = (double v) => goalMoney(model, v);

  return [
    StructuredGuideStep(
      id: 'invest_share',
      prompt: 'Monthly invest vs savings split',
      hint: feas == null
          ? 'Currently $pct% to investments.'
          : '${feas.title}: ${feas.detail.isEmpty ? "currently $pct% invest" : feas.detail}',
      choices: [
        StructuredGuideChoice(id: 'inv_keep', label: 'Keep $pct% to investments'),
        StructuredGuideChoice(id: 'inv_50', label: '50% invest / 50% savings'),
        StructuredGuideChoice(id: 'inv_60', label: '60% invest (balanced)'),
        StructuredGuideChoice(id: 'inv_70', label: '70% invest — push retirement'),
        StructuredGuideChoice(id: 'inv_80', label: '80% invest — max retirement'),
        StructuredGuideChoice(id: 'inv_40', label: '40% invest — more to savings & loans'),
        StructuredGuideChoice(id: 'inv_30', label: '30% invest — savings first'),
      ],
    ),
    StructuredGuideStep(
      id: 'retire_date',
      prompt: 'Retirement date if the plan is still tight',
      hint: required > 0.5
          ? 'Need about ${fmt(required)}/mo toward retirement corpus.'
          : 'Adjust only if you want more time.',
      choices: const [
        StructuredGuideChoice(id: 'date_keep', label: 'Keep current retire-by date'),
        StructuredGuideChoice(id: 'date_plus_2', label: 'Extend 2 years'),
        StructuredGuideChoice(id: 'date_plus_5', label: 'Extend 5 years'),
        StructuredGuideChoice(id: 'date_plus_10', label: 'Extend 10 years'),
      ],
    ),
  ];
}

Map<String, Object?> splitStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  const fracMap = {
    'inv_keep': null,
    'inv_30': 0.3,
    'inv_40': 0.4,
    'inv_50': 0.5,
    'inv_60': 0.6,
    'inv_70': 0.7,
    'inv_80': 0.8,
  };
  final invId = result.singleFor('invest_share');
  final frac = fracMap[invId];
  final r = model.retirementGoal;
  DateTime? newDate = r?.targetDate;
  final dateId = result.singleFor('retire_date');
  if (r?.targetDate != null && dateId != null && dateId != 'date_keep') {
    final base = r!.targetDate!;
    final addYears = switch (dateId) {
      'date_plus_2' => 2,
      'date_plus_5' => 5,
      'date_plus_10' => 10,
      _ => 0,
    };
    if (addYears > 0) {
      newDate = DateTime(base.year + addYears, base.month, base.day);
    }
  }
  final out = <String, Object?>{
    'summary': 'Invest/savings split and retirement date',
  };
  if (frac != null) out['allocInvestFraction'] = frac;
  if (r != null && newDate != null && newDate != r.targetDate) {
    out['goalUpdates'] = [
      {'goalId': r.id, 'targetDate': newDate.toIso8601String().split('T').first},
    ];
  }
  return out;
}

Future<void> openSplitStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Invest & retire date',
        steps: splitGuideSteps(model),
        optionalNoteHint: 'e.g. bonus income, sabbatical, part-time work…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  if (res.optionalNote.isNotEmpty) {
    final r = model.retirementGoal!;
    final structured = await synthesizeGoalsSectionWithLlm(
      model: model,
      agentId: InternalAppAgentIds.goalsRetirementSplit,
      optionalNote: res.optionalNote,
      answers: res.answers,
      payload: {
        'allocInvestFraction': model.allocInvestFraction,
        'allocInvestmentsMonthly': model.allocInvestmentsMonthly,
        'availableAfterExpensesMonthly': model.availableAfterExpensesMonthly,
        'focusGoalId': r.id,
        'targetDate': r.targetDate?.toIso8601String(),
        'requiredMonthly': model.goalRequiredMonthlySavingsFor(r),
      },
    );
    if (!context.mounted) return;
    if (structured == null) {
      _showLlmUnavailable(context, model);
      return;
    }
    await _showApplyReview(
      context: context,
      model: model,
      title: 'Review plan split',
      lines: _splitReviewLines(model, structured),
      onApply: () {
        applyGoalsGuideStructured(model, structured, focusGoalId: r.id);
        model.markRetirementSplitUpdated();
        model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementSplit, structured);
      },
    );
    return;
  }

  final structured = splitStructuredFromAnswers(model, res);
  applyGoalsGuideStructured(model, structured, focusGoalId: model.retirementGoal?.id);
  model.markRetirementSplitUpdated();
  model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementSplit, structured);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Invest split and date updated'), behavior: SnackBarBehavior.floating),
  );
}

List<String> _splitReviewLines(AppModel model, Map<String, Object?> s) {
  final lines = <String>[];
  final summary = s['summary']?.toString();
  if (summary != null && summary.isNotEmpty) lines.add(summary);
  final frac = s['allocInvestFraction'];
  if (frac is num) lines.add('Invest share: ${(frac.toDouble() * 100).round()}% of free cash flow');
  final updates = s['goalUpdates'];
  if (updates is List && updates.isNotEmpty) {
    final u = updates.first;
    if (u is Map) {
      final td = u['targetDate']?.toString();
      if (td != null) lines.add('Retire by: $td');
    }
  }
  return lines;
}

List<StructuredGuideStep> bucketsGuideSteps(AppModel model) {
  final policy = model.assetsGoalsPolicy;
  final propertyExtras = model.assets
      .where((a) => a.type == LedgerAssetType.property || a.type == LedgerAssetType.other)
      .toList();
  final savings = savingsPoolAssets(model.assets, policy).toList();

  final steps = <StructuredGuideStep>[];
  if (propertyExtras.isNotEmpty) {
    steps.add(
      StructuredGuideStep(
        id: 'retirement_extras',
        prompt: 'Include property or other assets in retirement corpus?',
        hint: 'Investment accounts already count toward retirement.',
        allowMultiple: true,
        choices: [
          for (final a in propertyExtras)
            StructuredGuideChoice(
              id: 'asset_${a.id}',
              label: '${a.name} · ${goalMoney(model, model.assetDisplayValue(a))}',
            ),
        ],
      ),
    );
  }
  steps.add(
    StructuredGuideStep(
      id: 'savings_weights',
      prompt: 'Savings pool across target goals',
      hint: savings.isEmpty ? 'No savings accounts in ledger yet.' : '${savings.length} savings account(s).',
      choices: const [
        StructuredGuideChoice(id: 'wt_keep', label: 'Keep current goal weights'),
        StructuredGuideChoice(id: 'wt_auto', label: 'Auto-balance by monthly gap to targets'),
        StructuredGuideChoice(id: 'wt_even', label: 'Split savings evenly across targets'),
      ],
    ),
  );
  return steps;
}

Map<String, Object?> bucketsStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final out = <String, Object?>{'summary': 'Retirement assets and savings allocation'};
  final selected = result.selectedFor('retirement_extras');
  if (selected != null) {
    final extras = <String>{};
    for (final id in selected) {
      if (id.startsWith('asset_')) extras.add(id.substring(6));
    }
    out['retirementExtraAssetIds'] = extras.toList();
  }
  final wt = result.singleFor('savings_weights');
  out['rebalanceSavings'] = wt == 'wt_auto' || wt == 'wt_even';
  out['evenSavings'] = wt == 'wt_even';
  return out;
}

void applyBucketsStructured(AppModel model, Map<String, Object?> structured) {
  final idsRaw = structured['retirementExtraAssetIds'];
  if (idsRaw is List) {
    model.setRetirementExtraAssetIds(idsRaw.map((e) => e.toString()).toSet());
  }
  if (structured['rebalanceSavings'] == true) {
    model.autoAllocateGoalSavingsWeights();
  }
  if (structured['evenSavings'] == true) {
    final targets = model.targetGoals;
    if (targets.isNotEmpty) {
      final w = 1.0 / targets.length;
      for (final g in targets) {
        model.upsertFinancialGoal(g.copyWith(savingsWeight: w), touchGoalsUpdated: false);
      }
    }
  }
}

Future<void> openBucketsStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  final steps = bucketsGuideSteps(model);
  if (steps.isEmpty) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Add assets in Ledger first'), behavior: SnackBarBehavior.floating),
    );
    return;
  }

  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Savings & assets',
        steps: steps,
        optionalNoteHint: 'e.g. sell property, new brokerage, HSA rules…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  if (res.optionalNote.isNotEmpty) {
    final structured = await synthesizeGoalsSectionWithLlm(
      model: model,
      agentId: InternalAppAgentIds.goalsRetirementBuckets,
      optionalNote: res.optionalNote,
      answers: res.answers,
      payload: {
        'retirementExtraAssetIds': model.retirementExtraAssetIds.toList(),
        'assets': [
          for (final a in model.assets)
            {
              'id': a.id,
              'name': a.name,
              'type': a.type.name,
              'value': model.assetDisplayValue(a),
              'inRetirement': assetCountsTowardRetirement(a, model.assetsGoalsPolicy),
            },
        ],
        'targetGoals': [
          for (final g in model.targetGoals) {'id': g.id, 'name': g.name, 'savingsWeight': g.savingsWeight},
        ],
      },
    );
    if (!context.mounted) return;
    if (structured == null) {
      _showLlmUnavailable(context, model);
      return;
    }
    await _showApplyReview(
      context: context,
      model: model,
      title: 'Review buckets',
      lines: [
        if (structured['summary'] != null) structured['summary'].toString(),
      ],
      onApply: () {
        final ids = structured['retirementExtraAssetIds'];
        if (ids is List) {
          model.setRetirementExtraAssetIds(ids.map((e) => e.toString()).toSet());
        }
        applyBucketsStructured(model, structured);
        model.markRetirementBucketsUpdated();
        model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementBuckets, structured);
      },
    );
    return;
  }

  final structured = bucketsStructuredFromAnswers(model, res);
  applyBucketsStructured(model, structured);
  model.markRetirementBucketsUpdated();
  model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementBuckets, structured);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Retirement buckets updated'), behavior: SnackBarBehavior.floating),
  );
}

void _showLlmUnavailable(BuildContext context, AppModel model) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(model.llmAssistantUnavailableMessage),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

Future<void> _showApplyReview({
  required BuildContext context,
  required AppModel model,
  required String title,
  required List<String> lines,
  required VoidCallback onApply,
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => Scaffold(
        appBar: AppBar(title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900))),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            for (final line in lines)
              if (line.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(line, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
                ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () {
                onApply();
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$title saved'), behavior: SnackBarBehavior.floating),
                );
              },
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    ),
  );
}
