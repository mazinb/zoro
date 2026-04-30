import 'package:flutter/material.dart';

/// Ids for built-in app agents (keep in sync with [kInternalAppAgentDefinitions]).
abstract final class InternalAppAgentIds {
  static const assetContext = 'asset_context';
  static const liabilityContext = 'liability_context';
  static const expenseBucketContext = 'expense_bucket_context';
  static const monthCashflowContext = 'month_cashflow_context';
  static const contextOrchestrator = 'context_orchestrator';

  static const ledgerAddAssets = 'ledger_add_assets';
  static const ledgerAddLiabilities = 'ledger_add_liabilities';
  static const ledgerAddActualExpenses = 'ledger_add_actual_expenses';
  static const ledgerAllocationAdvisor = 'ledger_allocation_advisor';
  static const ledgerIncomeUpdater = 'ledger_income_updater';
  static const ledgerOrchestrator = 'ledger_orchestrator';
}

/// Registry entry for Settings → App agents. Add rows here to surface new internal agents.
class InternalAppAgentDefinition {
  const InternalAppAgentDefinition({
    required this.id,
    required this.title,
    required this.listSubtitle,
    required this.icon,
    required this.defaultSystemPrompt,
    required this.infoWhatItDoes,
    required this.infoDataYouProvide,
    required this.modelDomainHints,
  });

  final String id;
  final String title;
  final String listSubtitle;
  final IconData icon;
  final String defaultSystemPrompt;
  final String infoWhatItDoes;
  final String infoDataYouProvide;
  /// Extra hints appended for the model (planner + writer), after the user’s custom prompt.
  final String modelDomainHints;
}

