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
  static const ledgerOrchestrator = 'ledger_orchestrator';
  static const ledgerReviewAsset = 'ledger_review_asset';
  static const ledgerReviewLiability = 'ledger_review_liability';
  static const contextReviewAsset = 'context_review_asset';
  static const contextReviewLiability = 'context_review_liability';

  /// Legacy id — custom prompts may still exist in saved state; no built-in definition.
  static const goalsGuide = 'goals_guide';
  static const goalsRetirementCorpus = 'goals_retirement_corpus';
  static const goalsRetirementSplit = 'goals_retirement_split';
  static const goalsRetirementBuckets = 'goals_retirement_buckets';
  static const goalsExpenseEstimator = 'goals_expense_estimator';

  static const exportSanitizer = 'export_sanitizer';
}

/// Registry entry for Settings → App helpers. Add rows here to surface new built-in helpers.
class InternalAppAgentDefinition {
  const InternalAppAgentDefinition({
    required this.id,
    required this.title,
    required this.listSubtitle,
    required this.icon,
    required this.defaultSystemPrompt,
    required this.infoWhatItDoes,
    required this.infoContextSent,
    this.modelDomainHints = '',
  });

  final String id;
  final String title;
  final String listSubtitle;
  final IconData icon;

  /// Editable instruction text shown to the user. Never includes JSON contracts —
  /// the JSON output spec is owned by the calling page (kept in app code).
  final String defaultSystemPrompt;

  final String infoWhatItDoes;

  /// Plain-language description of the data that gets attached to the user
  /// message when the agent runs. Surfaced in the editor so the user can
  /// understand exactly what the model sees.
  final String infoContextSent;

  /// Extra hints appended for the model (planner + writer), after the user’s custom prompt.
  final String modelDomainHints;
}

