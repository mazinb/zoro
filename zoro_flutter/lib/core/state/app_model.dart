import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import '../chat/chat_local_store.dart';
import '../chat/chat_message.dart';
import '../constants/web_expenses_income.dart';
import '../finance/currency.dart';
import '../llm/llm_key_store.dart';
import 'cashflow_income_line.dart';
import 'internal_app_agent_definition.dart';
import 'ledger_rows.dart';
import 'monthly_cashflow_entry.dart';

class AppModel extends ChangeNotifier {
  AppModel() {
    syncAllocationsFromFraction(notify: false);
    _seedDummyCashflowData();
  }

  static const double spendVarianceBandPct = 0.10;
  static const Color spendOverColor = Color(0xFFEF4444); // red
  static const Color spendUnderColor = Color(0xFF10B981); // green
  static const Color spendInBandColor = AppTheme.slate600; // grey
  static const Color spendNoDataColor = AppTheme.slate500;

  final LlmKeyStore _llmKeyStore = LlmKeyStore();

  bool _bootstrapped = false;
  bool get bootstrapped => _bootstrapped;

  Future<void> bootstrap() async {
    if (_bootstrapped) return;
    try {
      final keys = await _llmKeyStore.readAll();
      openAiApiKey = keys[LlmProvider.openai];
      anthropicApiKey = keys[LlmProvider.anthropic];
      geminiApiKey = keys[LlmProvider.gemini];
      _syncActiveProviderIfKeyRemoved();
      await loadPersistedChats();
    } finally {
      _bootstrapped = true;
      notifyListeners();
    }
  }

  Color get accent => AppTheme.primaryBlue;

  Color get accentSoft => accent.withValues(alpha: 0.12);

  /// When true, monetary figures are masked (e.g. on Home and Ledger). Toggled from Home.
  bool privacyHideAmounts = false;

  /// Optional short motivation/summary shown at the top of Home when non-empty.
  String homeSummaryText = '';

  void setHomeSummaryText(String value) {
    homeSummaryText = value;
    notifyListeners();
  }

