import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_editor_sheet.dart';
import 'goal_widgets.dart';

class GoalsTab extends StatelessWidget {
  const GoalsTab({
    super.key,
    required this.model,
    required this.onGoToSettingsAgents,
    required this.onGoToSettingsPermissions,
    required this.onOpenGuide,
  });

  final AppModel model;
  final VoidCallback onGoToSettingsAgents;
  final VoidCallback onGoToSettingsPermissions;
  final VoidCallback onOpenGuide;

  static String _providerShortLabel(LlmProvider p) => switch (p) {
        LlmProvider.appleFoundation => 'Apple',
        LlmProvider.openai => 'GPT',
        LlmProvider.anthropic => 'Claude',
        LlmProvider.gemini => 'Gemini',
      };

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => _GoalsBody(
        model: model,
        onGoToSettingsAgents: onGoToSettingsAgents,
        onGoToSettingsPermissions: onGoToSettingsPermissions,
        onOpenGuide: onOpenGuide,
        providerShortLabel: _providerShortLabel,
      ),
    );
  }
}

class _GoalsBody extends StatelessWidget {
  const _GoalsBody({
    required this.model,
    required this.onGoToSettingsAgents,
    required this.onGoToSettingsPermissions,
    required this.onOpenGuide,
    required this.providerShortLabel,
  });

  final AppModel model;
  final VoidCallback onGoToSettingsAgents;
  final VoidCallback onGoToSettingsPermissions;
  final VoidCallback onOpenGuide;
  final String Function(LlmProvider) providerShortLabel;

