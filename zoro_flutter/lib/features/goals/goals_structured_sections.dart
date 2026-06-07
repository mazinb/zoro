import 'package:flutter/material.dart';

import '../../core/finance/currency.dart';
import '../../core/finance/goal_asset_buckets.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/guided_mcq/structured_guide_page.dart';
import 'goal_widgets.dart';
import 'goals_apply_updates.dart';
import 'goals_structured_llm.dart';
import 'corpus_backtest_page.dart';

String? goalsSectionLastUpdatedLabel(DateTime? at, {DateTime? now}) {
  if (at == null) return null;
  return formatAgentLastRunRelative(at, now: now);
}

/// Hub row metadata (steps count shown on hub card).
class GoalsHelperSectionMeta {
  const GoalsHelperSectionMeta({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.stepCount,
    required this.onOpen,
  });

  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final int stepCount;
  final Future<void> Function(BuildContext context) onOpen;
}

List<GoalsHelperSectionMeta> goalsHelperSections(AppModel model) {
  final now = DateTime.now();
  final retirement = model.retirementGoal;
  final corpus = retirement == null ? 0.0 : model.goalEffectiveTargetAmount(retirement);
  final investPct = model.investPctOfAvailableRounded();
  final feas = retirement == null ? null : model.retirementInvestFeasibility(retirement);
  final liabilities = model.liabilities;

  return [
    GoalsHelperSectionMeta(
      id: 'corpus',
      title: 'Corpus backtest',
      subtitle: corpus > 0
          ? '${goalMoney(model, corpus)} · ${goalsSectionLastUpdatedLabel(model.retirementCorpusLastUpdated, now: now) ?? "not set"}'
          : 'Historical drawdown vs debt & equity',
      icon: Icons.beach_access_outlined,
      stepCount: 0,
      onOpen: (ctx) => openCorpusBacktestPage(context: ctx, model: model),
    ),
    GoalsHelperSectionMeta(
      id: 'split',
      title: 'Invest & retire',
      subtitle: _splitSubtitle(model, feas, investPct, now),
      icon: Icons.pie_chart_outline,
      stepCount: splitGuideSteps(model).length,
      onOpen: (ctx) => openSplitStructuredGuide(context: ctx, model: model),
    ),
    GoalsHelperSectionMeta(
      id: 'buckets',
      title: 'Assets & savings',
      subtitle:
          '${model.retirementExtraAssetIds.length} in corpus · ${goalsSectionLastUpdatedLabel(model.retirementBucketsLastUpdated, now: now) ?? "not set"}',
      icon: Icons.account_balance_wallet_outlined,
      stepCount: bucketsGuideSteps(model).length,
      onOpen: (ctx) => openBucketsStructuredGuide(context: ctx, model: model),
    ),
    if (liabilities.isNotEmpty)
      GoalsHelperSectionMeta(
        id: 'liabilities',
        title: 'Review liabilities',
        subtitle: '${liabilities.length} loan${liabilities.length == 1 ? "" : "s"} · paydown & rates',
        icon: Icons.credit_card_outlined,
        stepCount: liabilitiesGuideSteps(model).length,
        onOpen: (ctx) => openLiabilitiesStructuredGuide(context: ctx, model: model),
      ),
    GoalsHelperSectionMeta(
      id: 'returns',
      title: 'Asset returns',
      subtitle: 'Expected return % on investments',
      icon: Icons.trending_up,
      stepCount: assetReturnsGuideSteps(model).length,
      onOpen: (ctx) => openAssetReturnsStructuredGuide(context: ctx, model: model),
    ),
    GoalsHelperSectionMeta(
      id: 'assumptions',
      title: 'Rates & FX',
      subtitle: 'Projection returns, inflation, exchange rates',
      icon: Icons.percent_outlined,
      stepCount: assumptionsGuideSteps(model).length,
      onOpen: (ctx) => openAssumptionsStructuredGuide(context: ctx, model: model),
    ),
  ];
}

String _splitSubtitle(AppModel m, GoalFeasibility? feas, int investPct, DateTime now) {
  final date = goalDateLabel(m.retirementGoal?.targetDate);
  final updated = goalsSectionLastUpdatedLabel(m.allocationTargetLastUpdated, now: now);
  final status = feas == null ? '' : '${feas.title} · ';
  return '$status$investPct% invest · $date${updated != null ? " · $updated" : ""}';
}

double _bufferFromLifestyleAndCushion(String? lifestyle, String? cushion) {
  var buf = switch (lifestyle) {
    'life_lower' => 5.0,
    'life_similar' => 12.0,
    'life_higher' => 22.0,
    _ => 15.0,
  };
  buf += switch (cushion) {
    'cush_none' => 0.0,
    'cush_moderate' => 10.0,
    'cush_large' => 22.0,
    _ => 5.0,
  };
  return clampCorpusBufferPct(buf);
}

