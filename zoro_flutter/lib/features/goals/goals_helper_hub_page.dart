import 'package:flutter/material.dart';

import '../../core/finance/goals_calculator.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goal_widgets.dart';
import 'goals_expense_estimator_flow.dart';
import 'goals_structured_sections.dart';

Future<void> openGoalsHelperHub({
  required BuildContext context,
  required AppModel model,
  VoidCallback? onOpenSettings,
}) async {
  model.ensureRetirementGoal();
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => GoalsHelperHubPage(model: model, onOpenSettings: onOpenSettings),
    ),
  );
}

class GoalsHelperHubPage extends StatelessWidget {
  const GoalsHelperHubPage({super.key, required this.model, this.onOpenSettings});

  final AppModel model;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final accent = m.accent;
    final now = DateTime.now();
    final retirement = m.retirementGoal;
    final feas = retirement == null ? null : m.retirementInvestFeasibility(retirement);
    final needsExpenses = !m.userTouchedExpenses || m.recurringExpensesMonthly <= 0;
    final corpus = retirement == null ? 0.0 : m.goalEffectiveTargetAmount(retirement);
    final investPct = (m.allocInvestFraction * 100).round();

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Goals helper', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [cs.surface, accent.withValues(alpha: 0.08)],
          ),
        ),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              Text(
                'Pick a section. Each uses short choices; add a note only if you want the assistant to refine the result.',
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
              ),
              if (retirement != null) ...[
                const SizedBox(height: 12),
                LiquidGlassPanel(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Icon(Icons.schedule, size: 20, color: accent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _planUpdatedLine(m, now),
                          style: TextStyle(fontWeight: FontWeight.w700, color: cs.onSurface, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (needsExpenses) ...[
                const SizedBox(height: 12),
                _ExpenseSetupCard(
                  model: m,
                  accent: accent,
                  onOpenSettings: onOpenSettings,
                ),
              ],
              const SizedBox(height: 16),
              _HelperSectionCard(
                icon: Icons.beach_access_outlined,
                title: 'Retirement corpus',
                subtitle: corpus > 0
                    ? '${goalMoney(m, corpus)} target · ${goalsSectionLastUpdatedLabel(m.retirementCorpusLastUpdated, now: now) ?? "not set yet"}'
                    : 'SWR, buffer, and expense-linked corpus',
                accent: accent,
                onTap: () => openCorpusStructuredGuide(context: context, model: m),
              ),
              const SizedBox(height: 10),
              _HelperSectionCard(
                icon: Icons.pie_chart_outline,
                title: 'Invest vs savings & date',
                subtitle: _splitSubtitle(m, feas, investPct, now),
                accent: accent,
                statusIcon: _feasIcon(feas),
                onTap: () => openSplitStructuredGuide(context: context, model: m),
              ),
              const SizedBox(height: 10),
              _HelperSectionCard(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Assets & savings',
                subtitle:
                    '${m.retirementExtraAssetIds.length} extra in corpus · ${goalsSectionLastUpdatedLabel(m.retirementBucketsLastUpdated, now: now) ?? "not set yet"}',
                accent: accent,
                onTap: () => openBucketsStructuredGuide(context: context, model: m),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _planUpdatedLine(AppModel m, DateTime now) {
    final at = m.retirementPlanLastUpdatedAt();
    if (at == null) return 'Retirement plan not updated yet';
    final rel = goalsSectionLastUpdatedLabel(at, now: now) ?? 'recently';
    final unacked = m.goalsPlanHasUnacknowledgedUpdates(now: now);
    if (unacked) return 'Plan updated $rel · review sections below';
    return 'Last plan change $rel';
  }

  String _splitSubtitle(AppModel m, GoalFeasibility? feas, int investPct, DateTime now) {
    final date = goalDateLabel(m.retirementGoal?.targetDate);
    final updated = goalsSectionLastUpdatedLabel(m.allocationTargetLastUpdated, now: now);
    final status = feas == null ? '' : '${feas.title} · ';
    return '$status$investPct% invest · $date${updated != null ? " · $updated" : ""}';
  }

  IconData? _feasIcon(GoalFeasibility? feas) {
    if (feas == null) return null;
    return switch (feas.level) {
      GoalFeasibilityLevel.ok => Icons.check_circle_outline,
      GoalFeasibilityLevel.caution => Icons.warning_amber_outlined,
      GoalFeasibilityLevel.broken => Icons.error_outline,
    };
  }
}

class _ExpenseSetupCard extends StatelessWidget {
  const _ExpenseSetupCard({required this.model, required this.accent, this.onOpenSettings});

  final AppModel model;
  final Color accent;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final r = model.retirementGoal;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: r == null
            ? null
            : () => openGoalExpenseEstimator(context: context, model: model, goalId: r.id),
        child: LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(Icons.receipt_long_outlined, color: accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Set up expenses first', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                    const SizedBox(height: 4),
                    Text(
                      'Corpus needs monthly expense estimates from Ledger.',
                      style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _HelperSectionCard extends StatelessWidget {
  const _HelperSectionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
    this.statusIcon,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;
  final IconData? statusIcon;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: LiquidGlassPanel(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: accent.withValues(alpha: 0.15),
                child: Icon(icon, color: accent, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: cs.onSurface)),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, height: 1.35),
                    ),
                  ],
                ),
              ),
              if (statusIcon != null) ...[
                Icon(statusIcon, size: 22, color: accent),
                const SizedBox(width: 4),
              ],
              Icon(Icons.chevron_right, color: cs.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
