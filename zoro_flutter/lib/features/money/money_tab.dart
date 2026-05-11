import 'package:flutter/material.dart';

import 'expenses_ai_card.dart';

class MoneyTab extends StatelessWidget {
  const MoneyTab({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Material(
            color: scheme.surface,
            child: TabBar(
              labelColor: scheme.primary,
              unselectedLabelColor: scheme.onSurfaceVariant,
              tabs: const [
                Tab(text: 'Income'),
                Tab(text: 'Expenses'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                const _IncomePane(),
                const _ExpensesPane(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IncomePane extends StatelessWidget {
  const _IncomePane();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Income',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: scheme.onSurface,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Match web /income — manual entry and /api/income/parse-statement will plug in here. v1 is a placeholder.',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _ExpensesPane extends StatelessWidget {
  const _ExpensesPane();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Expenses',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: scheme.onSurface,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Manual buckets and monthly actuals will mirror the web expenses flow. AI import uses your existing backend.',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 20),
        const ExpensesAiCard(),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Manual entry: use /api/expenses/estimates and /api/expenses/monthly from the web app as reference for the next iteration.',
              style: TextStyle(color: scheme.onSurfaceVariant.withValues(alpha: 0.95)),
            ),
          ),
        ),
      ],
    );
  }
}
