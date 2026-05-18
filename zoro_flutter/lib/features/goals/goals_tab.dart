import 'package:flutter/material.dart';

import '../../core/finance/goal_asset_buckets.dart';
import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../core/state/financial_goals.dart';
import '../../core/state/ledger_rows.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../../shared/widgets/zoro_status_banner.dart';
import 'goal_editor_sheet.dart';
import 'goal_widgets.dart';
import 'goals_ai_flow.dart';
import 'goals_paydown_sheet.dart';

/// Goals tab type scale (aligned with Ledger cards).
abstract final class _GoalsType {
  static const sectionTitle = TextStyle(fontWeight: FontWeight.w900, fontSize: 15);
  static const sectionSubtitle = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
  static const tileTitle = TextStyle(fontWeight: FontWeight.w900, fontSize: 15);
  static const tileBody = TextStyle(fontWeight: FontWeight.w900, fontSize: 14);
  static const tileMeta = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
  static const rowTitle = TextStyle(fontWeight: FontWeight.w800, fontSize: 14);
  static const rowMeta = TextStyle(fontWeight: FontWeight.w600, fontSize: 13);
}

class GoalsTab extends StatelessWidget {
  const GoalsTab({
    super.key,
    required this.model,
    this.onGoToLedger,
    this.onGoToSettingsPermissions,
  });

  final AppModel model;
  final void Function(String section)? onGoToLedger;
  final VoidCallback? onGoToSettingsPermissions;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) => _GoalsBody(
        model: model,
        onGoToLedger: onGoToLedger,
        onGoToSettingsPermissions: onGoToSettingsPermissions,
      ),
    );
  }
}

class _GoalsBody extends StatelessWidget {
  const _GoalsBody({
    required this.model,
    this.onGoToLedger,
    this.onGoToSettingsPermissions,
  });

  final AppModel model;
  final void Function(String section)? onGoToLedger;
  final VoidCallback? onGoToSettingsPermissions;

  Widget _allocationSlider(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final avail = m.availableAfterExpensesMonthly;
    final sliderPct = (m.allocInvestFraction * 100).round();
    final savedPct = 100 - sliderPct;
    final headline = sliderPct > 50
        ? '$sliderPct% invested'
        : (sliderPct == 50 ? '50% saved' : '$savedPct% saved');
    final planFeas = m.planFeasibility();

    final hasWarning = !planFeas.isOk;

    return LiquidGlassPanel(
      padding: EdgeInsets.fromLTRB(14, 14, 14, hasWarning ? 12 : 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Text(
                  headline,
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface),
                ),
              ),
              Slider(
                value: avail <= 0 ? 0.0 : m.allocInvestFraction.clamp(0.0, 1.0),
                divisions: 20,
                onChanged: avail <= 0 ? null : m.setAllocInvestFraction,
              ),
              if (avail > 0)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _FlowAmount(
                        label: 'Savings',
                        amount: goalMoney(m, m.allocSavingsMonthly, hide: m.privacyHideAmounts),
                        accent: cs.secondary,
                        align: CrossAxisAlignment.start,
                      ),
                    ),
                    Expanded(
                      child: _FlowAmount(
                        label: 'Invest',
                        amount: goalMoney(m, m.allocInvestmentsMonthly, hide: m.privacyHideAmounts),
                        accent: m.accent,
                        align: CrossAxisAlignment.end,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          ZoroPlanStatusStrip(
            feasibility: planFeas,
            onAdjustRetirementDate: planFeas.needsDateAdjust
                ? () => m.pickRetirementTargetDate(context)
                : null,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final hide = m.privacyHideAmounts;
    final accent = m.accent;

    final retirement = m.retirementGoal;
    final policy = m.assetsGoalsPolicy;
    final savingsTotal = totalSavingsPoolBalance(
      assets: m.assets,
      displayValue: m.assetDisplayValue,
      policy: policy,
    );
    final savingsRows = savingsPoolAssets(m.assets, policy).toList()
      ..sort((a, b) => m.assetDisplayValue(b).compareTo(m.assetDisplayValue(a)));

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      children: [
        Row(
          children: [
            Text('Goals', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const Spacer(),
            IconButton.filledTonal(
              onPressed: () => openGoalsAiAssistant(
                context: context,
                model: m,
                onOpenSettings: onGoToSettingsPermissions,
              ),
              icon: const Icon(Icons.auto_awesome),
              tooltip: 'Goals assistant',
              style: IconButton.styleFrom(
                backgroundColor: m.accentSoft,
                foregroundColor: accent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _allocationSlider(context),
        const SizedBox(height: 12),
        _GoalsSection(
          title: 'Investments',
          subtitle: '',
          showSubtitle: false,
          children: [
            if (retirement == null)
              Text(
                'No retirement goal.',
                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
              )
            else
              _GoalTile(
                model: m,
                goal: retirement,
                accent: accent,
                hide: hide,
                onTap: () => openGoalEditorSheet(context: context, model: m, goalId: retirement.id),
              ),
          ],
        ),
        const SizedBox(height: 10),
        _GoalsSection(
          title: 'Savings',
          subtitle: savingsTotal > 0 || m.allocSavingsMonthly > 0
              ? '${goalMoney(m, savingsTotal, hide: hide)} · ${goalMoney(m, m.allocSavingsMonthly, hide: hide)}/mo'
              : '—',
          children: [
            if (savingsRows.isEmpty)
              Text(
                'Add savings accounts in Ledger, or link cash in Ledger → Cash.',
                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
              )
            else
              ...savingsRows.map(
                (a) => _SavingsAssetRow(model: m, asset: a, hide: hide),
              ),
            if (m.liabilities.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Loans', style: _GoalsType.sectionTitle.copyWith(color: cs.onSurface)),
              const SizedBox(height: 6),
              ...m.liabilities.map((l) {
                final liabilityId = l.id;
                return _LiabilityRow(
                  key: ValueKey<String>(liabilityId),
                  model: m,
                  liability: l,
                  hide: hide,
                  onTap: () => openGoalsPaydownSheet(
                    context: context,
                    model: m,
                    liabilityId: liabilityId,
                  ),
                );
              }),
            ],
          ],
        ),
      ],
    );
  }
}

class _FlowAmount extends StatelessWidget {
  const _FlowAmount({
    required this.label,
    required this.amount,
    required this.accent,
    required this.align,
  });

  final String label;
  final String amount;
  final Color accent;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: align,
      children: [
        Text(label, style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant)),
        Text('$amount/mo', style: _GoalsType.tileBody.copyWith(color: accent)),
      ],
    );
  }
}

class _GoalsSection extends StatelessWidget {
  const _GoalsSection({
    required this.title,
    required this.subtitle,
    required this.children,
    this.showSubtitle = true,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final bool showSubtitle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hasSubtitle = showSubtitle && subtitle.trim().isNotEmpty && subtitle != '—';
    return LiquidGlassPanel(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: _GoalsType.sectionTitle),
          if (hasSubtitle) ...[
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: _GoalsType.sectionSubtitle.copyWith(color: cs.onSurfaceVariant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          SizedBox(height: hasSubtitle ? 10 : 8),
          ...children,
        ],
      ),
    );
  }
}

class _SavingsAssetRow extends StatelessWidget {
  const _SavingsAssetRow({
    required this.model,
    required this.asset,
    required this.hide,
  });

  final AppModel model;
  final LedgerAssetRow asset;
  final bool hide;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final name = asset.name.trim().isEmpty ? asset.type.label : asset.name.trim();
    final balance = model.assetDisplayValue(asset);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(asset.type.icon, size: 20, color: cs.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(child: Text(name, style: _GoalsType.rowTitle)),
          Text(
            goalMoney(model, balance, hide: hide),
            style: _GoalsType.tileBody,
          ),
        ],
      ),
    );
  }
}