double _swrFromDrawdownStyle(String? style) {
  return clampWithdrawalRatePct(switch (style) {
    'draw_conservative' => 3.0,
    'draw_classic' => 4.0,
    'draw_flexible' => 5.0,
    'draw_help' => 4.0,
    _ => 4.0,
  });
}

Map<String, double> _corpusParamsFromGuideAnswers(
  AppModel model,
  StructuredGuideResult result,
) {
  final lifestyle = result.singleFor('lifestyle');
  final cushion = result.singleFor('cushion');
  final draw = result.singleFor('drawdown_style');
  final buf = _bufferFromLifestyleAndCushion(lifestyle, cushion);
  final swr = _swrFromDrawdownStyle(draw);
  return {'swr': swr, 'buffer': buf};
}

List<StructuredGuideStep> corpusGuideSteps(AppModel model) {
  final r = model.retirementGoal;
  final auto = r?.corpusAutoFromExpenses ?? true;
  final draft = StructuredGuideResult(answers: const [], optionalNote: '');
  final params = _corpusParamsFromGuideAnswers(model, draft);
  final previewCorpus = computeRetirementCorpusBase(
    recurringExpensesMonthly: model.recurringExpensesMonthly,
    safeWithdrawalRatePct: params['swr']!,
  );
  final previewSurplus = surplusFromCorpusBufferPct(previewCorpus, params['buffer']!);
  final previewTxt = goalMoney(model, previewCorpus);

  return [
    StructuredGuideStep(
      id: 'lifestyle',
      prompt: 'Retirement spending vs today',
      hint: 'Rough picture — we will size the corpus from your ledger expenses.',
      choices: const [
        StructuredGuideChoice(id: 'life_lower', label: 'Lower — lean / downsized'),
        StructuredGuideChoice(id: 'life_similar', label: 'About the same as today'),
        StructuredGuideChoice(id: 'life_higher', label: 'Higher — travel, healthcare, help family'),
        StructuredGuideChoice(id: 'life_unsure', label: 'Not sure — use a moderate cushion'),
      ],
    ),
    StructuredGuideStep(
      id: 'cushion',
      prompt: 'Extra safety beyond monthly expenses',
      choices: const [
        StructuredGuideChoice(id: 'cush_none', label: 'Minimal extra buffer'),
        StructuredGuideChoice(id: 'cush_moderate', label: 'Moderate cushion'),
        StructuredGuideChoice(id: 'cush_large', label: 'Large cushion — sleep-well money'),
        StructuredGuideChoice(id: 'cush_unsure', label: 'Not sure — light buffer'),
      ],
    ),
    StructuredGuideStep(
      id: 'drawdown_style',
      prompt: 'How conservative should withdrawals be?',
      hint: 'We translate this to a withdrawal rate for you — no need to pick a %.',
      choices: const [
        StructuredGuideChoice(id: 'draw_conservative', label: 'Very conservative — preserve corpus'),
        StructuredGuideChoice(id: 'draw_classic', label: 'Balanced — classic planning'),
        StructuredGuideChoice(id: 'draw_flexible', label: 'Flexible — spend a bit more early'),
        StructuredGuideChoice(id: 'draw_help', label: 'Help me decide — use balanced default'),
      ],
    ),
    StructuredGuideStep(
      id: 'auto_expenses',
      prompt: 'Base corpus on ledger expenses?',
      choices: [
        StructuredGuideChoice(
          id: 'auto_yes',
          label: auto ? 'Yes — keep linked to recurring expenses' : 'Yes — link to ledger expenses',
        ),
        const StructuredGuideChoice(id: 'auto_no', label: 'No — I may set a custom amount'),
        if (model.recurringExpensesMonthly <= 0)
          const StructuredGuideChoice(
            id: 'auto_setup',
            label: 'Expenses missing — set up in Ledger first',
          ),
      ],
    ),
    StructuredGuideStep(
      id: 'corpus_confirm',
      prompt: previewSurplus > 0.5
          ? 'Suggested corpus: $previewTxt + ${goalMoney(model, previewSurplus)} surplus'
          : 'Suggested corpus: $previewTxt',
      hint: 'From your answers + ledger expenses. You can accept or optionally override.',
      choices: [
        StructuredGuideChoice(id: 'accept', label: 'Use $previewTxt'),
        const StructuredGuideChoice(id: 'custom', label: 'Enter a different amount (optional)'),
      ],
    ),
    StructuredGuideStep(
      id: 'corpus_custom',
      prompt: 'Custom corpus (optional)',
      kind: StructuredGuideStepKind.numeric,
      numericInitial: previewCorpus,
      numericSuffix: '',
      numericMin: 0,
      hint: 'Leave blank to keep the suggestion.',
    ),
  ];
}

