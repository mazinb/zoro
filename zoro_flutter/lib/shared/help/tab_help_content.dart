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
      'Import with AI spends Cloud AI tokens (or is unlimited with Pro). On-device import is not billed.',
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

  static const agent = HowItWorksContent(
    title: 'How Agent works',
    bullets: [
      'Chat is the main Agent surface. It prefers Apple on-device Intelligence when available, otherwise Cloud AI or your API key.',
      'Retirement plan, inbox, PDF import, and mailbox are actions above the chat instead of permanent dashboard cards.',
      'Claim a private mailbox with your email. Zoro assigns a forwarding address; send PDFs only from that claimed address.',
      'One email can have one active mailbox at a time. Opening the magic link returns you to this app.',
      'The living retirement plan is a markdown file on this phone. Saving creates a new revision instead of overwriting.',
      'PDFs you drop or fetch stay on device. Passwords are stored in the keychain per file type.',
      'getzoro.com only holds PDF attachments briefly until the phone downloads and deletes them.',
      'The invest/savings split lives on Ledger → Cash. Plan helper (✨) still walks corpus and paydown until skills ship.',
    ],
  );

  static const goals = HowItWorksContent(
    title: 'How the plan helper works',
    bullets: [
      'Retirement corpus can track expenses automatically or a custom target.',
      'Plan helper walks structured steps (corpus, allocation, paydown) with optional AI.',
      'The ✨ action opens the helper so you can adjust inputs and backtest your plan.',
    ],
  );

  static const settings = HowItWorksContent(
    title: 'How Settings works',
    bullets: [
      'General: theme, privacy mask, display currency, FX rates, and projection assumptions.',
      'Open ? to choose which tabs show the how-it-works button (Settings always keeps ? here).',
      'Helpers: tune built-in agent prompts. The Home pane shows overall token usage.',
      'Usage: Free vs Pro, token packs, and restores purchases.',
      'Export / import is in Helpers → Data (Pro only).',
    ],
  );
}

class HowItWorksContent {
  const HowItWorksContent({required this.title, required this.bullets});

  final String title;
  final List<String> bullets;
}