  Widget _providerPicker(BuildContext context, List<LlmProvider> withKeys, LlmProvider selected) {
    final cs = Theme.of(context).colorScheme;
    if (withKeys.length <= 1) {
      return Text(
        providerShortLabel(withKeys.single),
        style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant),
      );
    }
    return PopupMenuButton<LlmProvider>(
      position: PopupMenuPosition.under,
      initialValue: selected,
      color: cs.surfaceContainerHigh,
      onSelected: model.setActiveLlmProvider,
      itemBuilder: (ctx) => [
        for (final p in withKeys)
          PopupMenuItem(
            value: p,
            child: Text(providerShortLabel(p), style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: cs.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: cs.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(providerShortLabel(selected), style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurface)),
            const SizedBox(width: 4),
            Text('▾', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurfaceVariant, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final hide = m.privacyHideAmounts;
    final accent = m.accent;

    final withKeys = <LlmProvider>[
      for (final p in LlmProvider.values)
        if (m.apiKeyFor(p) != null) p,
    ];
    final canUseLlm = m.canUseAnyLlm;
    final selected = withKeys.contains(m.activeLlmProvider)
        ? m.activeLlmProvider
        : (withKeys.isNotEmpty ? withKeys.first : m.activeLlmProvider);

    final retirement = m.retirementGoal;
    final targets = m.targetGoals;
    final savingsTotal = m.allocSavingsMonthly;
    final shares = m.normalizedGoalSavingsShares();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      children: [
        Row(
          children: [
            Text('Goals', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const Spacer(),
            if (!canUseLlm)
              TextButton(
                onPressed: onGoToSettingsPermissions,
                child: const Text('Add key'),
              )
            else if (withKeys.isNotEmpty)
              _providerPicker(context, withKeys, selected),
            IconButton(
              onPressed: canUseLlm ? onOpenGuide : onGoToSettingsPermissions,
              icon: const Icon(Icons.auto_awesome, size: 22),
              tooltip: canUseLlm ? 'Goals guide' : 'Add API key',
              color: accent,
            ),
            IconButton(
              onPressed: onGoToSettingsAgents,
              icon: const Icon(Icons.tune, size: 22),
              tooltip: 'Guide prompts',
              color: cs.onSurfaceVariant,
            ),
          ],
        ),
        const SizedBox(height: 14),
        LiquidGlassPanel(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Savings flow', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
              const SizedBox(height: 4),
              Text(
                goalMoney(m, savingsTotal, hide: hide),
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                'Split across ${m.financialGoals.length} goal${m.financialGoals.length == 1 ? '' : 's'} · auto-weighted',
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600),
              ),
              if (m.financialGoals.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final g in m.financialGoals)
                      GoalSavingsChip(
                        label: g.name.trim().isEmpty ? (g.isRetirement ? 'Retirement' : 'Goal') : g.name.trim(),
                        amountText: goalMoney(m, m.savingsMonthlyForGoal(g), hide: hide),
                        highlight: g.fundsProjects,
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (retirement != null) ...[
          _GoalTile(
            model: m,
            goal: retirement,
            accent: accent,
            hide: hide,
            sharePct: (shares[retirement.id] ?? 0) * 100,
            onTap: () => openGoalEditorSheet(context: context, model: m, goalId: retirement.id),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Text('Targets', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface)),
            const Spacer(),
            TextButton.icon(
              onPressed: () {
                m.addTargetGoal();
                final added = m.targetGoals.lastOrNull;
                if (added != null) {
                  openGoalEditorSheet(context: context, model: m, goalId: added.id);
                }
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (targets.isEmpty)
          LiquidGlassPanel(
            padding: const EdgeInsets.all(20),
            child: Text(
              'Add a target — house, education, projects…',
              textAlign: TextAlign.center,
              style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w700),
            ),
          )
        else
          ...targets.map(
            (g) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _GoalTile(
                model: m,
                goal: g,
                accent: accent,
                hide: hide,
                sharePct: (shares[g.id] ?? 0) * 100,
                onTap: () => openGoalEditorSheet(context: context, model: m, goalId: g.id),
              ),
            ),
          ),
      ],
    );
  }
}

class _GoalTile extends StatelessWidget {
  const _GoalTile({
    required this.model,
    required this.goal,
    required this.accent,
    required this.hide,
    required this.sharePct,
    required this.onTap,
  });

  final AppModel model;
  final FinancialGoal goal;
  final Color accent;
  final bool hide;
  final double sharePct;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final current = model.goalCurrentAmount(goal);
    final target = goal.targetAmount;
    final progress = model.goalProgressFraction(goal);
    final months = goalMonthsRemaining(goal.targetDate);
    final linked = goal.linkedAssetIds.length;
    final title = goal.isRetirement
        ? 'Retirement'
        : (goal.name.trim().isEmpty ? 'Target' : goal.name.trim());

    String subtitle;
    if (goal.isRetirement) {
      subtitle = linked == 0 ? 'Link investments' : '$linked linked';
      if (goal.corpusAdjustment.abs() > 0.5) {
        subtitle = '$subtitle · adj ${goalMoney(model, goal.corpusAdjustment, hide: hide)}';
      }
    } else if (goal.fundsProjects) {
      subtitle = 'Projects · ${sharePct.round()}% savings';
    } else {
      subtitle = '${sharePct.round()}% savings';
    }

    return GoalCardShell(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                goal.isRetirement ? Icons.beach_access_outlined : Icons.flag_outlined,
                color: accent,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                    Text(subtitle, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              if (months != null && months > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: cs.surfaceContainerHigh,
                  ),
                  child: Text(
                    '${months}mo',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: cs.onSurfaceVariant),
                  ),
                ),
              const Icon(Icons.chevron_right),
            ],
          ),
          const SizedBox(height: 12),
          GoalProgressBar(fraction: progress, accent: accent),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  goalMoney(model, current, hide: hide),
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              if (target > 0)
                Text(
                  '→ ${goalMoney(model, target, hide: hide)}',
                  style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant, fontSize: 13),
                ),
            ],
          ),
          if (goal.targetDate != null) ...[
            const SizedBox(height: 4),
            Text(
              'By ${goalDateLabel(goal.targetDate)}',
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant.withValues(alpha: 0.95)),
            ),
          ],
        ],
      ),
    );
  }
}