const kInternalAppAgentDefinitions = <InternalAppAgentDefinition>[
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerOrchestrator,
    title: 'Ledger helper',
    listSubtitle: 'Ledger → Cash tab → help',
    icon: Icons.auto_awesome,
    defaultSystemPrompt: '''
You compare six completed months of actual spending to the user's recurring expense estimates.

Use the six-month average as the benchmark. Suggest higher or lower monthly bucket amounts when estimates look off. Keep advice practical and specific.
''',
    infoWhatItDoes:
        'Cash tab helper: compares 6 months of actuals to estimates and suggests updated monthly buckets with Apply.',
    infoContextSent:
        'Six completed months of spending, current expense bucket estimates, and totals in display currency.',
    modelDomainHints: 'Return expenseBuckets with all keys from payload.bucketKeys.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerReviewAsset,
    title: 'Review assets',
    listSubtitle: 'Ledger → Assets → helper',
    icon: Icons.fact_check_outlined,
    defaultSystemPrompt: '''
Review each asset against its context note when one exists.

- Green when context explains the holdings and dollar amounts match the ledger total.
- Yellow when amounts in context do not match the total or the breakdown is thin.
- Red only when context amounts are impossible vs the balance.

Cash-linked accounts and cashflow balance changes are handled in the app — do not use them here.
''',
    infoWhatItDoes:
        'Checks each asset against its context note (amounts and breakdown). Skips cash-linked accounts.',
    infoContextSent: 'Per asset: name, type, balance, comment, and context note when present.',
    modelDomainHints: '',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerReviewLiability,
    title: 'Review liabilities',
    listSubtitle: 'Ledger → Liabilities → helper',
    icon: Icons.fact_check_outlined,
    defaultSystemPrompt: '''
Review each liability against its context note when one exists.

- Green when the note explains the loan and amounts match the ledger balance.
- Yellow when context amounts disagree with the balance or the note is too thin.
- Do not flag issues just because the title and context use different words (e.g. Condo vs mortgage).
- Red only when context amounts are impossible vs the balance.

Interest rate on the ledger card and cashflow paydowns are handled separately.
''',
    infoWhatItDoes:
        'Checks each liability context note for amount consistency — not naming or rate.',
    infoContextSent: 'Per liability: name, type, balance, rate, comment, and context note.',
    modelDomainHints: '',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddAssets,
    title: 'Import assets',
    listSubtitle: 'Ledger → assets → import',
    icon: Icons.savings_outlined,
    defaultSystemPrompt: '''
You extract ASSET rows from the file the user uploads (statement, screenshot, spreadsheet, photo).

Be precise:
- Read totals exactly as shown. Strip currency symbols and thousands separators (e.g. "\$12,345.67" → 12345.67).

ONE ROW PER ACCOUNT (critical):
- Treat each brokerage / bank / institution account as ONE asset row. The row total is the **account-level total** (all holdings combined when the statement shows a single account total).
- If the document lists many positions **inside one brokerage account**, do NOT create one row per stock/fund. Put position-level detail in **contextMarkdown** (bullet breakdown: symbol, name, value). Keep **total** = the account total shown on the statement.
- Include the **broker or institution short name in `name`** when visible (e.g. "Fidelity — Brokerage", "Schwab IRA", "Chase Savings"). Prefer the broker name + account type over a generic label.

**comment** vs **contextMarkdown** (both matter):
- **comment**: Short ledger-card note — how this was imported, **statement or screenshot date** if visible, source type (e.g. "PDF statement May 2026"). High-level only.
- **contextMarkdown**: Richer note — what is **in** that account: asset mix, major holdings, breakdown text, currency notes. Use markdown lists where helpful.

Pick the closest type: savings, investments, property, other (brokerage/crypto → investments).
Guess currencyCountry from the document; fall back to "US" only if nothing hints otherwise.

If the user is adding new rows and a row duplicates an existing asset (same institution account), skip or merge into one row as appropriate.
''',
    infoWhatItDoes:
        'Reads the uploaded file (image / PDF) and extracts new asset rows for the ledger.',
    infoContextSent:
        'The file the user picked (image bytes or PDF) plus the existing asset list (name, type, total) so duplicates can be skipped.',
    modelDomainHints:
        'Asset types: savings, investments, property, other.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddLiabilities,
    title: 'Import liabilities',
    listSubtitle: 'Ledger → liabilities → import',
    icon: Icons.credit_card_outlined,
    defaultSystemPrompt: '''
You extract LIABILITY rows from the file the user uploads (loan statement, credit card bill, mortgage doc).

Be precise:
- Use the current outstanding balance (not original principal). Strip currency symbols and separators.
- One row per debt account.
- Pick the closest type: personal_loan, car_loan, credit_card, mortgage, other.
- Use a short, human "name" (e.g. "Citi Card", "HDFC Mortgage").
- Guess currencyCountry from the document; fall back to "US" only if nothing in the file hints otherwise.
- For each row, write a one-line "comment" the user will see in the ledger card. Include rate or minimum payment if visible.

If a row is duplicated by an existing liability (matching name + type + close balance), skip it.
''',
    infoWhatItDoes:
        'Reads the uploaded file (image / PDF) and extracts new liability rows for the ledger.',
    infoContextSent:
        'The file the user picked (image bytes or PDF) plus the existing liability list (name, type, total) so duplicates can be skipped.',
    modelDomainHints:
        'Liability types: personal_loan, car_loan, credit_card, mortgage, other.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.ledgerAddActualExpenses,
    title: 'Import monthly cashflow',
    listSubtitle: 'Ledger → cashflow → import',
    icon: Icons.receipt_long,
    defaultSystemPrompt: '''
You extract one MONTHLY cashflow snapshot from the file (bank statement, spreadsheet, screenshot, PDF).

Infer **monthKey** ("YYYY-MM") from the statement period / headers / filename — not from app UI.

**Credits and monthlyEarned (critical):**
- Statements often include a **period summary** for money in vs money out: total credits / total debits, counts, or equivalent wording — labels differ by bank and language, so infer the **money-IN total** from headers and layout, not only English phrases.
- **monthlyEarned** = credits that represent **earned inflow**: wages, salary, payroll, benefits, business or freelance receipts, client/customer payments, and similar — sum the **credit / deposit / incoming** side of the transaction list where those apply.
- **Exclude** from monthlyEarned only when a credit is clearly **not** earned income (e.g. transfer from own other account, loan principal disbursed to this account, error reversal paired with a debit) — list each exclusion in **assumptions**.
- **Do not** set monthlyEarned to 0 when the statement shows **positive total credits** or multiple incoming lines unless every such line is explicitly non-earned in assumptions. If line-level classification is ambiguous but the **total credits** (or sum of credit-column amounts) is clear, set monthlyEarned to **that total minus** credits you flagged as non-earned.
- Cross-check: openingBalance + (sum of credits) − (sum of debits) ≈ closingBalance within small rounding; if off, explain in assumptions.

**Outflows (unchanged intent):**
- outflowToInvested: only flows clearly labeled or obviously for brokerage/investment funding
- outflowToCashFd: savings / FD-type moves if distinct
- monthlySpending: spending and **generic transfers/bill pays** unless clearly investment (unspecified outbound transfers → spending side, not invested)

**comment**: one line — PDF vs screenshot/export, bank name if known, statement period.
**contextMarkdown**: terse bullets — **largest expenses and outbound transfers only**; do not narrate income here.

Strip currency symbols. Use 0 for unknowns and note in "assumptions".
''',
    infoWhatItDoes:
        'Reads the uploaded file (image / PDF) and extracts one month\'s cashflow snapshot.',
    infoContextSent:
        'The file plus optional nearby months from the app for context (month key always inferred from the document).',
    modelDomainHints:
        'Use 0 (not null) for missing numbers; classify transfers tightly — invested only when explicit. monthlyEarned must reflect income-like incoming totals; use the statement period summary when line items are messy.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.assetContext,
    title: 'Asset context',
    listSubtitle: 'Context → assets',
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
        'Updates your asset note from uploads or a direct refresh (no question flow).',
    infoContextSent:
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
    listSubtitle: 'Context → liabilities',
    icon: Icons.credit_card_outlined,
    defaultSystemPrompt: '''
You help write clear notes for one debt (loan, card, mortgage) so the app understands terms and payments.

Include when known: lender, balance source, interest rate (fixed or variable), payment amount and timing, length of loan or payoff plan. Keep numbers consistent with the balance on the ledger. Do the math when comparing payment to balance; ask only about gaps.
''',
    infoWhatItDoes:
        'Updates your liability note from uploads or a direct refresh (no question flow).',
    infoContextSent:
        'Debt type, name, and balance from your ledger, plus any note you wrote. Uses your API key from Settings.',
    modelDomainHints: '''
Debt types: personal loan, car, card, mortgage, other. Prioritize rate, minimum payment, due rhythm, and anything special (intro rate, balloon).
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.expenseBucketContext,
    title: 'Expense bucket context',
    listSubtitle: 'Context → estimates',
    icon: Icons.pie_chart_outline,
    defaultSystemPrompt: '''
You help explain what belongs in one expense bucket (e.g. housing, food) so future you and the app stay consistent.

Cover: what counts in this bucket, what does not, and what usually moves the number up or down (seasonality, yearly bills). Keep it practical, not long.
''',
    infoWhatItDoes:
        'A few questions about this budget line, then a cleaner note. Skips questions if your note is already clear.',
    infoContextSent:
        'The bucket name and your monthly estimate from the app, plus any note you wrote. Uses your API key from Settings.',
    modelDomainHints: '''
Focus on boundaries (“counts / doesn’t count”), lumpiness, and typical one-offs.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.monthCashflowContext,
    title: 'Month context',
    listSubtitle: 'Context → actuals',
    icon: Icons.calendar_month_outlined,
    defaultSystemPrompt: '''
You help explain what happened in one calendar month for cashflow: big one-offs, trips, income changes, or anything that should carry into next month.

Stay short and specific. Tie numbers to the month when the user mentions them.
''',
    infoWhatItDoes:
        'Questions about that month, then a tighter note. Skips questions if you already said enough.',
    infoContextSent:
        'The month label and spending/cashflow entries if any, plus your note. Uses your API key from Settings.',
    modelDomainHints: '''
Month notes: one-offs, income changes, “remember for next month”, irregular bills.
''',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.contextOrchestrator,
    title: 'Context helper',
    listSubtitle: 'Context → help',
    icon: Icons.auto_awesome,
    defaultSystemPrompt: '''
You are the Context helper. Assume ledger balances and comments are already correct.

For each asset and liability, say what is missing or wrong in the **context note** only — breakdowns, rates, payment rhythm, what the money is for.

Be specific enough that the user knows what to add. Do not ask the user to change ledger totals.
''',
    infoWhatItDoes:
        'Reviews all asset and liability context notes in parallel and flags what to add or fix.',
    infoContextSent:
        'Per row: ledger snapshot (read-only), existing context markdown, last updated time.',
    modelDomainHints: '',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.contextReviewAsset,
    title: 'Review asset context',
    listSubtitle: 'Context → assets (helper)',
    icon: Icons.fact_check_outlined,
    defaultSystemPrompt: '''
Improve the context note for one asset. Ledger balance is correct.

Explain holdings, institution, and how dollar amounts in the note sum to the ledger total. Flag under/over amounts in context only.
''',
    infoWhatItDoes: 'Parallel review of asset context notes with suggested updates.',
    infoContextSent: 'Asset ledger fields + existing context markdown.',
    modelDomainHints: '',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.contextReviewLiability,
    title: 'Review liability context',
    listSubtitle: 'Context → liabilities (helper)',
    icon: Icons.fact_check_outlined,
    defaultSystemPrompt: '''
Improve the context note for one debt. Ledger balance and rate field are correct.

Capture lender, rate terms, payment amount and timing, and anything special (intro rate, balloon).
''',
    infoWhatItDoes: 'Parallel review of liability context notes with suggested updates.',
    infoContextSent: 'Liability ledger fields + existing context markdown.',
    modelDomainHints: '',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.goalsRetirementCorpus,
    title: 'Retirement corpus',
    listSubtitle: 'Goals → retirement corpus',
    icon: Icons.beach_access_outlined,
    defaultSystemPrompt: '''
You help set retirement corpus assumptions using recurring monthly expenses from the ledger.

Questions (planner):
- Confirm safe withdrawal rate (1–10%, default 4%).
- Confirm buffer percent (0–100% on top of base corpus).
- Confirm using auto corpus from all recurring expense buckets.
- Stop when SWR, buffer, and intent are clear.

Synthesis (structured block required):
{
  "summary": "one short sentence",
  "safeWithdrawalRatePct": 4,
  "corpusBufferPct": 0,
  "corpusAutoFromExpenses": true,
  "targetAmount": 0,
  "contextMarkdown": "assumptions (markdown)"
}

targetAmount = annual recurring expenses × 12 ÷ (SWR/100) × (1 + buffer/100). Use payload recurringExpensesMonthly.
''',
    infoWhatItDoes: 'MCQ for safe withdrawal rate and corpus buffer; computes corpus from ledger expenses.',
    infoContextSent: 'Recurring monthly expenses, current SWR/buffer, computed corpus preview.',
    modelDomainHints: 'Planner: max 5 questions. Synth: include all structured fields.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.goalsRetirementSplit,
    title: 'Invest & retire date',
    listSubtitle: 'Goals → invest split & date',
    icon: Icons.pie_chart_outline,
    defaultSystemPrompt: '''
Refine invest vs savings split and retirement target date when the user added an optional note.
Use payload answers (MCQ selections) and optionalNote. Do not change expense buckets or corpus SWR unless the note requires it.

Return JSON only:
{
  "summary": "one short sentence",
  "allocInvestFraction": 0.6,
  "goalUpdates": [
    { "goalId": "<focusGoalId>", "targetDate": "YYYY-MM-DD" }
  ],
  "contextMarkdown": "optional assumptions"
}

allocInvestFraction is 0–1 share of availableAfterExpensesMonthly to investments.
Only include goalUpdates when changing targetDate for focusGoalId.
''',
    infoWhatItDoes: 'Optional LLM pass when the user adds a note on the invest/savings & date section.',
    infoContextSent: 'Current split, required monthly savings, retire-by date, and MCQ answers.',
    modelDomainHints: 'Synth only — user already answered fixed MCQs.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.goalsRetirementBuckets,
    title: 'Assets & savings',
    listSubtitle: 'Goals → retirement extras & savings weights',
    icon: Icons.account_balance_wallet_outlined,
    defaultSystemPrompt: '''
Refine which property/other assets count toward retirement and savings goal weights when the user added an optional note.

Return JSON only:
{
  "summary": "one short sentence",
  "retirementExtraAssetIds": ["<asset id>", "..."],
  "rebalanceSavings": true,
  "evenSavings": false,
  "contextMarkdown": "optional"
}

Use asset ids from payload.assets. Investment accounts already count toward retirement by default.
''',
    infoWhatItDoes: 'Optional LLM pass for retirement asset inclusion and savings pool weighting.',
    infoContextSent: 'Ledger assets, current retirementExtraAssetIds, target goal weights, MCQ answers.',
    modelDomainHints: 'Synth only — deterministic apply when optional note is empty.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.goalsExpenseEstimator,
    title: 'Goal expense estimator',
    listSubtitle: 'Goals → estimate expenses',
    icon: Icons.receipt_long_outlined,
    defaultSystemPrompt: '''
You estimate monthly expense bucket amounts for the user's lifestyle, tied to a financial goal.

Questions (planner):
- Lifestyle level, household size, location hints if missing.
- Which expense buckets to adjust (multi-select from payload bucketKeys).
- Stop when you can propose realistic monthly amounts.

Synthesis (structured block required):
{
  "summary": "one short sentence",
  "expenseBuckets": { "housing": 0, "food": 0 },
  "contextMarkdown": "assumptions for the goal (markdown)"
}

Only include bucket keys from payload.bucketKeys. Amounts are monthly in display currency.
''',
    infoWhatItDoes: 'AI proposes monthly expense bucket estimates; user reviews before updating the ledger.',
    infoContextSent: 'Goal name/kind, current bucket estimates, recurring total — compact, no full asset list.',
    modelDomainHints: 'Planner: max 5 questions. Synth: expenseBuckets object with proposed monthly values.',
  ),
  InternalAppAgentDefinition(
    id: InternalAppAgentIds.exportSanitizer,
    title: 'Export redaction',
    listSubtitle: 'Settings → Data → redact before export',
    icon: Icons.shield_outlined,
    defaultSystemPrompt: '''
Redact bank names, brokerage names, account numbers, and other identifying financial institution details from exported text fields (names, labels, comments, context notes).

Keep numeric amounts, dates, stable row ids, and structure unchanged. Use neutral placeholders such as "Bank A" or "Investment account" where a label must remain readable.
''',
    infoWhatItDoes: 'Optional pass before saving an export — scrubs institution names from string fields.',
    infoContextSent: 'The full export document as text (structure preserved).',
    modelDomainHints: '',
  ),
];

InternalAppAgentDefinition? internalAppAgentDefinitionById(String id) {
  for (final d in kInternalAppAgentDefinitions) {
    if (d.id == id) return d;
  }
  return null;
}

/// Human-friendly "x min ago" rendering of when an internal agent last ran.
/// Returns `null` when the agent has never run, so callers can decide whether
/// to show the fallback subtitle.
String? formatAgentLastRunRelative(DateTime? lastAt, {DateTime? now}) {
  if (lastAt == null) return null;
  final n = now ?? DateTime.now();
  final ago = n.difference(lastAt);
  if (ago.isNegative) return 'just now';
  if (ago.inMinutes < 2) return 'just now';
  if (ago.inHours < 1) return '${ago.inMinutes} min ago';
  if (ago.inHours < 48) return '${ago.inHours} h ago';
  if (ago.inDays < 14) return '${ago.inDays} d ago';
  return lastAt.toLocal().toString().split(' ').first;
}