  /// Agents (UI-only). These are configurable “helpers” that can use app context + user-provided JSON.
  final List<AppAgent> agents = [
    AppAgent(
      id: 'agent-1',
      name: 'Retirement planner',
      description: 'Plans retirement timeline, savings rate, and split targets.',
      systemPrompt: 'You are a retirement planner. Ask only what you need. Propose clear next actions.',
      permissions: const [
        AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.cashflow, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.income, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.assets, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.liabilities, access: AgentAccess.read),
      ],
      contextMarkdown: '''## Assumptions
- Target retire age: 55
- Real return: 5%

## Notes
Keep recommendations concrete and testable.
''',
    ),
    AppAgent(
      id: 'agent-2',
      name: 'RSU allocator',
      description: 'Helps plan RSU vesting, taxes, and diversification.',
      systemPrompt: 'You are an RSU allocation coach. Focus on diversification, tax timing, and risk.',
      permissions: const [
        AgentPermission(domain: AgentDomain.income, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.assets, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
      ],
      contextMarkdown: '''## RSU details
- Currency: USD
- Vesting cadence: quarterly

## Goals
- Diversify concentration risk
- Keep a taxes-first checklist
''',
    ),
    AppAgent(
      id: 'agent-3',
      name: 'FIRE strategist',
      description: 'Optimizes savings rate and runway; spots bottlenecks.',
      systemPrompt: 'You are a FIRE strategist. Be direct. Call out the one biggest leverage point.',
      permissions: const [
        AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.cashflow, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.income, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.assets, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.liabilities, access: AgentAccess.read),
      ],
      contextMarkdown: '''## Targets
- FIRE multiple: 25x annual expenses

## Style
Blunt + prioritized actions.
''',
    ),
    AppAgent(
      id: 'agent-4',
      name: 'Expense analyzer',
      description: 'Finds bloated buckets and proposes cuts.',
      systemPrompt: 'You are an expense analyst. Use buckets. Suggest experiments for 30 days.',
      permissions: const [
        AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.cashflow, access: AgentAccess.read),
      ],
      contextMarkdown: '''## Rules
- Flag top 2 buckets
- Suggest 3 swaps with clear trade-offs
''',
    ),
    AppAgent(
      id: 'agent-5',
      name: 'Home purchase planner',
      description: 'Plans down payment vs mortgage; debt/equity mix.',
      systemPrompt: 'You are a home purchase planner. Compare scenarios and keep risk constraints explicit.',
      permissions: const [
        AgentPermission(domain: AgentDomain.assets, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.liabilities, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.cashflow, access: AgentAccess.read),
        AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
      ],
      contextMarkdown: '''## Scenario
- Home price: 12,000,000
- Down payment: 30%

## Questions
- What % debt vs equity?
- Monthly payment safety margin?
''',
    ),
  ];

  /// Per–internal-agent system prompt overrides (empty key → use [InternalAppAgentDefinition.defaultSystemPrompt]).
  final Map<String, String> _internalAgentSystemPromptById = {};

  String internalAgentSystemPrompt(String agentId) {
    final stored = _internalAgentSystemPromptById[agentId];
    if (stored != null) return stored;
    return internalAppAgentDefinitionById(agentId)?.defaultSystemPrompt ?? '';
  }

  void setInternalAgentSystemPrompt(String agentId, String value) {
    _internalAgentSystemPromptById[agentId] = value;
    notifyListeners();
  }

  /// Last structured JSON per internal agent (e.g. for App agents detail / debugging).
  final Map<String, Map<String, Object?>> internalAgentLastStructuredById = {};

  final Map<String, DateTime> internalAgentLastRunById = {};

  void recordInternalAgentRun(String agentId, Map<String, Object?> structured) {
    internalAgentLastStructuredById[agentId] = Map<String, Object?>.from(structured);
    internalAgentLastRunById[agentId] = DateTime.now();
    notifyListeners();
  }

  /// Convenience for the asset context planner flow.
  void recordAssetContextPlannerRun(Map<String, Object?> structured) {
    recordInternalAgentRun(InternalAppAgentIds.assetContext, structured);
  }

  /// When this context note was last saved (for assistant + display). Keys: `asset:id`, `liability:id`, `bucket:key`, `month:yyyy-mm`.
  final Map<String, DateTime> contextNoteSavedAtUtc = {};

  static String contextKeyAsset(String id) => 'asset:$id';
  static String contextKeyLiability(String id) => 'liability:$id';
  static String contextKeyBucket(String key) => 'bucket:$key';
  static String contextKeyMonth(String monthKey) => 'month:$monthKey';

  String? contextNoteLastUpdatedIso(String storageKey) {
    final t = contextNoteSavedAtUtc[storageKey];
    return t?.toIso8601String();
  }

  void _touchContextNoteSaved(String storageKey) {
    contextNoteSavedAtUtc[storageKey] = DateTime.now().toUtc();
  }

  /// Call when a context note is saved outside the usual setters (e.g. new month row).
  void markContextNoteSaved(String storageKey) {
    _touchContextNoteSaved(storageKey);
    notifyListeners();
  }

  /// Chats are always tied to an agent; threads and messages persist locally (see [bootstrap]).
  final List<AgentChatThread> chats = [];

  final Map<String, List<ChatMessage>> _chatMessagesByThreadId = {};
  int _chatPersistRevision = 0;

  List<ChatMessage> chatMessagesFor(String threadId) {
    final list = _chatMessagesByThreadId[threadId];
    if (list == null) return [];
    return List<ChatMessage>.from(list);
  }

  void setChatMessagesFor(String threadId, List<ChatMessage> messages) {
    _chatMessagesByThreadId[threadId] = List<ChatMessage>.from(messages);
    _scheduleChatPersist();
    notifyListeners();
  }

  void appendChatMessage(String threadId, ChatMessage message) {
    _chatMessagesByThreadId.putIfAbsent(threadId, () => []).add(message);
    _scheduleChatPersist();
    notifyListeners();
  }

  void _scheduleChatPersist() {
    _chatPersistRevision++;
    final rev = _chatPersistRevision;
    Future<void> run() async {
      if (rev != _chatPersistRevision) return;
      try {
        await ChatLocalStore.save(
          threads: List<AgentChatThread>.from(chats),
          messagesByThread: {
            for (final e in _chatMessagesByThreadId.entries) e.key: List<ChatMessage>.from(e.value),
          },
        );
      } catch (_) {}
    }

    Future.microtask(run);
  }

  Future<void> loadPersistedChats() async {
    final snap = await ChatLocalStore.load();
    if (snap == null) return;
    chats
      ..clear()
      ..addAll(snap.threads);
    _chatMessagesByThreadId
      ..clear()
      ..addAll(snap.messages);
    notifyListeners();
  }

  /// Permissions / keys (UI-only). Used by Chat and (later) Agents.
  LlmProvider activeLlmProvider = LlmProvider.openai;
  String? openAiApiKey;
  String? anthropicApiKey;
  String? geminiApiKey;

  /// Optional tuning (kept simple for now).
  String openAiModel = 'gpt-4.1-mini';
  // NOTE: These defaults should track currently-supported model IDs.
  // Users can override them in Settings → API keys.
  String anthropicModel = 'claude-sonnet-4-6';
  String geminiModel = 'gemini-2.5-flash';

  /// Reminder cadence for "keep your numbers fresh" nudges (UI-only).
  ReminderCadence remindersExpensesCadence = ReminderCadence.quarterly;
  ReminderCadence remindersCashflowCadence = ReminderCadence.monthly;
  ReminderCadence remindersIncomeCadence = ReminderCadence.yearly;
  ReminderCadence remindersAssetsCadence = ReminderCadence.quarterly;
  ReminderCadence remindersLiabilitiesCadence = ReminderCadence.quarterly;

  /// Monthly reminders are considered due after this day-of-month.
  /// Default: 1st of the month.
  int remindersMonthlyDayOfMonth = 1;

  /// Quarterly reminders use quarter-end dates by default:
  /// Mar 31, Jun 30, Sep 30, Dec 31 (anchored to "end of March").
  int remindersQuarterMonthInQuarter = 3;
  int remindersQuarterDay = 31;

  /// Yearly **nudge** date in Settings (Mar 31 default). Overdue for yearly cadence is computed from
  /// one year after the last update (anniversary), not this anchor.
  int remindersYearlyMonth = 3;
  int remindersYearlyDay = 31;

  /// THB matches [expensePresetCountry] bucket units so the Sankey and ledger stay aligned at boot.
  CurrencyCode displayCurrency = CurrencyCode.thb;

  /// Preset used only for expense bucket ranges/defaults (not a global "cashflow currency").
  static const String expensePresetCountry = 'Thailand';

  /// Ledger assets / liabilities — mirrors web `/assets` row shape (`formType: assets`).
  final List<LedgerAssetRow> assets = [
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.property,
      currencyCountry: 'Thailand',
      name: 'Bangkok Condo',
      total: 9500000,
      label: '',
      comment: '',
      contextMarkdown: '''## Bangkok Condo

### Details
- City: Bangkok
- Ownership: 100%
- Valuation: conservative estimate (not an appraisal)
- Notes: primary residence; not intended for sale

### Update cadence
- Review quarterly or after major renovations
''',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.brokerage,
      currencyCountry: 'US',
      name: 'US Brokerage',
      total: 350000,
      label: '',
      comment: '',
      contextMarkdown: '''## US Brokerage

### Platform
- Broker: (mock) Fidelity
- Account currency: USD

### Major holdings (mock)
- VTI (Total US) — \$140k
- VXUS (Intl ex-US) — \$60k
- QQQ (Nasdaq) — \$45k
- BND (Bonds) — \$35k
- Cash — \$20k
- Misc/other — \$50k

### Notes
- Goal: broad diversification; avoid single-stock concentration
- Update cadence: monthly (or after large deposits/withdrawals)
''',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.brokerage,
      currencyCountry: 'India',
      name: 'India Index Fund',
      total: 2000000,
      label: '',
      comment: '',
      contextMarkdown: '''## India Index Fund

### Platform
- Platform: (mock) Groww / Zerodha
- Account currency: INR

### Composition (mock)
- Nifty 50 index fund — ₹12.5L
- Nifty Next 50 — ₹4.0L
- Nifty Midcap 150 — ₹2.0L
- Cash — ₹1.5L

### Notes
- Goal: long-term accumulation; rebalance yearly
- Update cadence: monthly
''',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.savings,
      currencyCountry: 'Thailand',
      name: 'Thai Cash',
      total: 1500000,
      label: '',
      comment: '',
      contextMarkdown: '''## Thai Cash

### Purpose
- Emergency fund + near-term expenses
- Buffer for quarterly expenses

### Notes
- Keep ~6 months runway in cash/FDs
- Update cadence: monthly
''',
    ),
  ];

  final List<LedgerLiabilityRow> liabilities = [
    LedgerLiabilityRow(
      id: newLedgerRowId('l'),
      type: LedgerLiabilityType.mortgage,
      name: 'Condo mortgage',
      currencyCountry: 'Thailand',
      total: 4200000,
      comment: '',
      contextMarkdown: '''## Condo mortgage

### Terms (mock)
- Lender: Bangkok Bank
- Rate: 6.25% (variable)
- Remaining term: 18 years
- Payment: ฿34,500 / month
- Next rate reset: yearly

### Notes
- Prioritize keeping payment < 25% of monthly net income
''',
    ),
    LedgerLiabilityRow(
      id: newLedgerRowId('l'),
      type: LedgerLiabilityType.carLoan,
      name: 'Car loan',
      currencyCountry: 'Thailand',
      total: 750000,
      comment: '',
      contextMarkdown: '''## Car loan

### Terms (mock)
- Lender: Toyota Leasing
- Rate: 3.10% fixed
- Remaining term: 3 years
- Payment: ฿22,000 / month

### Notes
- Keep as scheduled; prepay only if cash cushion is strong
''',
    ),
  ];

  /// Multiple income sources; each line has its own currency (like ledger assets).
  final List<CashflowIncomeLine> incomeLines = [
    CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: 'Salary',
      annualAmount: 4500000,
      currencyCountry: 'Thailand',
    ),
    CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: 'RUS',
      annualAmount: 80000,
      currencyCountry: 'US',
    ),
    CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: 'Bonus',
      annualAmount: 1200000,
      currencyCountry: 'Thailand',
    ),
  ];

  double? effectiveTaxRatePct = 22;

  /// Expenses (mirrors web buckets). Amounts are interpreted in [displayCurrency] for display/FX.
  late Map<String, double> expenseBuckets = {
    for (final k in expenseBucketKeys) k: presetForCountry(expensePresetCountry).buckets[k]!.value,
  };

  /// Optional context per expense bucket key (UI-only).
  Map<String, String> expenseBucketContextMarkdown = {
    for (final k in expenseBucketKeys) k: '',
  };

  /// Last time income figures were meaningfully updated (shown in Ledger).
  DateTime? incomeLastUpdated;

  /// Last time monthly expense *estimates* were saved from the editor.
  DateTime? expenseEstimatesLastUpdated;

  /// Last time assets / liabilities were reviewed (e.g. after edits).
  DateTime? assetsLastReviewed;
  DateTime? liabilitiesLastReviewed;

  /// Month key → single [MonthlyCashflowEntry] for that month (split + spending + note).
  final Map<String, MonthlyCashflowEntry> monthlyCashflowByMonth = {};

  /// Portion of post-expense net income allocated to investments (rest is cash / FDs).
  /// Range 0–1, always a multiple of 5% (matches Split slider increments).
  double allocInvestFraction = 0.6;

  static const int _allocFractionSteps = 20;

  static double _quantizeAllocInvestFraction(double f) =>
      (f.clamp(0.0, 1.0) * _allocFractionSteps).round() / _allocFractionSteps;

  /// When the target allocation slider was last changed.
  DateTime? allocationTargetLastUpdated;

  /// MONTHLY amounts in display-currency space; kept in sync with [allocInvestFraction].
  double allocInvestmentsMonthly = 0;
  double allocSavingsMonthly = 0;

  String get displayCurrencySymbol => displayCurrency.symbol;

  static String monthKeyFor(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';

  static List<String> recentMonthKeys() {
    final now = DateTime.now();
    return List.generate(7, (i) {
      final d = DateTime(now.year, now.month - i, 1);
      return monthKeyFor(d);
    });
  }

  static String formatMonthKeyLabel(String key) {
    final parts = key.split('-');
    if (parts.length != 2) return key;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (y == null || m == null) return key;
    const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (m < 1 || m > 12) return key;
    return '${names[m]} $y';
  }

  void setPrivacyHideAmounts(bool value) {
    if (privacyHideAmounts == value) return;
    privacyHideAmounts = value;
    notifyListeners();
  }

  void addAgent(AppAgent agent) {
    agents.add(agent);
    notifyListeners();
  }

  void updateAgent(int index, AppAgent agent) {
    if (index < 0 || index >= agents.length) return;
    agents[index] = agent;
    notifyListeners();
  }

  void removeAgentAt(int index) {
    if (index < 0 || index >= agents.length) return;
    agents.removeAt(index);
    notifyListeners();
  }

  void addChat(AgentChatThread t) {
    chats.add(t);
    _chatMessagesByThreadId.putIfAbsent(t.id, () => []);
    _scheduleChatPersist();
    notifyListeners();
  }

  void removeChatById(String id) {
    final idx = chats.indexWhere((t) => t.id == id);
    if (idx < 0) return;
    chats.removeAt(idx);
    _chatMessagesByThreadId.remove(id);
    _scheduleChatPersist();
    notifyListeners();
  }

  void clearChatById(String id) {
    final idx = chats.indexWhere((t) => t.id == id);
    if (idx < 0) return;
    final t = chats[idx].clone();
    t.updatedAt = DateTime.now();
    t.messageCount = 0;
    t.tokensUsed = 0;
    t.lastLine = '';
    chats[idx] = t;
    _chatMessagesByThreadId[id] = [];
    _scheduleChatPersist();
    notifyListeners();
  }

  void updateChat(int index, AgentChatThread t) {
    if (index < 0 || index >= chats.length) return;
    chats[index] = t;
    _scheduleChatPersist();
    notifyListeners();
  }

  void setActiveLlmProvider(LlmProvider p) {
    if (activeLlmProvider == p) return;
    activeLlmProvider = p;
    notifyListeners();
  }

  void setApiKey({required LlmProvider provider, String? key}) {
    final trimmed = (key ?? '').trim();
    final v = trimmed.isEmpty ? null : trimmed;
    switch (provider) {
      case LlmProvider.openai:
        openAiApiKey = v;
      case LlmProvider.anthropic:
        anthropicApiKey = v;
      case LlmProvider.gemini:
        geminiApiKey = v;
    }
    // Fire-and-forget persistence (secure storage).
    _llmKeyStore.writeKey(provider: provider, value: v);
    _syncActiveProviderIfKeyRemoved();
    notifyListeners();
  }

  /// If the active provider no longer has a key, pick the first provider that does.
  void _syncActiveProviderIfKeyRemoved() {
    if (apiKeyFor(activeLlmProvider) != null) return;
    for (final p in LlmProvider.values) {
      if (apiKeyFor(p) != null) {
        activeLlmProvider = p;
        return;
      }
    }
  }

  String? apiKeyFor(LlmProvider provider) => switch (provider) {
        LlmProvider.openai => openAiApiKey,
        LlmProvider.anthropic => anthropicApiKey,
        LlmProvider.gemini => geminiApiKey,
      };

  String modelFor(LlmProvider provider) => switch (provider) {
        LlmProvider.openai => openAiModel,
        LlmProvider.anthropic => anthropicModel,
        LlmProvider.gemini => geminiModel,
      };

  void setModelFor(LlmProvider provider, String model) {
    final next = model.trim();
    if (next.isEmpty) return;
    switch (provider) {
      case LlmProvider.openai:
        openAiModel = next;
      case LlmProvider.anthropic:
        anthropicModel = next;
      case LlmProvider.gemini:
        geminiModel = next;
    }
    notifyListeners();
  }

  // Temperature removed: some models/providers reject non-default values.

  bool get hasAnyApiKey => openAiApiKey != null || anthropicApiKey != null || geminiApiKey != null;

  void setReminderCadenceExpenses(ReminderCadence v) {
    remindersExpensesCadence = v;
    notifyListeners();
  }

  void setReminderCadenceCashflow(ReminderCadence v) {
    remindersCashflowCadence = v;
    notifyListeners();
  }

  void setReminderCadenceIncome(ReminderCadence v) {
    remindersIncomeCadence = v;
    notifyListeners();
  }

  void setReminderCadenceAssets(ReminderCadence v) {
    remindersAssetsCadence = v;
    notifyListeners();
  }

  void setReminderCadenceLiabilities(ReminderCadence v) {
    remindersLiabilitiesCadence = v;
    notifyListeners();
  }

  void setRemindersMonthlyDayOfMonth(int d) {
    final next = d.clamp(1, 28);
    if (remindersMonthlyDayOfMonth == next) return;
    remindersMonthlyDayOfMonth = next;
    notifyListeners();
  }

  void setRemindersUseQuarterEnds(bool v) {
    // Deprecated (UI no longer exposes quarter-end toggle).
    notifyListeners();
  }

  void setRemindersQuarterlySchedule({required int monthInQuarter, required int day}) {
    final m = monthInQuarter.clamp(1, 3);
    final d = day.clamp(1, 31);
    if (remindersQuarterMonthInQuarter == m && remindersQuarterDay == d) return;
    remindersQuarterMonthInQuarter = m;
    remindersQuarterDay = d;
    notifyListeners();
  }

  void setRemindersYearlyDate({required int month, required int day}) {
    final m = month.clamp(1, 12);
    final d = day.clamp(1, 31);
    if (remindersYearlyMonth == m && remindersYearlyDay == d) return;
    remindersYearlyMonth = m;
    remindersYearlyDay = d;
    notifyListeners();
  }

  void setDisplayCurrency(CurrencyCode next) {
    if (displayCurrency == next) return;
    final from = displayCurrency;
    displayCurrency = next;
    expenseBuckets = {
      for (final e in expenseBuckets.entries)
        e.key: convertCurrency(value: e.value, from: from, to: next),
    };
    for (final e in monthlyCashflowByMonth.values) {
      e.outflowToCashFd = convertCurrency(value: e.outflowToCashFd, from: from, to: next);
      e.outflowToInvested = convertCurrency(value: e.outflowToInvested, from: from, to: next);
      e.monthlySpending = convertCurrency(value: e.monthlySpending, from: from, to: next);
    }
    syncAllocationsFromFraction();
    notifyListeners();
  }

  double moneyInDisplayCurrency(double v, CurrencyCode from) {
    return convertCurrency(value: v, from: from, to: displayCurrency);
  }

  String moneyDisplay(double v, CurrencyCode from, {int? decimals}) {
    final converted = moneyInDisplayCurrency(v, from);
    return formatMoney(converted, currency: displayCurrency, decimals: decimals);
  }

  double get totalAssetsDisplay => assets.fold<double>(
        0,
        (s, r) => s + moneyInDisplayCurrency(r.total, currencyCodeForPresetCountry(r.currencyCountry)),
      );

  double get totalLiabilitiesDisplay => liabilities.fold<double>(
        0,
        (s, r) => s + moneyInDisplayCurrency(r.total, currencyCodeForPresetCountry(r.currencyCountry)),
      );

  double get netWorthDisplay => totalAssetsDisplay - totalLiabilitiesDisplay;

  String get defaultLedgerCurrencyCountry =>
      incomeLines.isEmpty ? expensePresetCountry : incomeLines.first.currencyCountry;

  void addAsset(LedgerAssetRow row) {
    assets.add(row);
    assetsLastReviewed = DateTime.now();
    notifyListeners();
  }

  void replaceAsset(int index, LedgerAssetRow row) {
    if (index < 0 || index >= assets.length) return;
    assets[index] = row;
    assetsLastReviewed = DateTime.now();
    notifyListeners();
  }

  void removeAssetAt(int index) {
    if (assets.length <= 1 || index < 0 || index >= assets.length) return;
    assets.removeAt(index);
    assetsLastReviewed = DateTime.now();
    notifyListeners();
  }

  void addLiability(LedgerLiabilityRow row) {
    liabilities.add(row);
    liabilitiesLastReviewed = DateTime.now();
    notifyListeners();
  }

  void replaceLiability(int index, LedgerLiabilityRow row) {
    if (index < 0 || index >= liabilities.length) return;
    liabilities[index] = row;
    liabilitiesLastReviewed = DateTime.now();
    notifyListeners();
  }

  void removeLiabilityAt(int index) {
    if (index < 0 || index >= liabilities.length) return;
    liabilities.removeAt(index);
    liabilitiesLastReviewed = DateTime.now();
    notifyListeners();
  }

  void addIncomeLine({String? defaultCurrencyCountry}) {
    incomeLines.add(
      CashflowIncomeLine.blank(
        defaultCurrencyCountry: defaultCurrencyCountry ?? defaultLedgerCurrencyCountry,
      ),
    );
    incomeLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    notifyListeners();
  }

  void removeIncomeLineAt(int index) {
    if (index < 0 || index >= incomeLines.length || incomeLines.length <= 1) return;
    incomeLines.removeAt(index);
    incomeLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    notifyListeners();
  }

  void updateIncomeLineAt(int index, {String? label, double? annualAmount}) {
    if (index < 0 || index >= incomeLines.length) return;
    final line = incomeLines[index];
    if (label != null) line.label = label;
    if (annualAmount != null) line.annualAmount = annualAmount;
    notifyIncomeChanged();
  }

  bool tryUpdateAssetTotalById(String id, double total) {
    final a = assetById(id);
    if (a == null) return false;
    a.total = total;
    assetsLastReviewed = DateTime.now();
    notifyListeners();
    return true;
  }

  bool tryUpdateLiabilityTotalById(String id, double total) {
    final row = liabilityById(id);
    if (row == null) return false;
    row.total = total;
    liabilitiesLastReviewed = DateTime.now();
    notifyListeners();
    return true;
  }

  void notifyIncomeChanged() {
    incomeLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    notifyListeners();
  }

  void setEffectiveTaxRatePct(double? v) {
    effectiveTaxRatePct = v;
    incomeLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    notifyListeners();
  }

  void setExpenseBucket(String key, double value) {
    expenseBuckets = {...expenseBuckets, key: value};
    syncAllocationsFromFraction();
    notifyListeners();
  }

  void markExpenseEstimatesUpdated() {
    expenseEstimatesLastUpdated = DateTime.now();
    notifyListeners();
  }

  void setExpenseBucketContextMarkdown({required String bucketKey, required String markdown}) {
    expenseBucketContextMarkdown = {...expenseBucketContextMarkdown, bucketKey: markdown};
    _touchContextNoteSaved(contextKeyBucket(bucketKey));
    notifyListeners();
  }

  double actualSpendForMonth(String monthKey) {
    return monthlyEntryFor(monthKey)?.monthlySpending ?? 0;
  }

  /// Color-code actual spending compared to predicted budget.
  /// - > +10% over predicted: red
  /// - > -10% under predicted: green
  /// - within ±10% band: grey
  static Color spendVsPredictedColor({
    required double actual,
    required double predicted,
    bool hasData = true,
  }) {
    if (!hasData) return spendNoDataColor;
    if (predicted <= 0 || actual <= 0) return spendInBandColor;
    final ratio = actual / predicted;
    if (ratio > 1 + spendVarianceBandPct) return spendOverColor;
    if (ratio < 1 - spendVarianceBandPct) return spendUnderColor;
    return spendInBandColor;
  }

  MonthlyCashflowEntry? monthlyEntryFor(String monthKey) => monthlyCashflowByMonth[monthKey];

  void upsertMonthlyCashflow(MonthlyCashflowEntry entry) {
    monthlyCashflowByMonth[entry.monthKey] = entry;
    notifyListeners();
  }

  void removeMonthlyCashflow(String monthKey) {
    monthlyCashflowByMonth.remove(monthKey);
    notifyListeners();
  }

  LedgerAssetRow? assetById(String id) {
    for (final a in assets) {
      if (a.id == id) return a;
    }
    return null;
  }

  LedgerLiabilityRow? liabilityById(String id) {
    for (final l in liabilities) {
      if (l.id == id) return l;
    }
    return null;
  }

  void setAssetContextMarkdown({required String assetId, required String markdown}) {
    final idx = assets.indexWhere((a) => a.id == assetId);
    if (idx < 0) return;
    assets[idx].contextMarkdown = markdown;
    assetsLastReviewed = DateTime.now();
    _touchContextNoteSaved(contextKeyAsset(assetId));
    notifyListeners();
  }

  void setLiabilityContextMarkdown({required String liabilityId, required String markdown}) {
    final idx = liabilities.indexWhere((l) => l.id == liabilityId);
    if (idx < 0) return;
    liabilities[idx].contextMarkdown = markdown;
    liabilitiesLastReviewed = DateTime.now();
    _touchContextNoteSaved(contextKeyLiability(liabilityId));
    notifyListeners();
  }

  void setMonthlyEntryContextMarkdown({required String monthKey, required String markdown}) {
    final e = monthlyCashflowByMonth[monthKey];
    if (e == null) return;
    e.contextMarkdown = markdown;
    _touchContextNoteSaved(contextKeyMonth(monthKey));
    notifyListeners();
  }

  DateTime _quarterlyAnchorFor(int year, int quarter) {
    final startMonth = ((quarter - 1) * 3) + 1;
    final month = startMonth + (remindersQuarterMonthInQuarter.clamp(1, 3) - 1);
    final maxDay = DateTime(year, month + 1, 0).day;
    final day = remindersQuarterDay.clamp(1, maxDay);
    return DateTime(year, month, day);
  }

  DateTime _mostRecentQuarterlyAnchor(DateTime now) {
    final q = ((now.month - 1) ~/ 3) + 1;
    final thisAnchor = _quarterlyAnchorFor(now.year, q);
    if (!now.isBefore(thisAnchor)) return thisAnchor;
    final prevQ = q == 1 ? 4 : (q - 1);
    final prevY = q == 1 ? (now.year - 1) : now.year;
    return _quarterlyAnchorFor(prevY, prevQ);
  }

  bool _isOverdue({required DateTime now, required DateTime? last, required ReminderCadence cadence}) {
    if (cadence == ReminderCadence.off) return false;
    switch (cadence) {
      case ReminderCadence.monthly:
        final dueDay = remindersMonthlyDayOfMonth.clamp(1, 28);
        final dueThisMonth = DateTime(now.year, now.month, dueDay);
        if (now.isBefore(dueThisMonth)) return false;
        final startOfMonth = DateTime(now.year, now.month, 1);
        return last == null || last.isBefore(startOfMonth);
      case ReminderCadence.quarterly:
        final anchor = _mostRecentQuarterlyAnchor(now);
        return last == null || last.isBefore(anchor);
      case ReminderCadence.yearly:
        // Due once per year from the last update (anniversary), not only on a fixed calendar anchor.
        if (last == null) return true;
        final due = DateTime(last.year + 1, last.month, last.day);
        return !now.isBefore(due);
      case ReminderCadence.off:
        return false;
    }
  }

  bool get expensesReviewOverdue => expensesReviewOverdueAt(DateTime.now());
  bool get incomeReviewOverdue => incomeReviewOverdueAt(DateTime.now());
  bool get assetsReviewOverdue => assetsReviewOverdueAt(DateTime.now());
  bool get liabilitiesReviewOverdue => liabilitiesReviewOverdueAt(DateTime.now());

  bool expensesReviewOverdueAt(DateTime now) =>
      _isOverdue(now: now, last: expenseEstimatesLastUpdated, cadence: remindersExpensesCadence);

  bool incomeReviewOverdueAt(DateTime now) =>
      _isOverdue(now: now, last: incomeLastUpdated, cadence: remindersIncomeCadence);

  bool assetsReviewOverdueAt(DateTime now) =>
      _isOverdue(now: now, last: assetsLastReviewed, cadence: remindersAssetsCadence);

  bool liabilitiesReviewOverdueAt(DateTime now) =>
      _isOverdue(now: now, last: liabilitiesLastReviewed, cadence: remindersLiabilitiesCadence);

  bool get cashflowReviewOverdue => cashflowReviewOverdueAt(DateTime.now());

  /// Whether cash flow needs attention for [now] (used by Home reminders + tests).
  bool cashflowReviewOverdueAt(DateTime now) {
    if (remindersCashflowCadence == ReminderCadence.off) return false;
    final mk = monthKeyFor(now);
    final hasThisMonth = monthlyCashflowByMonth[mk] != null;
    final dueDay = remindersMonthlyDayOfMonth.clamp(1, 28);
    final dueThisMonth = DateTime(now.year, now.month, dueDay);
    if (now.isBefore(dueThisMonth)) return false;
    return !hasThisMonth;
  }

  /// Latest month (first day) that has a cash-flow entry; for "last updated" copy on Home.
  DateTime? get latestCashflowMonthStart {
    DateTime? best;
    for (final k in monthlyCashflowByMonth.keys) {
      final parts = k.split('-');
      if (parts.length != 2) continue;
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      if (y == null || m == null) continue;
      final d = DateTime(y, m, 1);
      if (best == null || d.isAfter(best)) best = d;
    }
    return best;
  }

  /// Short phrase for Home reminder row (pass device "today" for tests).
  String cashflowLastUpdatedPhraseAt(DateTime now) {
    final latest = latestCashflowMonthStart;
    if (latest == null) return 'Never updated';
    return relativeLastUpdatedLabel(lastCalendarDay: latest, now: now);
  }

  /// Actual: average invest share of (cash/FD + invest) outflows over months that have entries in [monthKeys].
  double? actualInvestShareAmongOutflows(Iterable<String> monthKeys) {
    double inv = 0, cash = 0;
    for (final mk in monthKeys) {
      final e = monthlyEntryFor(mk);
      if (e == null) continue;
      inv += e.outflowToInvested;
      cash += e.outflowToCashFd;
    }
    final t = inv + cash;
    if (t <= 0) return null;
    return inv / t;
  }

  /// Mean monthly outflows to invested / cash-FD over months with entries (for $ compare).
  ({double invested, double cashFd})? averageAllocationOutflows(Iterable<String> monthKeys) {
    final entries = monthKeys.map(monthlyEntryFor).whereType<MonthlyCashflowEntry>().toList();
    if (entries.isEmpty) return null;
    var inv = 0.0, cash = 0.0;
    for (final e in entries) {
      inv += e.outflowToInvested;
      cash += e.outflowToCashFd;
    }
    final n = entries.length;
    return (invested: inv / n, cashFd: cash / n);
  }

  void _seedDummyCashflowData() {
    incomeLastUpdated = DateTime(2026, 1, 8);
    expenseEstimatesLastUpdated = DateTime(2026, 3, 15);
    allocationTargetLastUpdated = DateTime(2026, 3, 1);
    assetsLastReviewed = DateTime(2026, 3, 28);
    liabilitiesLastReviewed = DateTime(2026, 3, 28);

    final months = recentMonthKeys();
    if (months.isEmpty) return;
    syncAllocationsFromFraction(notify: false);
    final predicted = totalExpensesMonthly;
    final avail = availableAfterExpensesMonthly;

    final chrono = months.reversed.toList();
    for (var i = 0; i < chrono.length; i++) {
      final mk = chrono[i];
      // Force visible red/green/grey examples for the Expenses vs budget table + Context Actuals.
      // Pattern yields: under (green), in-band (grey), in-band (grey), in-band (grey), over (red).
      const spendJitterPattern = <double>[0.85, 0.93, 1.00, 1.07, 1.16];
      final spendJitter = spendJitterPattern[i % spendJitterPattern.length];
      final spend = ((predicted * spendJitter).clamp(0, double.infinity)).toDouble();
      final investShare = ((allocInvestFraction + ((i % 3) - 1) * 0.06).clamp(0.15, 0.85)).toDouble();
      final outInv = avail > 0
          ? ((avail * investShare * (0.92 + (i % 2) * 0.05)).clamp(0, double.infinity)).toDouble()
          : 0.0;
      final outCash = avail > 0
          ? ((avail * (1 - investShare) * (0.94 + (i % 2) * 0.04)).clamp(0, double.infinity)).toDouble()
          : 0.0;
      monthlyCashflowByMonth[mk] = MonthlyCashflowEntry(
        monthKey: mk,
        outflowToCashFd: outCash,
        outflowToInvested: outInv,
        monthlySpending: spend,
      );
    }

    // Mock month context (for Context + Chat attach).
    if (months.isNotEmpty) {
      final mk0 = months.first;
      monthlyCashflowByMonth[mk0]!.contextMarkdown ??= '''## ${formatMonthKeyLabel(mk0)}

### Why spending was high
- Travel (flights + hotels)
- One-off purchases (electronics)
- Hosting family
''';
    }
    if (months.length >= 3) {
      final mk2 = months[2];
      monthlyCashflowByMonth[mk2]!.contextMarkdown ??= '''## ${formatMonthKeyLabel(mk2)}

### Why spending was high
- Annual insurance premium paid
- Medical checkup
''';
    }
  }

  double get totalIncomeAnnualDisplay => incomeLines.fold<double>(
        0,
        (s, line) =>
            s +
            moneyInDisplayCurrency(
              line.annualAmount,
              currencyCodeForPresetCountry(line.currencyCountry),
            ),
      );

  double get taxesAnnualDisplay {
    final rate = (effectiveTaxRatePct ?? 0).clamp(0, 100) / 100.0;
    return totalIncomeAnnualDisplay * rate;
  }

  double get netIncomeAnnualDisplay =>
      (totalIncomeAnnualDisplay - taxesAnnualDisplay).clamp(0, double.infinity);

  double get recurringExpensesMonthly {
    return recurringExpenseBucketKeys.fold<double>(
      0,
      (s, k) => s + (expenseBuckets[k] ?? 0),
    );
  }

  double get totalExpensesMonthly => recurringExpensesMonthly;

  double get netIncomeMonthly => netIncomeAnnualDisplay / 12.0;

  double get availableAfterExpensesMonthly =>
      (netIncomeMonthly - totalExpensesMonthly).clamp(0, double.infinity);

  double predictedMonthlyForExpenseBucket(String k) => expenseBuckets[k] ?? 0;

  void setAllocInvestFraction(double f) {
    allocInvestFraction = _quantizeAllocInvestFraction(f);
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
  }

  void syncAllocationsFromFraction({bool notify = true}) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
    } else {
      allocInvestmentsMonthly = avail * allocInvestFraction;
      allocSavingsMonthly = avail - allocInvestmentsMonthly;
    }
    if (notify) notifyListeners();
  }

  void setAllocationInvestments(double v) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestFraction = 0;
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
      notifyListeners();
      return;
    }
    allocInvestFraction = _quantizeAllocInvestFraction(v / avail);
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
  }

  void setAllocationSavings(double v) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestFraction = 0;
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
      notifyListeners();
      return;
    }
    allocInvestFraction = _quantizeAllocInvestFraction(1.0 - (v / avail));
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
  }

  void normalizeAllocations({bool notify = true}) {
    syncAllocationsFromFraction(notify: notify);
  }

  ThemeData themedLight() {
    return AppTheme.light;
  }
}

