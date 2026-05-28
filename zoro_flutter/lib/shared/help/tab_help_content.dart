/// Short “how it works” copy per main tab (Home has none).
abstract final class TabHelpContent {
  static const onboarding = HowItWorksContent(
    title: 'How onboarding works',
    bullets: [
      'Everything you enter is saved on this device only — not uploaded to a server.',
      'Currencies and exchange rates power Home’s multi-currency view and conversions.',
      'Income and tax rate drive your Sankey cash-flow picture and what’s left to invest or save.',
      'Expense estimates seed your monthly budget buckets; you can refine them anytime in Ledger.',
    ],
  );

  static const ledger = HowItWorksContent(
    title: 'How Ledger works',
    bullets: [
      'Assets and liabilities are your balance sheet; Cash tracks real monthly in/out.',
      'Income lines are annual amounts per source; tax % is applied on Home’s Sankey.',
      'Expense estimates are planned monthly buckets — separate from actual spending in Cash.',
      'The ✨ action runs an on-device or cloud assistant depending on your Settings keys.',
    ],
  );

  static const context = HowItWorksContent(
    title: 'How Context works',
    bullets: [
      'Attach notes to assets and liabilities so assistants understand your situation.',
      'Estimates vs actuals compares budget buckets to recent Cash spending.',
      'The ✨ action drafts or refreshes context notes from your ledger data.',
    ],
  );

  static const goals = HowItWorksContent(
    title: 'How Goals works',
    bullets: [
      'The split slider divides what’s left after expenses between savings and investments.',
      'Retirement corpus can track expenses automatically or a custom target.',
      'Goals helper walks structured steps (corpus, allocation, paydown) with optional AI.',
      'The ✨ action opens Goals helper — same hub as reminder deep links.',
    ],
  );

  static const settings = HowItWorksContent(
    title: 'How Settings works',
    bullets: [
      'General: theme, privacy mask, display currency, FX rates, and projection assumptions.',
      'Helpers: tune built-in agent prompts used by ✨ actions across the app.',
      'API keys: optional cloud models; Apple on-device works without keys when available.',
      'Data: export, import, and backup live on this device.',
    ],
  );
}

class HowItWorksContent {
  const HowItWorksContent({required this.title, required this.bullets});

  final String title;
  final List<String> bullets;
}
