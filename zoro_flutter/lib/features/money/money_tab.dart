import 'package:flutter/material.dart';

import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';
import 'expenses_ai_card.dart';

class MoneyTab extends StatelessWidget {
  const MoneyTab({super.key, required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          const Material(
            color: Colors.white,
            child: TabBar(
              labelColor: AppTheme.primaryBlue,
              unselectedLabelColor: AppTheme.slate600,
              tabs: [
                Tab(text: 'Income'),
                Tab(text: 'Expenses'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _IncomePane(session: session),
                _ExpensesPane(session: session),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IncomePane extends StatelessWidget {
  const _IncomePane({required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        Text(
          'Income',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppTheme.slate900,
          ),
        ),
        SizedBox(height: 8),
        Text(
          'Match web /income — manual entry and /api/income/parse-statement will plug in here. v1 is a placeholder.',
          style: TextStyle(color: AppTheme.slate600),
        ),
      ],
    );
  }
}

class _ExpensesPane extends StatelessWidget {
  const _ExpensesPane({required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Expenses',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: AppTheme.slate900,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Manual buckets and monthly actuals will mirror the web expenses flow. AI import uses your existing backend.',
          style: TextStyle(color: AppTheme.slate600),
        ),
        const SizedBox(height: 20),
        ExpensesAiCard(session: session),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Manual entry: use /api/expenses/estimates and /api/expenses/monthly from the web app as reference for the next iteration.',
              style: TextStyle(color: AppTheme.slate600.withValues(alpha: 0.9)),
            ),
          ),
        ),
      ],
    );
  }
}