Map<String, Object?> corpusStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final r = model.retirementGoal;
  final params = _corpusParamsFromGuideAnswers(model, result);
  final swr = params['swr']!;
  final buf = params['buffer']!;

  final autoId = result.singleFor('auto_expenses');
  final auto = switch (autoId) {
    'auto_yes' => true,
    'auto_no' => false,
    'auto_setup' => model.recurringExpensesMonthly > 0,
    _ => r?.corpusAutoFromExpenses ?? true,
  };

  var corpus = computeRetirementCorpusBase(
    recurringExpensesMonthly: model.recurringExpensesMonthly,
    safeWithdrawalRatePct: swr,
  );
  var surplus = surplusFromCorpusBufferPct(corpus, buf);

  final confirm = result.singleFor('corpus_confirm');
  if (confirm == 'custom') {
    final custom = result.numericFor('corpus_custom');
    if (custom != null && custom > 0.5) corpus = custom;
  }

  final lifestyle = result.singleFor('lifestyle');
  final draw = result.singleFor('drawdown_style');
  final lifestyleLabel = switch (lifestyle) {
    'life_lower' => 'lean retirement',
    'life_similar' => 'similar spending',
    'life_higher' => 'higher spending',
    _ => 'moderate spending',
  };
  final drawLabel = switch (draw) {
    'draw_conservative' => 'conservative withdrawals',
    'draw_flexible' => 'flexible withdrawals',
    _ => 'balanced withdrawals',
  };

  return {
    'safeWithdrawalRatePct': swr,
    'corpusBufferPct': buf,
    'corpusAutoFromExpenses': auto,
    'targetAmount': corpus,
    'corpusSurplus': surplus,
    'summary':
        '$lifestyleLabel · $drawLabel · ${auto ? "corpus from expenses" : "custom corpus"} · ${swr.toStringAsFixed(1)}% draw · ${buf.round()}% surplus',
  };
}

List<String> corpusPreviewLines(AppModel model, StructuredGuideResult result) {
  final s = corpusStructuredFromAnswers(model, result);
  final swr = s['safeWithdrawalRatePct'];
  final buf = s['corpusBufferPct'];
  final corpus = s['targetAmount'];
  final lines = <String>[
    if (s['summary'] != null) s['summary'].toString(),
    if (swr is num) 'Withdrawal rate: ${swr.toStringAsFixed(1)}%',
    if (buf is num) 'Buffer: ${buf.round()}%',
    if (corpus is num) 'Target corpus: ${goalMoney(model, corpus.toDouble())}',
    if (s['corpusSurplus'] is num && (s['corpusSurplus'] as num) > 0)
      'Surplus: ${goalMoney(model, (s['corpusSurplus'] as num).toDouble())}',
  ];
  final annual = model.recurringExpensesMonthly * 12;
  if (annual > 0 && corpus is num && corpus > 0) {
    final implied = annual / corpus.toDouble() * 100;
    lines.add('Implied withdrawal from expenses: ${implied.toStringAsFixed(2)}%');
  }
  return lines;
}

Future<void> openCorpusStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  final steps = corpusGuideSteps(model);
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Withdrawal & corpus',
        steps: steps,
        stepCountLabel: '${steps.length} steps',
        optionalNoteHint: 'Healthcare, relocation, one-off costs…',
        previewLines: (partial) => corpusPreviewLines(model, partial),
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  final formStructured = corpusStructuredFromAnswers(model, res);
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsRetirementCorpus,
    formStructured: formStructured,
    formReviewLines: corpusPreviewLines(model, res),
    result: res,
    llmPayload: {
      'recurringExpensesMonthly': model.recurringExpensesMonthly,
      'safeWithdrawalRatePct': model.retirementGoal?.safeWithdrawalRatePct,
      'corpusBufferPct': model.retirementGoal?.corpusBufferPct,
      'corpusAutoFromExpenses': model.retirementGoal?.corpusAutoFromExpenses,
      'computedCorpus': model.retirementGoal == null
          ? 0
          : model.goalEffectiveTargetAmount(model.retirementGoal!),
    },
    onApplyStructured: (structured) {
      applyRetirementCorpusStructured(
        model,
        structured,
        contextMarkdown: structured['contextMarkdown']?.toString() ?? '',
      );
      model.markRetirementCorpusUpdated();
      model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementCorpus, structured);
    },
    reviewTitle: 'Review corpus',
  );
}