const kInternalAppAgentDefinitions = <InternalAppAgentDefinition>[
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerOrchestrator,
    title: 'Ledger helper (orchestrator)',
    listSubtitle: 'Ledger → AI button',
    icon: Icons.auto_awesome,
    defaultSystemPrompt: '''
You are the main Ledger helper. Your job is to look at all ledger data and decide what the user should do next.

You do NOT edit the ledger directly. You only decide which specialized helper to run:
- Add assets
- Add liabilities
- Add actual expenses for a month
- Allocation advisor
- Income updater

Be practical. Prefer the smallest next step that improves accuracy.
''',
    infoWhatItDoes: 'Looks at your ledger and picks the best next helper to run.',
    infoDataYouProvide: 'All ledger rows (income, expenses, assets, liabilities, allocations). Uses your API key.',
    modelDomainHints: '''
Return a clear recommendation in plain language. If you need the user to fill numbers, choose the matching helper.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddAssets,
    title: 'Ledger: add assets',
    listSubtitle: 'Ledger → assets',
    icon: Icons.savings_outlined,
    defaultSystemPrompt: '''
You help the user add or update assets in the ledger. Ask only for numbers you need.

Show old values when available. If the user is unsure, propose a reasonable way to estimate and label it as an estimate.
After numbers are updated, write a short context note that explains what the asset is and where the value comes from.
''',
    infoWhatItDoes: 'Guides adding/updating assets using numbers, then writes a short note.',
    infoDataYouProvide: 'Existing assets list (if any), plus the user’s new numbers.',
    modelDomainHints: 'Asset types: savings, brokerage, property, crypto, other.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddLiabilities,
    title: 'Ledger: add liabilities',
    listSubtitle: 'Ledger → liabilities',
    icon: Icons.credit_card_outlined,
    defaultSystemPrompt: '''
You help the user add or update debts in the ledger. Ask only for numbers you need.

Show old values when available. Capture: balance, rate (if known), minimum payment (if known), and payment timing.
Then write a short context note that explains the terms.
''',
    infoWhatItDoes: 'Guides adding/updating debts using numbers, then writes a short note.',
    infoDataYouProvide: 'Existing liabilities list (if any), plus the user’s new numbers.',
    modelDomainHints: 'Debt types: loan, credit card, mortgage, other.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddActualExpenses,
    title: 'Ledger: add actual expenses',
    listSubtitle: 'Ledger → cashflow → expenses',
    icon: Icons.receipt_long,
    defaultSystemPrompt: '''
You help the user fill in actual monthly spending for a month.

Explain the model simply:
- Opening cash
- Closing cash
- Investments added (money moved into brokerage/investments)
- Allocations (savings vs investments targets)

Ask for the missing numbers only. Then summarize what changed that month in a short note.
''',
    infoWhatItDoes: 'Helps fill a month’s actual spending with only the needed numbers.',
    infoDataYouProvide: 'The month and any existing cashflow entry, plus the user’s updated numbers.',
    modelDomainHints: 'Keep the explanation short. Ask 1–3 numeric questions max per step.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAllocationAdvisor,
    title: 'Ledger: allocation advisor',
    listSubtitle: 'Ledger → cashflow → allocations',
    icon: Icons.swap_vert,
    defaultSystemPrompt: '''
You help pick a monthly allocation between savings and investments.

General rule:
- If the user has high-interest loans or tight cashflow, prefer higher savings / debt payoff over investing.
- Otherwise, investing is usually preferred once an emergency fund is covered.

Be clear and pick one recommended split with a short reason.
''',
    infoWhatItDoes: 'Recommends a savings vs investments split.',
    infoDataYouProvide: 'Income, expenses, liabilities, and current allocations.',
    modelDomainHints: 'If loan rates are unknown, ask once (optional) or give a conservative default.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerIncomeUpdater,
    title: 'Ledger: income updater',
    listSubtitle: 'Ledger → cashflow → income',
    icon: Icons.payments_outlined,
    defaultSystemPrompt: '''
You help keep income up to date. Ask for the smallest set of numbers needed (annual salary, bonus, other income).

Show existing values first, then ask what changed. Keep it quick.
''',
    infoWhatItDoes: 'Updates income lines with minimal questions.',
    infoDataYouProvide: 'Existing income lines and the user’s updated amounts.',
    modelDomainHints: 'Prefer annual amounts; convert only if needed.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.assetContext,
    title: 'Asset context',
    listSubtitle: 'Context → asset notes (AI)',
    icon: Icons.savings_outlined,
    defaultSystemPrompt: '''
You help write clear notes for one asset so the app and chat understand it.

Be helpful: do the math when it helps. For brokerage accounts, YOU reconcile first: add up what the user already described and compare to the account total. Do not ask “does this add up?” — show the math, then only ask about what is missing. Example: “You described about \$225k of \$350k here — where is the rest invested?”

- Savings: bank, rate if known, what the cash is for.
- Property: how you value it, ownership, mortgage if any.
- Crypto: where it lives, main holdings.
- Other: what it is, how you value it, how often you update it.
''',
    infoWhatItDoes:
        'Asks a few quick questions (taps + optional typing), then updates your asset note. Skips questions if your note is already enough.',
    infoDataYouProvide:
        'The asset name, type, and balance from your ledger, plus any note you already wrote. Uses your API key from Settings.',
    modelDomainHints: '''
Asset types:
- brokerage: cash vs investments split; reconcile explained amounts to the ledger total before asking follow-ups.
- savings, property, crypto, other: capture the basics above in plain language.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.liabilityContext,
    title: 'Liability context',
    listSubtitle: 'Context → loan or card notes (AI)',
    icon: Icons.credit_card_outlined,
    defaultSystemPrompt: '''
You help write clear notes for one debt (loan, card, mortgage) so the app understands terms and payments.

Include when known: lender, balance source, interest rate (fixed or variable), payment amount and timing, length of loan or payoff plan. Keep numbers consistent with the balance on the ledger. Do the math when comparing payment to balance; ask only about gaps.
''',
    infoWhatItDoes:
        'Short questions, then updates your liability note. Skips questions if the note is already complete enough.',
    infoDataYouProvide:
        'Debt type, name, and balance from your ledger, plus any note you wrote. Uses your API key from Settings.',
    modelDomainHints: '''
Debt types: personal loan, car, card, mortgage, other. Prioritize rate, minimum payment, due rhythm, and anything special (intro rate, balloon).
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.expenseBucketContext,
    title: 'Expense bucket context',
    listSubtitle: 'Context → budget bucket notes (AI)',
    icon: Icons.pie_chart_outline,
    defaultSystemPrompt: '''
You help explain what belongs in one expense bucket (e.g. housing, food) so future you and the app stay consistent.

Cover: what counts in this bucket, what does not, and what usually moves the number up or down (seasonality, yearly bills). Keep it practical, not long.
''',
    infoWhatItDoes:
        'A few questions about this budget line, then a cleaner note. Skips questions if your note is already clear.',
    infoDataYouProvide:
        'The bucket name and your monthly estimate from the app, plus any note you wrote. Uses your API key from Settings.',
    modelDomainHints: '''
Focus on boundaries (“counts / doesn’t count”), lumpiness, and typical one-offs.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.monthCashflowContext,
    title: 'Month context',
    listSubtitle: 'Context → monthly cashflow note (AI)',
    icon: Icons.calendar_month_outlined,
    defaultSystemPrompt: '''
You help explain what happened in one calendar month for cashflow: big one-offs, trips, income changes, or anything that should carry into next month.

Stay short and specific. Tie numbers to the month when the user mentions them.
''',
    infoWhatItDoes:
        'Questions about that month, then a tighter note. Skips questions if you already said enough.',
    infoDataYouProvide:
        'The month label and spending/cashflow entries if any, plus your note. Uses your API key from Settings.',
    modelDomainHints: '''
Month notes: one-offs, income changes, “remember for next month”, irregular bills.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.contextOrchestrator,
    title: 'Context helper (orchestrator)',
    listSubtitle: 'Context → AI button',
    icon: Icons.auto_awesome,
    defaultSystemPrompt: '''
You are the main Context helper. Your job is to look at the user’s context notes and decide what to update next.

Prefer the one note that would most improve planning: missing brokerage breakdown, missing loan rate/payment, unclear bucket boundaries, or a recent month with no note.
Keep it simple and pick ONE target.
''',
    infoWhatItDoes: 'Looks at all context notes and points you to the one best next update.',
    infoDataYouProvide: 'All context notes (assets, liabilities, buckets, months) + last updated times.',
    modelDomainHints: 'Return one target and a short reason.',
  ),
];

InternalAppAgentDefinition? internalAppAgentDefinitionById(String id) {
  for (final d in kInternalAppAgentDefinitions) {
    if (d.id == id) return d;
  }
  return null;
}