class _LiabilityRow extends StatelessWidget {
  const _LiabilityRow({
    super.key,
    required this.model,
    required this.liability,
    required this.hide,
    required this.onTap,
  });

  final AppModel model;
  final LedgerLiabilityRow liability;
  final bool hide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final pay = model.liabilityPaydownMonthly(liability);
    final payoff = goalLiabilityPayoffDateLabel(model, liability);
    final name = liability.name.trim().isEmpty ? liability.type.label : liability.name.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Icon(liability.type.icon, size: 20, color: cs.onSurfaceVariant),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: _GoalsType.rowTitle),
                    Text(
                      pay > 0
                          ? '${goalMoney(model, pay, hide: hide)}/mo${payoff != null ? ' · $payoff' : ''}'
                          : (payoff ?? 'Set paydown'),
                      style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 22, color: cs.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoalTile extends StatelessWidget {
  const _GoalTile({
    required this.model,
    required this.goal,
    required this.accent,
    required this.hide,
    required this.onTap,
  });

  final AppModel model;
  final FinancialGoal goal;
  final Color accent;
  final bool hide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final current = model.goalCurrentAmount(goal);
    final effectiveTarget = model.goalEffectiveTargetAmount(goal);
    final progress = effectiveTarget > 0
        ? (current / effectiveTarget).clamp(0.0, 1.0)
        : model.goalProgressFraction(goal);
    final feas = model.goalFeasibility(goal);
    final timeLabel = goalTimeToTargetLabel(goal.targetDate);
    final amountsLine = effectiveTarget > 0
        ? '${goalMoney(model, current, hide: hide)} → ${goalMoney(model, effectiveTarget, hide: hide)}'
        : goalMoney(model, current, hide: hide);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _RetirementLeadingIcon(
                    feasibility: feas,
                    accent: accent,
                    onAdjustRetirementDate: feas.needsDateAdjust
                        ? () => model.pickRetirementTargetDate(context)
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(child: Text('Retirement', style: _GoalsType.tileTitle)),
                            if (timeLabel.isNotEmpty)
                              Text(
                                timeLabel,
                                style: _GoalsType.rowMeta.copyWith(color: cs.onSurfaceVariant),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          amountsLine,
                          style: _GoalsType.tileMeta.copyWith(color: cs.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, size: 22, color: cs.onSurfaceVariant),
                ],
              ),
              const SizedBox(height: 8),
              GoalProgressBar(fraction: progress, accent: accent),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetirementLeadingIcon extends StatelessWidget {
  const _RetirementLeadingIcon({
    required this.feasibility,
    required this.accent,
    this.onAdjustRetirementDate,
  });

  final GoalFeasibility feasibility;
  final Color accent;
  final VoidCallback? onAdjustRetirementDate;

  @override
  Widget build(BuildContext context) {
    const box = 34.0;
    const iconSize = 26.0;

    if (!feasibility.isOk) {
      return SizedBox(
        width: box,
        height: box,
        child: Center(
          child: ZoroStatusIcon.fromGoalFeasibility(
            feasibility,
            size: iconSize,
            onAction: feasibility.needsDateAdjust ? onAdjustRetirementDate : null,
            actionLabel: feasibility.needsDateAdjust ? 'Adjust retirement date' : null,
          ),
        ),
      );
    }
    return SizedBox(
      width: box,
      height: box,
      child: Icon(Icons.trending_up, color: accent, size: iconSize),
    );
  }
}