List<StructuredGuideStep> splitGuideSteps(AppModel model) {
  final r = model.retirementGoal;
  final investMo = model.allocInvestmentsMonthly;
  final savingsMo = model.allocSavingsMonthly;
  final required = r == null ? 0.0 : model.goalRequiredMonthlySavingsFor(r);
  String fmt(double v) => goalMoney(model, v);

  return [
    StructuredGuideStep(
      id: 'invest_monthly',
      prompt: 'Invest /mo',
      kind: StructuredGuideStepKind.numeric,
      numericInitial: investMo,
      numericSuffix: '/mo',
      numericMin: 0,
      hint: required > 0.5 ? 'Need ~${fmt(required)}/mo toward retirement corpus.' : null,
    ),
    StructuredGuideStep(
      id: 'savings_monthly',
      prompt: 'Savings /mo',
      kind: StructuredGuideStepKind.numeric,
      numericInitial: savingsMo,
      numericSuffix: '/mo',
      numericMin: 0,
      hint: 'Free cash after expenses: ${fmt(model.availableAfterExpensesMonthly)}',
    ),
    StructuredGuideStep(
      id: 'retire_shift',
      prompt: 'Retirement date',
      hint: 'Extend only if the plan is still tight.',
      choices: const [
        StructuredGuideChoice(id: 'date_keep', label: 'Keep retire-by date'),
        StructuredGuideChoice(id: 'date_plus_2', label: '+2 years'),
        StructuredGuideChoice(id: 'date_plus_5', label: '+5 years'),
        StructuredGuideChoice(id: 'date_plus_10', label: '+10 years'),
      ],
    ),
  ];
}

Map<String, Object?> splitStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final invest = result.numericFor('invest_monthly') ?? model.allocInvestmentsMonthly;
  final savings = result.numericFor('savings_monthly') ?? model.allocSavingsMonthly;
  final avail = model.availableAfterExpensesMonthly;
  final frac = avail > 0 ? (invest / avail).clamp(0.0, 1.0) : 0.0;

  final r = model.retirementGoal;
  DateTime? newDate = r?.targetDate;
  final dateId = result.singleFor('retire_shift');
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
    'summary': 'Invest ${goalMoney(model, invest)}/mo · savings ${goalMoney(model, savings)}/mo',
    'allocInvestFraction': frac,
    'allocInvestmentsMonthly': invest,
    'allocSavingsMonthly': savings,
  };
  if (r != null && newDate != null && newDate != r.targetDate) {
    out['goalUpdates'] = [
      {'goalId': r.id, 'targetDate': newDate.toIso8601String().split('T').first},
    ];
  }
  return out;
}

List<String> splitPreviewLines(AppModel model, StructuredGuideResult result) {
  final s = splitStructuredFromAnswers(model, result);
  final lines = <String>[];
  if (s['summary'] != null) lines.add(s['summary'].toString());
  final frac = s['allocInvestFraction'];
  if (frac is num) {
    lines.add('${(frac.toDouble() * 100).round()}% of free cash to investments');
  }
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

Future<void> openSplitStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  final steps = splitGuideSteps(model);
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Invest & retire',
        steps: steps,
        stepCountLabel: '${steps.length} steps',
        optionalNoteHint: 'Bonus income, sabbatical, part-time…',
        previewLines: (partial) => splitPreviewLines(model, partial),
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  final formStructured = splitStructuredFromAnswers(model, res);
  final r = model.retirementGoal!;
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsRetirementSplit,
    formStructured: formStructured,
    formReviewLines: splitPreviewLines(model, res),
    result: res,
    llmPayload: {
      'allocInvestFraction': model.allocInvestFraction,
      'allocInvestmentsMonthly': model.allocInvestmentsMonthly,
      'allocSavingsMonthly': model.allocSavingsMonthly,
      'availableAfterExpensesMonthly': model.availableAfterExpensesMonthly,
      'focusGoalId': r.id,
      'targetDate': r.targetDate?.toIso8601String(),
      'requiredMonthly': model.goalRequiredMonthlySavingsFor(r),
    },
    onApplyStructured: (structured) {
      _applySplitStructured(model, structured, focusGoalId: r.id);
      model.markRetirementSplitUpdated();
      model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementSplit, structured);
    },
    reviewTitle: 'Review invest & retire',
  );
}