/// Human-readable "Last updated …" for reminder rows; [lastCalendarDay] is normalized to date-only.
String relativeLastUpdatedLabel({required DateTime lastCalendarDay, required DateTime now}) {
  final d = DateTime(lastCalendarDay.year, lastCalendarDay.month, lastCalendarDay.day);
  final t = DateTime(now.year, now.month, now.day);
  if (!d.isBefore(t)) return 'Last updated today';
  final days = t.difference(d).inDays;
  if (days == 1) return 'Last updated 1 day ago';
  if (days < 30) return 'Last updated $days days ago';
  var months = (t.year - d.year) * 12 + t.month - d.month;
  if (t.day < d.day) months -= 1;
  final m = months.clamp(0, 999);
  if (m <= 0) return 'Last updated $days days ago';
  if (m == 1) return 'Last updated 1 month ago';
  return 'Last updated $m months ago';
}

enum ReminderCadence { off, monthly, quarterly, yearly }

enum LlmProvider { openai, anthropic, gemini }

enum AgentDomain { expenses, cashflow, income, assets, liabilities }

enum AgentAccess { read, write }

class AgentPermission {
  const AgentPermission({required this.domain, required this.access});

  final AgentDomain domain;
  final AgentAccess access;

  @override
  bool operator ==(Object other) =>
      other is AgentPermission && other.domain == domain && other.access == access;

  @override
  int get hashCode => Object.hash(domain, access);
}

class AppAgent {
  AppAgent({
    required this.id,
    required this.name,
    required this.description,
    required this.systemPrompt,
    required this.permissions,
    required this.contextMarkdown,
  });

  final String id;
  String name;
  String description;
  String systemPrompt;
  List<AgentPermission> permissions;
  String contextMarkdown;

  AppAgent clone() => AppAgent(
        id: id,
        name: name,
        description: description,
        systemPrompt: systemPrompt,
        permissions: [...permissions],
        contextMarkdown: contextMarkdown,
      );
}

class AgentChatThread {
  AgentChatThread({
    required this.id,
    required this.agentId,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.messageCount,
    required this.tokensUsed,
    this.lastLine = '',
  });

  final String id;
  final String agentId;
  String title;
  final DateTime createdAt;
  DateTime updatedAt;
  int messageCount;
  int tokensUsed;
  String lastLine;

  AgentChatThread clone() => AgentChatThread(
        id: id,
        agentId: agentId,
        title: title,
        createdAt: createdAt,
        updatedAt: updatedAt,
        messageCount: messageCount,
        tokensUsed: tokensUsed,
        lastLine: lastLine,
      );
}
