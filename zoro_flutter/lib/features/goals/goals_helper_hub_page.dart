import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'goals_expense_estimator_flow.dart';
import 'goals_structured_sections.dart';

Future<void> openGoalsHelperHub({
  required BuildContext context,
  required AppModel model,
}) async {
  model.ensureRetirementGoal();
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (ctx) => GoalsHelperHubPage(model: model),
    ),
  );
}

class GoalsHelperHubPage extends StatelessWidget {
  const GoalsHelperHubPage({super.key, required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    final m = model;
    final cs = Theme.of(context).colorScheme;
    final accent = m.accent;
    final now = DateTime.now();
    final needsExpenses = !m.userTouchedExpenses || m.recurringExpensesMonthly <= 0;
    final planAt = m.retirementPlanLastUpdatedAt();
    final lastLine = planAt == null
        ? 'Not updated yet'
        : 'Last updated ${goalsSectionLastUpdatedLabel(planAt, now: now) ?? "recently"}';
    final sections = goalsHelperSections(m);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Goals helper', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
            Text(
              lastLine,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cs.onSurfaceVariant),
            ),
          ],
        ),
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
              if (needsExpenses) ...[
                _ExpenseSetupCard(
                  model: m,
                  accent: accent,
                ),
                const SizedBox(height: 12),
              ],
              for (final s in sections) ...[
                _HelperSectionCard(
                  icon: s.icon,
                  title: s.title,
                  subtitle: s.subtitle,
                  stepCount: s.stepCount,
                  accent: accent,
                  onTap: () => s.onOpen(context),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ExpenseSetupCard extends StatelessWidget {
  const _ExpenseSetupCard({required this.model, required this.accent});

  final AppModel model;
  final Color accent;

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
    required this.stepCount,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int stepCount;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: LiquidGlassPanel(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(icon, size: 26, color: accent),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface)),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant, height: 1.3),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$stepCount step${stepCount == 1 ? "" : "s"}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent),
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