void _applySplitStructured(AppModel model, Map<String, Object?> structured, {String? focusGoalId}) {
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
  applyGoalsGuideStructured(model, structured, focusGoalId: focusGoalId);
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
        prompt: 'Property & other in retirement corpus?',
        hint: 'Investment accounts already count toward retirement.',
        allowMultiple: true,
        bullets: const [
          'Include property you will sell or downsize before retiring.',
          'Skip rental you keep for income — it is not liquid corpus.',
          'Other: art, business equity — only if you will liquidate.',
        ],
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
      prompt: 'Savings across target goals',
      hint: savings.isEmpty ? 'No savings accounts in ledger yet.' : '${savings.length} savings account(s).',
      bullets: const [
        'Auto-balance: weights follow monthly gap to each target.',
        'Even split: same share to every target.',
        'Keep: leave weights as they are.',
      ],
      choices: const [
        StructuredGuideChoice(id: 'wt_keep', label: 'Keep current weights'),
        StructuredGuideChoice(id: 'wt_auto', label: 'Auto-balance by gap'),
        StructuredGuideChoice(id: 'wt_even', label: 'Split evenly'),
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
        title: 'Assets & savings',
        steps: steps,
        stepCountLabel: '${steps.length} steps',
        optionalNoteHint: 'Sell property, new brokerage, HSA rules…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  final formStructured = bucketsStructuredFromAnswers(model, res);
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsRetirementBuckets,
    formStructured: formStructured,
    formReviewLines: [
      if (formStructured['summary'] != null) formStructured['summary'].toString(),
    ],
    result: res,
    llmPayload: {
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
    onApplyStructured: (structured) {
      applyBucketsStructured(model, structured);
      model.markRetirementBucketsUpdated();
      model.recordInternalAgentRun(InternalAppAgentIds.goalsRetirementBuckets, structured);
    },
    reviewTitle: 'Review assets & savings',
  );
}

List<StructuredGuideStep> liabilitiesGuideSteps(AppModel model) {
  return [
    for (final l in model.liabilities)
      StructuredGuideStep(
        id: 'liab_${l.id}',
        prompt: l.name.trim().isEmpty ? l.type.label : l.name.trim(),
        kind: StructuredGuideStepKind.numeric,
        numericInitial: model.liabilityPaydownMonthly(l),
        numericSuffix: '/mo',
        numericMin: 0,
        hint: 'Balance ${goalMoney(model, model.liabilityDisplayValue(l))} · rate ${l.interestRatePct.toStringAsFixed(1)}%',
        bullets: const [
          'Set paydown you will actually make each month.',
          'Use 0 only if you are not paying this down yet.',
        ],
      ),
  ];
}

Map<String, Object?> liabilitiesStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final updates = <Map<String, Object?>>[];
  for (final l in model.liabilities) {
    final pay = result.numericFor('liab_${l.id}');
    if (pay != null) {
      updates.add({'liabilityId': l.id, 'paydownMonthly': pay});
    }
  }
  return {
    'summary': 'Updated paydown on ${updates.length} loan(s)',
    'liabilityUpdates': updates,
  };
}

void applyLiabilitiesStructured(AppModel model, Map<String, Object?> structured) {
  final raw = structured['liabilityUpdates'];
  if (raw is! List) return;
  for (final e in raw) {
    if (e is! Map) continue;
    final id = e['liabilityId']?.toString();
    final pay = e['paydownMonthly'];
    if (id == null || pay is! num) continue;
    model.setLiabilityPaydownMonthly(id, pay.toDouble());
  }
}

Future<void> openLiabilitiesStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  if (model.liabilities.isEmpty) return;
  final steps = liabilitiesGuideSteps(model);
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Review liabilities',
        steps: steps,
        stepCountLabel: '${steps.length} step${steps.length == 1 ? "" : "s"}',
        optionalNoteHint: 'Refinance, lump sum, pause paydown…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  final formStructured = liabilitiesStructuredFromAnswers(model, res);
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsReviewLiabilities,
    formStructured: formStructured,
    formReviewLines: [
      if (formStructured['summary'] != null) formStructured['summary'].toString(),
      for (final u in formStructured['liabilityUpdates'] as List? ?? [])
        if (u is Map)
          '${u['liabilityId']}: ${goalMoney(model, (u['paydownMonthly'] as num?)?.toDouble() ?? 0)}/mo',
    ],
    result: res,
    llmPayload: {
      'liabilities': [
        for (final l in model.liabilities)
          {
            'id': l.id,
            'name': l.name,
            'balance': model.liabilityDisplayValue(l),
            'paydownMonthly': model.liabilityPaydownMonthly(l),
            'interestRatePct': l.interestRatePct,
          },
      ],
    },
    onApplyStructured: (structured) {
      applyLiabilitiesStructured(model, structured);
      model.recordInternalAgentRun(InternalAppAgentIds.goalsReviewLiabilities, structured);
    },
    reviewTitle: 'Review liabilities',
  );
}

