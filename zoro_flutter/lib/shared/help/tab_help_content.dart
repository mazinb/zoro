import '../../core/platform/platform_ai.dart';

/// Short “how it works” copy per main tab (Home has none).
abstract final class TabHelpContent {
  static const onboarding = HowItWorksContent(
    title: 'How onboarding works',
    bullets: [
      'Everything you enter is saved on this device only — not uploaded to a server.',
      'Currencies and exchange rates enable conversions inside the app.',
      'Income and tax rate are used for calculations.',
      'Expense estimates seed your monthly budget buckets; you can refine them anytime in Ledger.',
    ],
  );

  static final ledger = HowItWorksContent(
    title: 'How Ledger works',
    bullets: [
      'Assets and liabilities are your balance sheet; Cash tracks real monthly in/out.',
      'Income lines are annual amounts per source; tax % is an approx effective tax rate for calculations.',
      'Expense estimates are planned monthly buckets separate from actual spending in Cash.',
      'AI asset import can auto-populate context notes with extracted details.',
      'Import with AI uses credits (or Pro) to extract assets, liabilities, and cash flow.',
      PlatformAi.helperTabHelpLine(),
    ],
  );

  static const context = HowItWorksContent(
    title: 'How Context works',
    bullets: [
      'Attach notes to assets and liabilities so assistants understand your situation.',
      'AI asset import can auto-populate context files with extracted details.',
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
      'The ✨ action opens Goals helper so you can adjust inputs and backtest your plan.',
    ],
  );

  static const settings = HowItWorksContent(
    title: 'How Settings works',
    bullets: [
      'General: theme, privacy mask, display currency, FX rates, and projection assumptions.',
      'Open ? to choose which tabs show the how-it-works button (Settings always keeps ? here).',
      'Helpers: tune built-in agent prompts used by ✨ actions across the app.',
      'Usage: Free vs Pro, credits, and restores purchases.',
      'Export / import is in Helpers → Data (Pro only).',
    ],
  );
}

class HowItWorksContent {
  const HowItWorksContent({required this.title, required this.bullets});

  final String title;
  final List<String> bullets;
}