List<StructuredGuideStep> assetReturnsGuideSteps(AppModel model) {
  final investAssets = model.assets
      .where((a) => a.type == LedgerAssetType.investments)
      .toList();
  if (investAssets.isEmpty) {
    return [
      const StructuredGuideStep(
        id: 'none',
        prompt: 'No investment assets in Ledger',
        choices: [StructuredGuideChoice(id: 'ok', label: 'Add assets in Ledger first')],
      ),
    ];
  }
  return [
    for (final a in investAssets)
      StructuredGuideStep(
        id: 'ret_${a.id}',
        prompt: a.name.trim().isEmpty ? a.type.label : a.name.trim(),
        kind: StructuredGuideStepKind.numeric,
        numericInitial: a.returnRatePct > 0 ? a.returnRatePct : 7,
        numericSuffix: '% / yr',
        numericMin: -20,
        numericMax: 50,
        hint: 'Balance ${goalMoney(model, model.assetDisplayValue(a))}',
        bullets: const [
          'Expected long-run return for projections — not this year’s actual.',
          'Use 0 if you want projections to ignore growth on this holding.',
        ],
      ),
  ];
}

Map<String, Object?> assetReturnsStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final updates = <Map<String, Object?>>[];
  for (final a in model.assets) {
    final rate = result.numericFor('ret_${a.id}');
    if (rate != null) {
      updates.add({'assetId': a.id, 'returnRatePct': rate});
    }
  }
  return {'summary': 'Updated return on ${updates.length} asset(s)', 'assetReturnUpdates': updates};
}

void applyAssetReturnsStructured(AppModel model, Map<String, Object?> structured) {
  final raw = structured['assetReturnUpdates'];
  if (raw is! List) return;
  for (final e in raw) {
    if (e is! Map) continue;
    final id = e['assetId']?.toString();
    final rate = e['returnRatePct'];
    if (id == null || rate is! num) continue;
    final idx = model.assets.indexWhere((a) => a.id == id);
    if (idx < 0) continue;
    model.assets[idx].returnRatePct = rate.toDouble().clamp(-20, 50);
  }
  model.touchAssetsChanged();
}

Future<void> openAssetReturnsStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  final steps = assetReturnsGuideSteps(model);
  if (steps.length == 1 && steps.first.id == 'none') {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Add investment assets in Ledger'), behavior: SnackBarBehavior.floating),
    );
    return;
  }
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Asset returns',
        steps: steps,
        stepCountLabel: '${steps.length} steps',
        optionalNoteHint: 'Market outlook, rebalancing, tax-advantaged accounts…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;
  if (res.singleFor('none') == 'ok') return;

  final formStructured = assetReturnsStructuredFromAnswers(model, res);
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsReviewAssetReturns,
    formStructured: formStructured,
    formReviewLines: [
      if (formStructured['summary'] != null) formStructured['summary'].toString(),
    ],
    result: res,
    llmPayload: {
      'assets': [
        for (final a in model.assets)
          {
            'id': a.id,
            'name': a.name,
            'type': a.type.name,
            'returnRatePct': a.returnRatePct,
            'value': model.assetDisplayValue(a),
          },
      ],
      'projectionInvestReturnPctAnnual': model.projectionInvestReturnPctAnnual.map(
        (k, v) => MapEntry(k.name, v),
      ),
    },
    onApplyStructured: (structured) {
      applyAssetReturnsStructured(model, structured);
      final inv = structured['projectionInvestReturnPctAnnual'];
      if (inv is Map) {
        for (final e in inv.entries) {
          final code = CurrencyCode.values.where((c) => c.name == e.key.toString()).firstOrNull;
          if (code != null && e.value is num) {
            model.setProjectionRatesForCurrency(code, investPct: (e.value as num).toDouble());
          }
        }
      }
      model.recordInternalAgentRun(InternalAppAgentIds.goalsReviewAssetReturns, structured);
    },
    reviewTitle: 'Review returns',
  );
}

List<StructuredGuideStep> assumptionsGuideSteps(AppModel model) {
  final currencies = {
    CurrencyCode.usd,
    model.homeCurrencyQuickPick1,
    if (model.homeCurrencyQuickPick2 != null) model.homeCurrencyQuickPick2!,
  };
  final steps = <StructuredGuideStep>[
    for (final c in currencies)
      StructuredGuideStep(
        id: 'proj_inv_${c.name}',
        prompt: '${c.code} invest return',
        kind: StructuredGuideStepKind.numeric,
        numericInitial: model.projectionInvestReturnPctAnnual[c] ?? 7,
        numericSuffix: '% / yr',
        numericMin: 0,
        numericMax: 20,
      ),
    for (final c in currencies)
      StructuredGuideStep(
        id: 'proj_sav_${c.name}',
        prompt: '${c.code} savings return',
        kind: StructuredGuideStepKind.numeric,
        numericInitial: model.projectionSavingsReturnPctAnnual[c] ?? 3,
        numericSuffix: '% / yr',
        numericMin: 0,
        numericMax: 20,
      ),
    for (final c in currencies)
      StructuredGuideStep(
        id: 'proj_inf_${c.name}',
        prompt: '${c.code} inflation',
        kind: StructuredGuideStepKind.numeric,
        numericInitial: model.projectionInflationPctAnnual[c] ?? 2.5,
        numericSuffix: '% / yr',
        numericMin: 0,
        numericMax: 15,
      ),
  ];
  for (final c in [
    if (model.homeCurrencyQuickPick1 != CurrencyCode.usd) model.homeCurrencyQuickPick1,
    if (model.homeCurrencyQuickPick2 != null) model.homeCurrencyQuickPick2!,
  ]) {
    final usdPerUnit = model.usdPerUnitResolved(c);
    steps.add(
      StructuredGuideStep(
        id: 'fx_${c.name}',
        prompt: '1 USD → ${c.code}',
        kind: StructuredGuideStepKind.numeric,
        numericInitial: usdPerUnit > 0 ? 1 / usdPerUnit : c.usdPerUnit,
        numericMin: 0.0001,
        numericMax: 10000,
      ),
    );
  }
  return steps;
}

Map<String, Object?> assumptionsStructuredFromAnswers(AppModel model, StructuredGuideResult result) {
  final projInv = <String, double>{};
  final projSav = <String, double>{};
  final projInf = <String, double>{};
  final fx = <String, double>{};

  for (final c in CurrencyCode.values) {
    final inv = result.numericFor('proj_inv_${c.name}');
    if (inv != null) projInv[c.name] = inv;
    final sav = result.numericFor('proj_sav_${c.name}');
    if (sav != null) projSav[c.name] = sav;
    final inf = result.numericFor('proj_inf_${c.name}');
    if (inf != null) projInf[c.name] = inf;
    final rate = result.numericFor('fx_${c.name}');
    if (rate != null && rate > 0) fx[c.name] = rate;
  }

  return {
    'summary': 'Updated projection rates and FX',
    'projectionInvestReturnPctAnnual': projInv,
    'projectionSavingsReturnPctAnnual': projSav,
    'projectionInflationPctAnnual': projInf,
    'fxUsdPerUnit': fx,
  };
}

void applyAssumptionsStructured(AppModel model, Map<String, Object?> structured) {
  void applyMap(String key, void Function(CurrencyCode c, double v) apply) {
    final raw = structured[key];
    if (raw is! Map) return;
    for (final e in raw.entries) {
      final code = CurrencyCode.values.where((c) => c.name == e.key.toString()).firstOrNull;
      if (code == null || e.value is! num) continue;
      apply(code, (e.value as num).toDouble());
    }
  }

  applyMap('projectionInvestReturnPctAnnual', (c, v) {
    model.setProjectionRatesForCurrency(c, investPct: v);
  });
  applyMap('projectionSavingsReturnPctAnnual', (c, v) {
    model.setProjectionRatesForCurrency(c, savingsPct: v);
  });
  applyMap('projectionInflationPctAnnual', (c, v) {
    model.setProjectionRatesForCurrency(c, inflationPct: v);
  });

  final fxRaw = structured['fxUsdPerUnit'];
  if (fxRaw is Map) {
    for (final e in fxRaw.entries) {
      final code = CurrencyCode.values.where((c) => c.name == e.key.toString()).firstOrNull;
      if (code == null || e.value is! num) continue;
      final unitsPerUsd = (e.value as num).toDouble();
      if (unitsPerUsd > 0) {
        model.setFxUsdPerUnitOverride(code, 1 / unitsPerUsd);
      }
    }
  }
}

Future<void> openAssumptionsStructuredGuide({
  required BuildContext context,
  required AppModel model,
}) async {
  final steps = assumptionsGuideSteps(model);
  final res = await Navigator.of(context).push<StructuredGuideResult>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => StructuredGuidePage(
        title: 'Rates & FX',
        steps: steps,
        stepCountLabel: '${steps.length} steps',
        optionalNoteHint: 'Rate cuts, currency moves, long-run inflation view…',
      ),
    ),
  );
  if (!context.mounted || res == null) return;

  final formStructured = assumptionsStructuredFromAnswers(model, res);
  await _applyGoalsSection(
    context: context,
    model: model,
    agentId: InternalAppAgentIds.goalsReviewAssumptions,
    formStructured: formStructured,
    formReviewLines: [
      if (formStructured['summary'] != null) formStructured['summary'].toString(),
    ],
    result: res,
    llmPayload: {
      'projectionInvestReturnPctAnnual': model.projectionInvestReturnPctAnnual.map((k, v) => MapEntry(k.name, v)),
      'projectionSavingsReturnPctAnnual': model.projectionSavingsReturnPctAnnual.map((k, v) => MapEntry(k.name, v)),
      'projectionInflationPctAnnual': model.projectionInflationPctAnnual.map((k, v) => MapEntry(k.name, v)),
      'fxUsdPerUnit': {
        if (model.homeCurrencyQuickPick1 != CurrencyCode.usd)
          model.homeCurrencyQuickPick1.name: model.usdPerUnitResolved(model.homeCurrencyQuickPick1),
        if (model.homeCurrencyQuickPick2 != null)
          model.homeCurrencyQuickPick2!.name:
              model.usdPerUnitResolved(model.homeCurrencyQuickPick2!),
      },
    },
    onApplyStructured: (structured) {
      applyAssumptionsStructured(model, structured);
      model.recordInternalAgentRun(InternalAppAgentIds.goalsReviewAssumptions, structured);
    },
    reviewTitle: 'Review assumptions',
  );
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

Future<void> _applyGoalsSection({
  required BuildContext context,
  required AppModel model,
  required String agentId,
  required Map<String, Object?> formStructured,
  required List<String> formReviewLines,
  required StructuredGuideResult result,
  required Map<String, Object?> llmPayload,
  required void Function(Map<String, Object?> structured) onApplyStructured,
  required String reviewTitle,
}) async {
  if (result.optionalNote.isEmpty) {
    onApplyStructured(formStructured);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$reviewTitle saved'), behavior: SnackBarBehavior.floating),
    );
    return;
  }

  final llmStructured = await synthesizeGoalsSectionWithLlm(
    context: context,
    model: model,
    agentId: agentId,
    optionalNote: result.optionalNote,
    answers: result.answers,
    payload: llmPayload,
  );
  if (!context.mounted) return;
  if (llmStructured == null) {
    _showLlmUnavailable(context, model);
    return;
  }

  await _showApplyReview(
    context: context,
    title: reviewTitle,
    formLines: formReviewLines,
    llmLines: _structuredReviewLines(model, llmStructured),
    llmExplanation: llmStructured['summary']?.toString(),
    onUseForm: () => onApplyStructured(formStructured),
    onAcceptLlm: () => onApplyStructured(llmStructured),
  );
}

List<String> _structuredReviewLines(AppModel model, Map<String, Object?> s) {
  final lines = <String>[];
  final summary = s['summary']?.toString();
  if (summary != null && summary.isNotEmpty) lines.add(summary);
  final swr = s['safeWithdrawalRatePct'];
  if (swr is num) lines.add('Withdrawal rate: ${swr.toStringAsFixed(1)}%');
  final buf = s['corpusBufferPct'];
  if (buf is num) lines.add('Buffer: ${buf.round()}%');
  final corpus = s['targetAmount'];
  if (corpus is num) lines.add('Target corpus: ${goalMoney(model, corpus.toDouble())}');
  final frac = s['allocInvestFraction'];
  if (frac is num) lines.add('Invest share: ${(frac.toDouble() * 100).round()}%');
  final inv = s['allocInvestmentsMonthly'];
  final sav = s['allocSavingsMonthly'];
  if (inv is num && sav is num) {
    lines.add('Invest ${goalMoney(model, inv.toDouble())}/mo · savings ${goalMoney(model, sav.toDouble())}/mo');
  }
  return lines;
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
  required String title,
  required List<String> formLines,
  required List<String> llmLines,
  String? llmExplanation,
  required VoidCallback onUseForm,
  required VoidCallback onAcceptLlm,
}) async {
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => Scaffold(
        appBar: AppBar(title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900))),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (llmExplanation != null && llmExplanation.trim().isNotEmpty) ...[
              Text(llmExplanation, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
              const SizedBox(height: 16),
            ],
            Text('Assistant suggestion', style: Theme.of(ctx).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            for (final line in llmLines)
              if (line.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(line, style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35)),
                ),
            const SizedBox(height: 16),
            Text('From your choices', style: Theme.of(ctx).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            for (final line in formLines)
              if (line.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(line, style: TextStyle(fontWeight: FontWeight.w600, height: 1.35, color: Theme.of(ctx).colorScheme.onSurfaceVariant)),
                ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                onAcceptLlm();
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$title applied'), behavior: SnackBarBehavior.floating),
                );
              },
              child: const Text('Accept suggestion'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () {
                onUseForm();
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$title applied (your choices)'), behavior: SnackBarBehavior.floating),
                );
              },
              child: const Text('Use original (from form)'),
            ),
          ],
        ),
      ),
    ),
  );
}
