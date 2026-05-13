import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import '../chat/chat_message.dart';
import '../constants/web_expenses_income.dart';
import '../finance/currency.dart';
import '../../dev/compile_time_api_keys.dart';
import '../llm/apple_foundation_channel.dart';
import '../llm/llm_key_store.dart';
import '../notifications/notification_service.dart';
import '../persistence/agent_json.dart';
import '../persistence/app_state_codec.dart' as app_state;
import '../persistence/app_state_store.dart';
import '../schedule/scheduled_agent_runner.dart';
import 'cashflow_income_line.dart';
import 'internal_app_agent_definition.dart';
import 'ledger_rows.dart';
import 'monthly_cashflow_entry.dart';
import 'scheduled_agent_task.dart';

/// Parts of projected net worth for one year (matches [AppModel.netWorthProjection11Y] totals).
///
/// [startingBalance] — today’s net worth ([yearIndex] 0 only; same nominal “you are here” base for charts).
/// For [yearIndex] &gt; 0: [startingBalance] is **nominal** starting NW (not compounded); bar shows it at fixed scale.
/// [surplusPrincipal] — cumulative new money from annual surplus (`yearIndex ×` annual add), capped by remainder.
/// [surplusReturns] — everything else: growth on starting capital **and** on new money.
class NetWorthProjectionYearBreakdown {
  const NetWorthProjectionYearBreakdown({
    required this.startingBalance,
    required this.surplusPrincipal,
    required this.surplusReturns,
  });

  final double startingBalance;
  final double surplusPrincipal;
  final double surplusReturns;

  double get total => startingBalance + surplusPrincipal + surplusReturns;

  @override
  bool operator ==(Object other) {
    return other is NetWorthProjectionYearBreakdown &&
        other.startingBalance == startingBalance &&
        other.surplusPrincipal == surplusPrincipal &&
        other.surplusReturns == surplusReturns;
  }

  @override
  int get hashCode => Object.hash(startingBalance, surplusPrincipal, surplusReturns);
}

class AppModel extends ChangeNotifier {
  AppModel() {
    agents.addAll(_seedDefaultAgents());
    syncAllocationsFromFraction(notify: false);
    _seedDummyCashflowData();
  }

  static const double spendVarianceBandPct = 0.10;
  static const Color spendOverColor = Color(0xFFEF4444); // red
  static const Color spendUnderColor = Color(0xFF10B981); // green
  static const Color spendInBandColor = AppTheme.slate600; // grey
  static const Color spendNoDataColor = AppTheme.slate500;

  /// Seeded “Morning briefing” agent id (scheduled task template references this).
  static const String morningBriefingAgentId = 'agent-morning-briefing';

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

      // If the device has no persisted keys yet, allow compile-time injected keys
      // (Debug builds and explicit on-device Release runs) to seed secure storage once.
      final allowSeed = CompileTimeApiKeys.allowLocalKeyAutofill;
      if (allowSeed) {
        final openAiSeed = CompileTimeApiKeys.openAiApiKey.trim();
        final geminiSeed = CompileTimeApiKeys.geminiApiKey.trim();
        if ((openAiApiKey ?? '').trim().isEmpty && openAiSeed.isNotEmpty) {
          setApiKey(provider: LlmProvider.openai, key: openAiSeed);
        }
        if ((geminiApiKey ?? '').trim().isEmpty && geminiSeed.isNotEmpty) {
          setApiKey(provider: LlmProvider.gemini, key: geminiSeed);
        }
      }

      final disk = await AppStateStore.load();
      if (disk != null) {
        applyPersistedSnapshot(disk);
      }
      await refreshAppleFoundationCapabilities();
      _syncActiveProviderIfKeyRemoved();
      await runDueScheduledAgentTasks();
    } finally {
      _bootstrapped = true;
      notifyListeners();
    }
  }

  Color get accent => AppTheme.primaryBlue;

  Color get accentSoft => accent.withValues(alpha: 0.12);

  /// When true, monetary figures are masked (e.g. on Home and Ledger). Toggled from Home.
  bool privacyHideAmounts = false;

  /// Drives [MaterialApp.themeMode]. Persisted in [AppStateStore].
  ThemeMode themeModePreference = ThemeMode.system;

  void setThemeMode(ThemeMode mode) {
    if (themeModePreference == mode) return;
    themeModePreference = mode;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Optional short motivation/summary shown at the top of Home when non-empty.
  String homeSummaryText = '';

  void setHomeSummaryText(String value) {
    homeSummaryText = value;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Agents (UI-only). Seeded in constructor; replaced when persisted settings load.
  final List<AppAgent> agents = [];

  int _appStatePersistRevision = 0;

  void _scheduleAppStatePersist() {
    _appStatePersistRevision++;
    final rev = _appStatePersistRevision;
    Future<void> run() async {
      if (rev != _appStatePersistRevision) return;
      try {
        await AppStateStore.save(buildPersistedSnapshot());
      } catch (_) {}
    }

    Future.microtask(run);
  }

  Future<void> persistAppStateToDisk() async {
    try {
      await AppStateStore.save(buildPersistedSnapshot());
    } catch (_) {}
  }

  /// Restores state from [AppStateStore] JSON (e.g. after load or in tests).
  void applyPersistedSnapshot(Map<String, dynamic> root) => _applyAppStateMap(root);

  /// Full on-disk snapshot (API keys excluded).
  Map<String, dynamic> buildPersistedSnapshot() => _buildAppStateMap();

  final List<ScheduledAgentTask> scheduledAgentTasks = [
    ScheduledAgentTask.defaultMorningBriefing(agentId: morningBriefingAgentId),
  ];

  void addScheduledTask(ScheduledAgentTask task) {
    scheduledAgentTasks.add(task);
    _scheduleAppStatePersist();
    unawaited(_syncTaskNotification(task));
    notifyListeners();
  }

  void updateScheduledTaskAt(int index, ScheduledAgentTask task) {
    if (index < 0 || index >= scheduledAgentTasks.length) return;
    scheduledAgentTasks[index] = task;
    _scheduleAppStatePersist();
    unawaited(_syncTaskNotification(task));
    notifyListeners();
  }

  void removeScheduledTaskAt(int index) {
    if (index < 0 || index >= scheduledAgentTasks.length) return;
    final removed = scheduledAgentTasks.removeAt(index);
    _scheduleAppStatePersist();
    unawaited(NotificationService.instance.cancelAgentTask(removed.id));
    notifyListeners();
  }

  Future<void> _syncTaskNotification(ScheduledAgentTask t) async {
    try {
      await NotificationService.instance.scheduleAgentTask(
        task: t,
        masterEnabled: notificationsEnabled,
      );
    } catch (_) {}
  }

  /// Runs enabled schedules that are due (e.g. after app resume). Persists [lastRunAt] updates.
  Future<int> runDueScheduledAgentTasks() async {
    final runner = ScheduledAgentRunner();
    final n = await runner.runDueTasks(this, scheduledAgentTasks);
    if (n > 0) {
      _scheduleAppStatePersist();
      notifyListeners();
    }
    return n;
  }

  /// Per–internal-agent system prompt overrides (empty key → use [InternalAppAgentDefinition.defaultSystemPrompt]).
  final Map<String, String> _internalAgentSystemPromptById = {};

  String internalAgentSystemPrompt(String agentId) {
    final stored = _internalAgentSystemPromptById[agentId];
    if (stored != null) return stored;
    return internalAppAgentDefinitionById(agentId)?.defaultSystemPrompt ?? '';
  }

  void setInternalAgentSystemPrompt(String agentId, String value) {
    _internalAgentSystemPromptById[agentId] = value;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Last structured JSON per internal agent (e.g. for App agents detail / debugging).
  final Map<String, Map<String, Object?>> internalAgentLastStructuredById = {};

  final Map<String, DateTime> internalAgentLastRunById = {};

  void recordInternalAgentRun(String agentId, Map<String, Object?> structured) {
    internalAgentLastStructuredById[agentId] = Map<String, Object?>.from(structured);
    internalAgentLastRunById[agentId] = DateTime.now();
    _scheduleAppStatePersist();
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
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Chats are always tied to an agent; threads and messages persist in [AppStateStore].
  final List<AgentChatThread> chats = [];

  final Map<String, List<ChatMessage>> _chatMessagesByThreadId = {};

  List<ChatMessage> chatMessagesFor(String threadId) {
    final list = _chatMessagesByThreadId[threadId];
    if (list == null) return [];
    return List<ChatMessage>.from(list);
  }

  void setChatMessagesFor(String threadId, List<ChatMessage> messages) {
    _chatMessagesByThreadId[threadId] = List<ChatMessage>.from(messages);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void appendChatMessage(String threadId, ChatMessage message) {
    _chatMessagesByThreadId.putIfAbsent(threadId, () => []).add(message);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Permissions / keys (UI-only). Used by Chat and (later) Agents.
  LlmProvider activeLlmProvider = LlmProvider.openai;
  String? openAiApiKey;
  String? anthropicApiKey;
  String? geminiApiKey;

  /// Apple on-device model (no API key). When [appleFoundationEnabled] and runtime says available, [apiKeyFor] uses a sentinel.
  bool appleFoundationEnabled = false;
  bool _appleFoundationEnabledReadFromDisk = false;
  AppleFoundationCapabilities _appleFoundationCaps = AppleFoundationCapabilities.unsupported;
  final AppleFoundationChannel _appleFoundationChannel = AppleFoundationChannel();

  static const String appleOnDeviceApiKeySentinel = '__zoro_ondevice_apple__';

  bool get appleFoundationRuntimeAvailable => _appleFoundationCaps.available;

  String? get appleFoundationDisabledReason => _appleFoundationCaps.disabledReason;

  Future<void> refreshAppleFoundationCapabilities() async {
    _appleFoundationCaps = await _appleFoundationChannel.getCapabilities();
    if (!_appleFoundationEnabledReadFromDisk && _appleFoundationCaps.available) {
      appleFoundationEnabled = true;
      _scheduleAppStatePersist();
    }
    notifyListeners();
  }

  void setAppleFoundationEnabled(bool value) {
    _appleFoundationEnabledReadFromDisk = true;
    if (appleFoundationEnabled == value) {
      notifyListeners();
      return;
    }
    appleFoundationEnabled = value;
    _syncActiveProviderIfKeyRemoved();
    _scheduleAppStatePersist();
    notifyListeners();
  }

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

  /// Master local-notifications switch (defaults off — user opts in from Settings).
  /// When false, no notification of any kind is posted.
  bool notificationsEnabled = false;

  /// Local time-of-day used by the reminder-check background job to decide when to
  /// post an "X items need attention" notification. Defaults to 09:00.
  int reminderNotifyHour = 9;
  int reminderNotifyMinute = 0;

  /// Per-domain timestamp of the last notification posted for that domain.
  /// Kept around for analytics / future fine-grained back-off, but no longer
  /// gates [isReminderNotifiable]; the once-per-day rotation gate below is
  /// what actually prevents spam.
  DateTime? remindersLastNotifiedExpenses;
  DateTime? remindersLastNotifiedCashflow;
  DateTime? remindersLastNotifiedIncome;
  DateTime? remindersLastNotifiedAssets;
  DateTime? remindersLastNotifiedLiabilities;

  /// Calendar day (local) on which the daily rotation push last fired.
  /// `null` means "never fired" — first eligible day will fire.
  DateTime? remindersLastFiredOn;

  /// Domain that fired during the most recent daily push. Drives rotation —
  /// the next fire picks the *next* eligible domain after this one.
  ReminderDomain? remindersLastFiredDomain;

  /// "Has the user actually touched this domain at least once?" — set by domain
  /// mutation methods. Necessary because [_seedDummyCashflowData] pre-populates
  /// [incomeLastUpdated]/etc. with fixed historic dates on first run, so a plain
  /// `last != null` check would buzz fresh installs immediately.
  bool userTouchedExpenses = false;
  bool userTouchedIncome = false;
  bool userTouchedAssets = false;
  bool userTouchedLiabilities = false;

  /// THB matches [expensePresetCountry] bucket units so the Sankey and ledger stay aligned at boot.
  CurrencyCode displayCurrency = CurrencyCode.thb;

  /// Home uses a 3-way currency toggle: USD + two user-pickable currencies.
  CurrencyCode homeCurrencyQuickPick1 = CurrencyCode.thb;
  CurrencyCode homeCurrencyQuickPick2 = CurrencyCode.inr;

  void setHomeCurrencyQuickPick(int slot, CurrencyCode next) {
    if (next == CurrencyCode.usd) return; // USD is always present as its own toggle.
    final prev = (slot == 1) ? homeCurrencyQuickPick1 : (slot == 2 ? homeCurrencyQuickPick2 : null);
    if (prev == null) return;
    if (slot == 1) {
      if (homeCurrencyQuickPick1 == next) return;
      homeCurrencyQuickPick1 = next;
    } else if (slot == 2) {
      if (homeCurrencyQuickPick2 == next) return;
      homeCurrencyQuickPick2 = next;
    } else {
      return;
    }

    // Keep the % sliders “the same” when swapping currencies in Home slots:
    // copy the previous slot currency’s current values onto the new currency entry.
    final inv = projectionInvestReturnPctAnnual[prev];
    final sav = projectionSavingsReturnPctAnnual[prev];
    final inf = projectionInflationPctAnnual[prev];
    if (inv != null) projectionInvestReturnPctAnnual[next] = inv;
    if (sav != null) projectionSavingsReturnPctAnnual[next] = sav;
    if (inf != null) projectionInflationPctAnnual[next] = inf;

    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Optional FX overrides: USD value of **1 unit** of THB/INR (same convention as [CurrencyCodeUi.usdPerUnit]).
  /// Empty → use built-in defaults in [currency.dart].
  final Map<CurrencyCode, double> _fxUsdPerUnitOverride = {};

  double usdPerUnitResolved(CurrencyCode c) {
    if (c == CurrencyCode.usd) return 1.0;
    return _fxUsdPerUnitOverride[c] ?? c.usdPerUnit;
  }

  Map<CurrencyCode, double> get fxUsdPerUnitResolved => {
        for (final c in CurrencyCode.values) c: usdPerUnitResolved(c),
      };

  void setFxUsdPerUnitOverride(CurrencyCode currency, double? usdPerUnit) {
    if (currency == CurrencyCode.usd) return;
    if (usdPerUnit == null || usdPerUnit <= 0) {
      _fxUsdPerUnitOverride.remove(currency);
    } else {
      _fxUsdPerUnitOverride[currency] = usdPerUnit;
    }
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Nominal annual **percent** (e.g. 7.0 = 7%) for the 10-year net worth projection, per currency.
  final Map<CurrencyCode, double> projectionInvestReturnPctAnnual = {
    CurrencyCode.usd: 8.0,
    CurrencyCode.thb: 6.0,
    CurrencyCode.inr: 12.0,
    CurrencyCode.aed: 7.0,
    CurrencyCode.sgd: 6.5,
    CurrencyCode.aud: 7.0,
    CurrencyCode.eur: 7.0,
    CurrencyCode.jpy: 6.0,
  };

  final Map<CurrencyCode, double> projectionSavingsReturnPctAnnual = {
    CurrencyCode.usd: 4.0,
    CurrencyCode.thb: 2.0,
    CurrencyCode.inr: 8.0,
    CurrencyCode.aed: 3.5,
    CurrencyCode.sgd: 3.5,
    CurrencyCode.aud: 4.0,
    CurrencyCode.eur: 3.5,
    CurrencyCode.jpy: 1.0,
  };

  final Map<CurrencyCode, double> projectionInflationPctAnnual = {
    CurrencyCode.usd: 2.0,
    CurrencyCode.thb: 0.0,
    CurrencyCode.inr: 6.0,
    CurrencyCode.aed: 3.0,
    CurrencyCode.sgd: 2.5,
    CurrencyCode.aud: 3.0,
    CurrencyCode.eur: 2.5,
    CurrencyCode.jpy: 2.0,
  };

  void setProjectionRatesForCurrency(
    CurrencyCode c, {
    double? investPct,
    double? savingsPct,
    double? inflationPct,
  }) {
    if (investPct != null) projectionInvestReturnPctAnnual[c] = investPct.clamp(-20.0, 50.0);
    if (savingsPct != null) projectionSavingsReturnPctAnnual[c] = savingsPct.clamp(-20.0, 50.0);
    if (inflationPct != null) projectionInflationPctAnnual[c] = inflationPct.clamp(-5.0, 50.0);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// 11 values: year 0 … year 10. Uses blended nominal return (split slider) + annualized surplus.
  List<double> netWorthProjection11Y() {
    final nw0 = netWorthDisplay;
    final f = allocInvestFraction.clamp(0.0, 1.0);
    final cur = displayCurrency;
    final ri = (projectionInvestReturnPctAnnual[cur] ?? 0) / 100.0;
    final rs = (projectionSavingsReturnPctAnnual[cur] ?? 0) / 100.0;
    final rInf = (projectionInflationPctAnnual[cur] ?? 0) / 100.0;
    final rBlendNominal = f * ri + (1 - f) * rs;
    // Real growth on the balance (contributions stay nominal / simplified).
    final rGrow = rInf >= 0 ? ((1 + rBlendNominal) / (1 + rInf)) - 1 : rBlendNominal;
    final annualAdd = (availableAfterExpensesMonthly * 12).clamp(0, double.infinity);
    var balance = nw0;
    final out = <double>[balance];
    for (var y = 1; y <= 10; y++) {
      balance = balance * (1 + rGrow) + annualAdd;
      out.add(balance);
    }
    return out;
  }

  /// Decomposes [series]\[[yearIndex]\]: nominal today’s NW, new money, and all returns (incl. on starting capital).
  NetWorthProjectionYearBreakdown projectionYearBreakdown(int yearIndex, List<double> series) {
    if (yearIndex < 0 || yearIndex >= series.length) {
      return const NetWorthProjectionYearBreakdown(
        startingBalance: 0,
        surplusPrincipal: 0,
        surplusReturns: 0,
      );
    }
    final target = series[yearIndex];
    final nw0 = netWorthDisplay;
    if (yearIndex == 0) {
      return NetWorthProjectionYearBreakdown(
        startingBalance: target,
        surplusPrincipal: 0,
        surplusReturns: 0,
      );
    }

    final annualAdd = (availableAfterExpensesMonthly * 12).clamp(0, double.infinity);
    final y = yearIndex;
    final remainder = target - nw0;
    if (remainder <= 1e-9) {
      return NetWorthProjectionYearBreakdown(
        startingBalance: target,
        surplusPrincipal: 0,
        surplusReturns: 0,
      );
    }

    final rawPrincipal = y * annualAdd;
    final surplusPrincipal = math.min(rawPrincipal, remainder).toDouble();
    final surplusReturns = (remainder - surplusPrincipal).clamp(0.0, double.infinity).toDouble();

    return NetWorthProjectionYearBreakdown(
      startingBalance: nw0,
      surplusPrincipal: surplusPrincipal,
      surplusReturns: surplusReturns,
    );
  }

  double get netWorthProjectedYear10Display {
    final s = netWorthProjection11Y();
    return s.isEmpty ? netWorthDisplay : s.last;
  }

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

  /// Primary cash / income account — Ledger → Cash tab name strip.
  /// When this row is **savings**, lists and net worth use the **latest month’s cash closing** (display currency), not [LedgerAssetRow.total].
  String? primaryIncomeAssetId;

  /// Latest saved month’s closing balance (display currency), or null if no cashflow months.
  double? get latestCashClosingBalanceDisplay {
    final keys = monthKeysWithCashflowData(limit: 1);
    if (keys.isEmpty) return null;
    return monthlyEntryFor(keys.first)?.closingBalance;
  }

  bool isPrimaryCashAsset(LedgerAssetRow r) =>
      primaryIncomeAssetId != null && r.id == primaryIncomeAssetId;

  /// Primary **savings** row tracks the latest month closing (Cash tab); other types use [LedgerAssetRow.total].
  bool primaryCashBalanceIsMirrored(LedgerAssetRow r) =>
      isPrimaryCashAsset(r) && r.type == LedgerAssetType.savings;

  /// Contribution to net worth / home currency for one asset row.
  double assetDisplayValue(LedgerAssetRow r) {
    if (primaryCashBalanceIsMirrored(r)) {
      return latestCashClosingBalanceDisplay ?? 0;
    }
    return moneyInDisplayCurrency(r.total, currencyCodeForPresetCountry(r.currencyCountry));
  }

  void _sortAssetsByDisplayValueDescending() {
    if (assets.length <= 1) return;
    final withIx = <({int ix, LedgerAssetRow row})>[
      for (var i = 0; i < assets.length; i++) (ix: i, row: assets[i]),
    ];
    withIx.sort((a, b) {
      final va = assetDisplayValue(a.row);
      final vb = assetDisplayValue(b.row);
      final c = vb.compareTo(va);
      if (c != 0) return c;
      return a.ix.compareTo(b.ix);
    });
    assets
      ..clear()
      ..addAll(withIx.map((e) => e.row));
  }

  void setPrimaryIncomeAssetId(String? id) {
    if (primaryIncomeAssetId == id) return;
    primaryIncomeAssetId = id;
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Registers the primary cash row and links it (list order follows value, not “pinned” to top).
  void registerPrimaryCashAsset(LedgerAssetRow row) {
    final ix = assets.indexWhere((a) => a.id == row.id);
    if (ix < 0) {
      assets.add(row);
    }
    primaryIncomeAssetId = row.id;
    _sortAssetsByDisplayValueDescending();
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void _applyDisplayDeltaToAssetTotal(String assetId, double deltaDisplay) {
    final a = assetById(assetId);
    if (a == null || deltaDisplay.abs() < 0.005) return;
    final to = currencyCodeForPresetCountry(a.currencyCountry);
    final converted = convertCurrency(
      value: deltaDisplay,
      from: displayCurrency,
      to: to,
      usdPerUnitOverrides: fxUsdPerUnitResolved,
    );
    a.total += converted;
  }

  /// Undo [MonthlyInvestmentLine.amountAppliedToAssets] for this month (display-currency amounts).
  void reverseInvestmentCreditsForMonth(String monthKey) {
    final e = monthlyEntryFor(monthKey);
    if (e == null) return;
    for (final line in e.investmentLines) {
      final applied = line.amountAppliedToAssets;
      if (applied < 0.005 || (line.assetId ?? '').isEmpty) {
        line.amountAppliedToAssets = 0;
        continue;
      }
      _applyDisplayDeltaToAssetTotal(line.assetId!, -applied);
      line.amountAppliedToAssets = 0;
    }
  }

  /// Replaces month investment lines and credits asset totals when linking is complete.
  /// Returns whether the month is fully linked (totals match and every split has an asset).
  bool commitMonthInvestmentLinking(
    String monthKey,
    List<MonthlyInvestmentLine> newLinesRaw,
  ) {
    reverseInvestmentCreditsForMonth(monthKey);
    final e = monthlyEntryFor(monthKey);
    if (e == null) return false;
    final next = newLinesRaw.map((x) => x.clone()..amountAppliedToAssets = 0).toList();
    e.investmentLines
      ..clear()
      ..addAll(next);
    final complete = monthlyInvestmentLinkingComplete(e);
    if (complete) {
      for (final line in e.investmentLines) {
        if (line.amount <= 0.005 || (line.assetId ?? '').isEmpty) continue;
        _applyDisplayDeltaToAssetTotal(line.assetId!, line.amount);
        line.amountAppliedToAssets = line.amount;
      }
    }
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    touchMonthlyCashflowChanged();
    return complete;
  }

  /// Portion of post-expense net income allocated to investments (rest is cash / FDs).
  /// Range 0–1, always a multiple of 5% (Sankey target split).
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

  /// Accepts `YYYY-MM`; returns normalized key or null.
  static String? tryParseMonthKey(String raw) {
    final t = raw.trim();
    if (!RegExp(r'^\d{4}-\d{2}$').hasMatch(t)) return null;
    final parts = t.split('-');
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (y == null || m == null || m < 1 || m > 12) return null;
    return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}';
  }

  /// Default month when opening a **new** monthly cashflow row — previous calendar month
  /// (current month rarely has complete data).
  static String defaultCashflowEditorMonthKey([DateTime? now]) {
    final n = now ?? DateTime.now();
    final prev = DateTime(n.year, n.month - 1, 1);
    return monthKeyFor(prev);
  }

  /// Recent completed months for agents and payloads (**previous calendar month first**, then older).
  /// Omits the current month (e.g. in May, first key is April — six completed months by default).
  static List<String> recentMonthKeys({int count = 6}) {
    final now = DateTime.now();
    final anchor = DateTime(now.year, now.month - 1, 1);
    return List.generate(count, (i) {
      final d = DateTime(anchor.year, anchor.month - i, 1);
      return monthKeyFor(d);
    });
  }

  /// Month keys that have cashflow data, newest-first (YYYY-MM).
  /// Safe for long histories (e.g. 12+ months).
  List<String> monthKeysWithCashflowData({int? limit}) {
    final keys = monthlyCashflowByMonth.keys.toList()..sort((a, b) => b.compareTo(a));
    if (limit != null && keys.length > limit) {
      return keys.take(limit).toList();
    }
    return keys;
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

  static String? previousMonthKey(String monthKey) {
    final parts = monthKey.split('-');
    if (parts.length != 2) return null;
    final y = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (y == null || m == null) return null;
    final d = DateTime(y, m - 1, 1);
    return monthKeyFor(d);
  }

  void setPrivacyHideAmounts(bool value) {
    if (privacyHideAmounts == value) return;
    privacyHideAmounts = value;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void addAgent(AppAgent agent) {
    agents.add(agent);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void updateAgent(int index, AppAgent agent) {
    if (index < 0 || index >= agents.length) return;
    agents[index] = agent;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeAgentAt(int index) {
    if (index < 0 || index >= agents.length) return;
    agents.removeAt(index);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void upsertAgentFromTool(AppAgent incoming) {
    final idx = agents.indexWhere((a) => a.id == incoming.id);
    if (idx >= 0) {
      agents[idx] = incoming;
    } else {
      agents.add(incoming);
    }
    _scheduleAppStatePersist();
    notifyListeners();
  }

  bool removeAgentByIdForTool(String id) {
    final idx = agents.indexWhere((a) => a.id == id);
    if (idx < 0) return false;
    agents.removeAt(idx);
    _scheduleAppStatePersist();
    notifyListeners();
    return true;
  }

  void addChat(AgentChatThread t) {
    chats.add(t);
    _chatMessagesByThreadId.putIfAbsent(t.id, () => []);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeChatById(String id) {
    final idx = chats.indexWhere((t) => t.id == id);
    if (idx < 0) return;
    chats.removeAt(idx);
    _chatMessagesByThreadId.remove(id);
    _scheduleAppStatePersist();
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
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void updateChat(int index, AgentChatThread t) {
    if (index < 0 || index >= chats.length) return;
    chats[index] = t;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setActiveLlmProvider(LlmProvider p) {
    if (activeLlmProvider == p) return;
    activeLlmProvider = p;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setApiKey({required LlmProvider provider, String? key}) {
    if (provider == LlmProvider.appleFoundation) return;
    final trimmed = (key ?? '').trim();
    final v = trimmed.isEmpty ? null : trimmed;
    switch (provider) {
      case LlmProvider.appleFoundation:
        break;
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
        LlmProvider.appleFoundation =>
          (appleFoundationRuntimeAvailable && appleFoundationEnabled) ? appleOnDeviceApiKeySentinel : null,
        LlmProvider.openai => openAiApiKey,
        LlmProvider.anthropic => anthropicApiKey,
        LlmProvider.gemini => geminiApiKey,
      };

  String modelFor(LlmProvider provider) => switch (provider) {
        LlmProvider.appleFoundation => 'apple-on-device',
        LlmProvider.openai => openAiModel,
        LlmProvider.anthropic => anthropicModel,
        LlmProvider.gemini => geminiModel,
      };

  void setModelFor(LlmProvider provider, String model) {
    if (provider == LlmProvider.appleFoundation) return;
    final next = model.trim();
    if (next.isEmpty) return;
    switch (provider) {
      case LlmProvider.appleFoundation:
        break;
      case LlmProvider.openai:
        openAiModel = next;
      case LlmProvider.anthropic:
        anthropicModel = next;
      case LlmProvider.gemini:
        geminiModel = next;
    }
    _scheduleAppStatePersist();
    notifyListeners();
  }

  // Temperature removed: some models/providers reject non-default values.

  bool get hasAnyApiKey => openAiApiKey != null || anthropicApiKey != null || geminiApiKey != null;

  /// Cloud API key or Apple on-device model when enabled and available.
  bool get canUseAnyLlm =>
      hasAnyApiKey || (appleFoundationEnabled && appleFoundationRuntimeAvailable);

  void setReminderCadenceExpenses(ReminderCadence v) {
    remindersExpensesCadence = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setReminderCadenceCashflow(ReminderCadence v) {
    remindersCashflowCadence = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setReminderCadenceIncome(ReminderCadence v) {
    remindersIncomeCadence = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setReminderCadenceAssets(ReminderCadence v) {
    remindersAssetsCadence = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setReminderCadenceLiabilities(ReminderCadence v) {
    remindersLiabilitiesCadence = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setRemindersMonthlyDayOfMonth(int d) {
    final next = d.clamp(1, 28);
    if (remindersMonthlyDayOfMonth == next) return;
    remindersMonthlyDayOfMonth = next;
    _scheduleAppStatePersist();
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
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setRemindersYearlyDate({required int month, required int day}) {
    final m = month.clamp(1, 12);
    final d = day.clamp(1, 31);
    if (remindersYearlyMonth == m && remindersYearlyDay == d) return;
    remindersYearlyMonth = m;
    remindersYearlyDay = d;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setNotificationsEnabled(bool v) {
    if (notificationsEnabled == v) return;
    notificationsEnabled = v;
    _scheduleAppStatePersist();
    unawaited(syncNotifications());
    notifyListeners();
  }

  void setReminderNotifyTime({required int hour, required int minute}) {
    final h = hour.clamp(0, 23);
    final m = minute.clamp(0, 59);
    if (reminderNotifyHour == h && reminderNotifyMinute == m) return;
    reminderNotifyHour = h;
    reminderNotifyMinute = m;
    _scheduleAppStatePersist();
    unawaited(syncNotifications());
    notifyListeners();
  }

  /// Records that we posted a notification for [d] now. Stops re-buzzing the same
  /// domain within the same cadence period.
  void markDomainNotified(ReminderDomain d, {DateTime? at}) {
    final t = at ?? DateTime.now();
    switch (d) {
      case ReminderDomain.expenses:
        remindersLastNotifiedExpenses = t;
      case ReminderDomain.cashflow:
        remindersLastNotifiedCashflow = t;
      case ReminderDomain.income:
        remindersLastNotifiedIncome = t;
      case ReminderDomain.assets:
        remindersLastNotifiedAssets = t;
      case ReminderDomain.liabilities:
        remindersLastNotifiedLiabilities = t;
    }
    _scheduleAppStatePersist();
  }

  DateTime? reminderLastNotifiedAt(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => remindersLastNotifiedExpenses,
        ReminderDomain.cashflow => remindersLastNotifiedCashflow,
        ReminderDomain.income => remindersLastNotifiedIncome,
        ReminderDomain.assets => remindersLastNotifiedAssets,
        ReminderDomain.liabilities => remindersLastNotifiedLiabilities,
      };

  /// Returns the cadence configured for [d].
  ReminderCadence reminderCadenceFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => remindersExpensesCadence,
        ReminderDomain.cashflow => remindersCashflowCadence,
        ReminderDomain.income => remindersIncomeCadence,
        ReminderDomain.assets => remindersAssetsCadence,
        ReminderDomain.liabilities => remindersLiabilitiesCadence,
      };

  /// True iff the user has actually populated [d] with their own data (not just
  /// the seeded dummies). Cashflow uses the presence of imported months rather
  /// than a `userTouched` flag because the seed clears [monthlyCashflowByMonth].
  bool userHasContentFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => userTouchedExpenses,
        ReminderDomain.cashflow => monthlyCashflowByMonth.isNotEmpty,
        ReminderDomain.income => userTouchedIncome,
        ReminderDomain.assets => userTouchedAssets,
        ReminderDomain.liabilities => userTouchedLiabilities,
      };

  bool _reviewOverdueFor(ReminderDomain d, DateTime now) => switch (d) {
        ReminderDomain.expenses => expensesReviewOverdueAt(now),
        ReminderDomain.cashflow => cashflowReviewOverdueAt(now),
        ReminderDomain.income => incomeReviewOverdueAt(now),
        ReminderDomain.assets => assetsReviewOverdueAt(now),
        ReminderDomain.liabilities => liabilitiesReviewOverdueAt(now),
      };

  /// Eligibility predicate for the daily rotation. Domain-only checks: master
  /// switch on, cadence ≠ Off, user actually has content, and review is
  /// overdue. The "fire at most once a day" gate lives in
  /// [canFireDailyReminderNow] / [maybePostDailyReminder] so eligibility stays
  /// independent of dispatch timing.
  bool isReminderNotifiable(ReminderDomain d, {DateTime? now}) {
    if (!notificationsEnabled) return false;
    if (reminderCadenceFor(d) == ReminderCadence.off) return false;
    if (!userHasContentFor(d)) return false;
    final n = now ?? DateTime.now();
    if (!_reviewOverdueFor(d, n)) return false;
    return true;
  }

  /// All reminder domains currently eligible to fire a notification. Empty
  /// when there's nothing to nudge about — the rotation poster does nothing
  /// (no "you're all caught up" buzz).
  List<ReminderDomain> notifiableReminderDomains({DateTime? now}) {
    final n = now ?? DateTime.now();
    return [
      for (final d in ReminderDomain.values)
        if (isReminderNotifiable(d, now: n)) d,
    ];
  }

  static bool _isSameLocalDay(DateTime a, DateTime b) {
    final al = a.toLocal();
    final bl = b.toLocal();
    return al.year == bl.year && al.month == bl.month && al.day == bl.day;
  }

  /// True when the rotation gate is currently open: notifications on, today's
  /// notify slot has been reached, and no reminder fired yet today.
  bool canFireDailyReminderNow({DateTime? now}) {
    if (!notificationsEnabled) return false;
    final n = (now ?? DateTime.now()).toLocal();
    final last = remindersLastFiredOn;
    if (last != null && _isSameLocalDay(last, n)) return false;
    final slot = DateTime(n.year, n.month, n.day, reminderNotifyHour, reminderNotifyMinute);
    if (n.isBefore(slot)) return false;
    return true;
  }

  /// The domain that should fire *next*: the first eligible domain after
  /// [remindersLastFiredDomain] in [ReminderDomain.values] order, wrapping
  /// around. Returns `null` when nothing is eligible right now.
  ReminderDomain? nextRotationDomain({DateTime? now}) {
    final eligible = notifiableReminderDomains(now: now);
    if (eligible.isEmpty) return null;
    final last = remindersLastFiredDomain;
    if (last == null) return eligible.first;
    final all = ReminderDomain.values;
    final startIdx = all.indexOf(last);
    for (var i = 1; i <= all.length; i++) {
      final candidate = all[(startIdx + i) % all.length];
      if (eligible.contains(candidate)) return candidate;
    }
    return eligible.first;
  }

  /// Records that a rotation push was fired for [domain] at [at] (defaults to
  /// now). Used by [maybePostDailyReminder]; tests can call it directly to
  /// stage state.
  void recordDailyReminderFired(ReminderDomain domain, {DateTime? at}) {
    final t = at ?? DateTime.now();
    remindersLastFiredOn = t;
    remindersLastFiredDomain = domain;
    markDomainNotified(domain, at: t);
  }

  /// Single entry point used by both the Workmanager background dispatcher and
  /// the foreground app lifecycle hooks. When the gate is open and there's an
  /// eligible domain, posts one rotation push and persists state synchronously
  /// (await — important: the background isolate dies right after this returns
  /// and a microtask-only persist can lose the "fired today" flag).
  ///
  /// Returns the domain that fired, or `null` when nothing was posted.
  Future<ReminderDomain?> maybePostDailyReminder({DateTime? now}) async {
    final n = now ?? DateTime.now();
    if (!canFireDailyReminderNow(now: n)) return null;
    final domain = nextRotationDomain(now: n);
    if (domain == null) return null;
    try {
      await NotificationService.instance.postReminderForDomain(domain);
    } catch (_) {
      return null;
    }
    recordDailyReminderFired(domain, at: n);
    await persistAppStateToDisk();
    notifyListeners();
    return domain;
  }

  /// Pushes the current notification configuration to the OS:
  /// - cancels everything when [notificationsEnabled] is false,
  /// - (re)schedules each `notify == true` agent task at its next local time.
  ///
  /// Reminder pushes are *not* pre-scheduled here. They are emitted at
  /// runtime by [maybePostDailyReminder] from Workmanager background runs and
  /// app foreground/resume hooks. We also cancel any legacy daily
  /// reminder-check slot so it doesn't fire its payload-less placeholder.
  ///
  /// Best-effort; failures (plugin unsupported on web, missing permission) are
  /// swallowed so UI flows stay responsive.
  Future<void> syncNotifications() async {
    try {
      final svc = NotificationService.instance;
      if (!notificationsEnabled) {
        await svc.cancelAll();
        return;
      }
      for (final t in scheduledAgentTasks) {
        await svc.scheduleAgentTask(task: t, masterEnabled: true);
      }
      // Make sure no leftover daily placeholder push exists from older builds.
      await svc.cancelLegacyReminderCheckSlot();
    } catch (_) {
      // Notification sync is non-fatal.
    }
  }

  void setDisplayCurrency(CurrencyCode next) {
    if (displayCurrency == next) return;
    final from = displayCurrency;
    displayCurrency = next;
    final fx = fxUsdPerUnitResolved;
    expenseBuckets = {
      for (final e in expenseBuckets.entries)
        e.key: convertCurrency(value: e.value, from: from, to: next, usdPerUnitOverrides: fx),
    };
    for (final e in monthlyCashflowByMonth.values) {
      e.openingBalance = convertCurrency(value: e.openingBalance, from: from, to: next, usdPerUnitOverrides: fx);
      e.closingBalance = convertCurrency(value: e.closingBalance, from: from, to: next, usdPerUnitOverrides: fx);
      e.monthlyEarned = convertCurrency(value: e.monthlyEarned, from: from, to: next, usdPerUnitOverrides: fx);
      e.outflowToCashFd = convertCurrency(value: e.outflowToCashFd, from: from, to: next, usdPerUnitOverrides: fx);
      e.outflowToInvested = convertCurrency(value: e.outflowToInvested, from: from, to: next, usdPerUnitOverrides: fx);
      e.monthlySpending = convertCurrency(value: e.monthlySpending, from: from, to: next, usdPerUnitOverrides: fx);
      for (final il in e.investmentLines) {
        il.amount = convertCurrency(value: il.amount, from: from, to: next, usdPerUnitOverrides: fx);
        il.amountAppliedToAssets = convertCurrency(
          value: il.amountAppliedToAssets,
          from: from,
          to: next,
          usdPerUnitOverrides: fx,
        );
      }
    }
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  double moneyInDisplayCurrency(double v, CurrencyCode from) {
    return convertCurrency(
      value: v,
      from: from,
      to: displayCurrency,
      usdPerUnitOverrides: fxUsdPerUnitResolved,
    );
  }

  String moneyDisplay(double v, CurrencyCode from, {int? decimals}) {
    final converted = moneyInDisplayCurrency(v, from);
    return formatMoney(converted, currency: displayCurrency, decimals: decimals);
  }

  double get totalAssetsDisplay =>
      assets.fold<double>(0, (s, r) => s + assetDisplayValue(r));

  double get totalLiabilitiesDisplay => liabilities.fold<double>(
        0,
        (s, r) => s + moneyInDisplayCurrency(r.total, currencyCodeForPresetCountry(r.currencyCountry)),
      );

  double get netWorthDisplay => totalAssetsDisplay - totalLiabilitiesDisplay;

  String get defaultLedgerCurrencyCountry =>
      incomeLines.isEmpty ? expensePresetCountry : incomeLines.first.currencyCountry;

  void addAsset(LedgerAssetRow row) {
    assets.add(row);
    _sortAssetsByDisplayValueDescending();
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void replaceAsset(int index, LedgerAssetRow row) {
    if (index < 0 || index >= assets.length) return;
    assets[index] = row;
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeAssetAt(int index) {
    if (assets.length <= 1 || index < 0 || index >= assets.length) return;
    final removedId = assets[index].id;
    assets.removeAt(index);
    if (primaryIncomeAssetId == removedId) {
      primaryIncomeAssetId = null;
    }
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void addLiability(LedgerLiabilityRow row) {
    liabilities.add(row);
    liabilitiesLastReviewed = DateTime.now();
    userTouchedLiabilities = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void replaceLiability(int index, LedgerLiabilityRow row) {
    if (index < 0 || index >= liabilities.length) return;
    liabilities[index] = row;
    liabilitiesLastReviewed = DateTime.now();
    userTouchedLiabilities = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeLiabilityAt(int index) {
    if (index < 0 || index >= liabilities.length) return;
    liabilities.removeAt(index);
    liabilitiesLastReviewed = DateTime.now();
    userTouchedLiabilities = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void addIncomeLine({String? defaultCurrencyCountry}) {
    incomeLines.add(
      CashflowIncomeLine.blank(
        defaultCurrencyCountry: defaultCurrencyCountry ?? defaultLedgerCurrencyCountry,
      ),
    );
    incomeLastUpdated = DateTime.now();
    userTouchedIncome = true;
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeIncomeLineAt(int index) {
    if (index < 0 || index >= incomeLines.length) return;
    incomeLines.removeAt(index);
    incomeLastUpdated = DateTime.now();
    userTouchedIncome = true;
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
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
    if (primaryCashBalanceIsMirrored(a)) return false;
    a.total = total;
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
    return true;
  }

  bool tryUpdateLiabilityTotalById(String id, double total) {
    final row = liabilityById(id);
    if (row == null) return false;
    row.total = total;
    liabilitiesLastReviewed = DateTime.now();
    userTouchedLiabilities = true;
    _scheduleAppStatePersist();
    notifyListeners();
    return true;
  }

  void notifyIncomeChanged() {
    incomeLastUpdated = DateTime.now();
    userTouchedIncome = true;
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setEffectiveTaxRatePct(double? v) {
    effectiveTaxRatePct = v;
    incomeLastUpdated = DateTime.now();
    userTouchedIncome = true;
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setExpenseBucket(String key, double value) {
    expenseBuckets = {...expenseBuckets, key: value};
    userTouchedExpenses = true;
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void markExpenseEstimatesUpdated() {
    expenseEstimatesLastUpdated = DateTime.now();
    userTouchedExpenses = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setExpenseBucketContextMarkdown({required String bucketKey, required String markdown}) {
    expenseBucketContextMarkdown = {...expenseBucketContextMarkdown, bucketKey: markdown};
    _touchContextNoteSaved(contextKeyBucket(bucketKey));
    _scheduleAppStatePersist();
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
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// After editing a [MonthlyInvestmentLine] in place (e.g. Cash → Invest detail sheet).
  void touchMonthlyCashflowChanged() {
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void touchAssetsChanged() {
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setMonthlyCashflowContextMarkdown({required String monthKey, required String markdown}) {
    final e = monthlyCashflowByMonth[monthKey];
    if (e == null) return;
    e.contextMarkdown = markdown.trim();
    _touchContextNoteSaved(contextKeyMonth(monthKey));
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeMonthlyCashflow(String monthKey) {
    monthlyCashflowByMonth.remove(monthKey);
    _scheduleAppStatePersist();
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
    userTouchedAssets = true;
    _touchContextNoteSaved(contextKeyAsset(assetId));
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setLiabilityContextMarkdown({required String liabilityId, required String markdown}) {
    final idx = liabilities.indexWhere((l) => l.id == liabilityId);
    if (idx < 0) return;
    liabilities[idx].contextMarkdown = markdown;
    liabilitiesLastReviewed = DateTime.now();
    userTouchedLiabilities = true;
    _touchContextNoteSaved(contextKeyLiability(liabilityId));
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setMonthlyEntryContextMarkdown({required String monthKey, required String markdown}) {
    final e = monthlyCashflowByMonth[monthKey];
    if (e == null) return;
    e.contextMarkdown = markdown;
    _touchContextNoteSaved(contextKeyMonth(monthKey));
    _scheduleAppStatePersist();
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
    // Intentionally do NOT seed monthly cashflow history.
    // Users should enter the last ~6 months manually so month-to-month balances stay consistent.
    monthlyCashflowByMonth.clear();
  }

  double get totalIncomeAnnualDisplay => incomeLines.fold<double>(
        0,
        (s, line) =>
            s +
            moneyInDisplayCurrency(
              line.annualAmount,
              currencyCodeForIncomeLineCurrency(line.currencyCountry),
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
    _scheduleAppStatePersist();
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
      _scheduleAppStatePersist();
      notifyListeners();
      return;
    }
    allocInvestFraction = _quantizeAllocInvestFraction(v / avail);
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
  }

  void setAllocationSavings(double v) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestFraction = 0;
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
      _scheduleAppStatePersist();
      notifyListeners();
      return;
    }
    allocInvestFraction = _quantizeAllocInvestFraction(1.0 - (v / avail));
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
  }

  void normalizeAllocations({bool notify = true}) {
    syncAllocationsFromFraction(notify: notify);
  }

  Map<String, dynamic> _buildAppStateMap() {
    return {
      'formatVersion': app_state.kAppStateFormatVersion,
      'savedAtMs': DateTime.now().toUtc().millisecondsSinceEpoch,
      'settings': {
        'agents': agents.map(appAgentToJson).toList(),
        'activeLlmProvider': activeLlmProvider.name,
        'appleFoundationEnabled': appleFoundationEnabled,
        'openAiModel': openAiModel,
        'anthropicModel': anthropicModel,
        'geminiModel': geminiModel,
        'privacyHideAmounts': privacyHideAmounts,
        'homeSummaryText': homeSummaryText,
        'displayCurrency': displayCurrency.name,
        'homeCurrencyQuickPick1': homeCurrencyQuickPick1.name,
        'homeCurrencyQuickPick2': homeCurrencyQuickPick2.name,
        'themeMode': themeModePreference.name,
        'notifications': app_state.encodeNotificationsBlock(this),
        'remindersExpensesCadence': remindersExpensesCadence.name,
        'remindersCashflowCadence': remindersCashflowCadence.name,
        'remindersIncomeCadence': remindersIncomeCadence.name,
        'remindersAssetsCadence': remindersAssetsCadence.name,
        'remindersLiabilitiesCadence': remindersLiabilitiesCadence.name,
        'remindersMonthlyDayOfMonth': remindersMonthlyDayOfMonth,
        'remindersQuarterMonthInQuarter': remindersQuarterMonthInQuarter,
        'remindersQuarterDay': remindersQuarterDay,
        'remindersYearlyMonth': remindersYearlyMonth,
        'remindersYearlyDay': remindersYearlyDay,
      },
      'ledger': {
        'assets': assets.map(app_state.encodeLedgerAssetRow).toList(),
        'liabilities': liabilities.map(app_state.encodeLedgerLiabilityRow).toList(),
        'incomeLines': incomeLines.map(app_state.encodeIncomeLine).toList(),
        'expenseBuckets': expenseBuckets,
        'expenseBucketContextMarkdown': expenseBucketContextMarkdown,
        'monthlyCashflowByMonth': {
          for (final e in monthlyCashflowByMonth.entries) e.key: app_state.encodeMonthlyCashflowEntry(e.value),
        },
        'primaryIncomeAssetId': primaryIncomeAssetId,
        'effectiveTaxRatePct': effectiveTaxRatePct,
        'incomeLastUpdated': incomeLastUpdated?.toUtc().toIso8601String(),
        'expenseEstimatesLastUpdated': expenseEstimatesLastUpdated?.toUtc().toIso8601String(),
        'allocationTargetLastUpdated': allocationTargetLastUpdated?.toUtc().toIso8601String(),
        'assetsLastReviewed': assetsLastReviewed?.toUtc().toIso8601String(),
        'liabilitiesLastReviewed': liabilitiesLastReviewed?.toUtc().toIso8601String(),
        'allocInvestFraction': allocInvestFraction,
        'allocInvestmentsMonthly': allocInvestmentsMonthly,
        'allocSavingsMonthly': allocSavingsMonthly,
        'fxUsdPerUnitOverride': {
          for (final e in _fxUsdPerUnitOverride.entries) e.key.name: e.value,
        },
        'projectionInvestReturnPctAnnual': app_state.encodeProjectionMap(projectionInvestReturnPctAnnual),
        'projectionSavingsReturnPctAnnual': app_state.encodeProjectionMap(projectionSavingsReturnPctAnnual),
        'projectionInflationPctAnnual': app_state.encodeProjectionMap(projectionInflationPctAnnual),
      },
      'context': {
        'noteSavedAtUtc': {
          for (final e in contextNoteSavedAtUtc.entries) e.key: e.value.toUtc().millisecondsSinceEpoch,
        },
      },
      'internalAgents': {
        'systemPromptById': Map<String, String>.from(_internalAgentSystemPromptById),
        'lastStructuredById': {
          for (final e in internalAgentLastStructuredById.entries) e.key: app_state.tryJsonSafeEncode(e.value),
        },
        'lastRunById': {
          for (final e in internalAgentLastRunById.entries) e.key: e.value.toUtc().millisecondsSinceEpoch,
        },
      },
      'chats': {
        'version': 2,
        'threads': chats.map(app_state.encodeChatThread).toList(),
        'messages': {
          for (final e in _chatMessagesByThreadId.entries)
            e.key: e.value.map((m) => m.toJson()).toList(),
        },
      },
      'scheduledTasks': scheduledAgentTasks.map((t) => t.toJson()).toList(),
    };
  }

  void _applyAppStateMap(Map<String, dynamic> root) {
    final settings = root['settings'];
    if (settings is Map) {
      final s = Map<String, dynamic>.from(settings);
      final agentsRaw = s['agents'];
      if (agentsRaw is List) {
        agents
          ..clear()
          ..addAll([
            for (final e in agentsRaw)
              if (appAgentFromJson(e) != null) appAgentFromJson(e)!,
          ]);
      }
      final llm = s['activeLlmProvider']?.toString();
      if (llm != null) {
        for (final p in LlmProvider.values) {
          if (p.name == llm) {
            activeLlmProvider = p;
            break;
          }
        }
      }
      if (s.containsKey('appleFoundationEnabled')) {
        _appleFoundationEnabledReadFromDisk = true;
        appleFoundationEnabled = s['appleFoundationEnabled'] == true;
      }
      final oa = s['openAiModel']?.toString();
      if (oa != null && oa.trim().isNotEmpty) openAiModel = oa.trim();
      final an = s['anthropicModel']?.toString();
      if (an != null && an.trim().isNotEmpty) anthropicModel = an.trim();
      final gm = s['geminiModel']?.toString();
      if (gm != null && gm.trim().isNotEmpty) geminiModel = gm.trim();
      if (s['privacyHideAmounts'] == true) privacyHideAmounts = true;
      final h = s['homeSummaryText']?.toString();
      if (h != null) homeSummaryText = h;
      final dc = s['displayCurrency']?.toString();
      if (dc != null) {
        for (final c in CurrencyCode.values) {
          if (c.name == dc) {
            displayCurrency = c;
            break;
          }
        }
      }
      final hq1 = s['homeCurrencyQuickPick1']?.toString();
      if (hq1 != null) {
        for (final c in CurrencyCode.values) {
          if (c.name == hq1) {
            homeCurrencyQuickPick1 = c;
            break;
          }
        }
      }
      final hq2 = s['homeCurrencyQuickPick2']?.toString();
      if (hq2 != null) {
        for (final c in CurrencyCode.values) {
          if (c.name == hq2) {
            homeCurrencyQuickPick2 = c;
            break;
          }
        }
      }
      final tm = s['themeMode']?.toString();
      if (tm != null) {
        for (final mode in ThemeMode.values) {
          if (mode.name == tm) {
            themeModePreference = mode;
            break;
          }
        }
      }
      app_state.decodeNotificationsBlock(this, s['notifications']);
      remindersExpensesCadence = app_state.reminderCadenceFromJson(s['remindersExpensesCadence']);
      remindersCashflowCadence = app_state.reminderCadenceFromJson(s['remindersCashflowCadence']);
      remindersIncomeCadence = app_state.reminderCadenceFromJson(s['remindersIncomeCadence']);
      remindersAssetsCadence = app_state.reminderCadenceFromJson(s['remindersAssetsCadence']);
      remindersLiabilitiesCadence = app_state.reminderCadenceFromJson(s['remindersLiabilitiesCadence']);
      final md = s['remindersMonthlyDayOfMonth'];
      if (md is int) remindersMonthlyDayOfMonth = md.clamp(1, 28);
      if (md is num) remindersMonthlyDayOfMonth = md.round().clamp(1, 28);
      final qm = s['remindersQuarterMonthInQuarter'];
      if (qm is int) remindersQuarterMonthInQuarter = qm.clamp(1, 3);
      if (qm is num) remindersQuarterMonthInQuarter = qm.round().clamp(1, 3);
      final qd = s['remindersQuarterDay'];
      if (qd is int) remindersQuarterDay = qd.clamp(1, 31);
      if (qd is num) remindersQuarterDay = qd.round().clamp(1, 31);
      final ym = s['remindersYearlyMonth'];
      if (ym is int) remindersYearlyMonth = ym.clamp(1, 12);
      if (ym is num) remindersYearlyMonth = ym.round().clamp(1, 12);
      final yd = s['remindersYearlyDay'];
      if (yd is int) remindersYearlyDay = yd.clamp(1, 31);
      if (yd is num) remindersYearlyDay = yd.round().clamp(1, 31);
    }

    final ledger = root['ledger'];
    if (ledger is Map) {
      final L = Map<String, dynamic>.from(ledger);
      final assetsRaw = L['assets'];
      if (assetsRaw is List) {
        assets
          ..clear()
          ..addAll([
            for (final e in assetsRaw)
              if (app_state.decodeLedgerAssetRow(e) != null) app_state.decodeLedgerAssetRow(e)!,
          ]);
      }
      final liabRaw = L['liabilities'];
      if (liabRaw is List) {
        liabilities
          ..clear()
          ..addAll([
            for (final e in liabRaw)
              if (app_state.decodeLedgerLiabilityRow(e) != null) app_state.decodeLedgerLiabilityRow(e)!,
          ]);
      }
      final incRaw = L['incomeLines'];
      if (incRaw is List) {
        incomeLines
          ..clear()
          ..addAll([
            for (final e in incRaw)
              if (app_state.decodeIncomeLine(e) != null) app_state.decodeIncomeLine(e)!,
          ]);
      }
      final eb = L['expenseBuckets'];
      if (eb is Map) {
        for (final k in expenseBucketKeys) {
          final v = eb[k];
          final d = v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '');
          if (d != null) expenseBuckets[k] = d;
        }
      }
      final ectx = L['expenseBucketContextMarkdown'];
      if (ectx is Map) {
        for (final e in ectx.entries) {
          final key = e.key.toString();
          if (expenseBucketKeys.contains(key)) {
            expenseBucketContextMarkdown[key] = e.value?.toString() ?? '';
          }
        }
      }
      final mc = L['monthlyCashflowByMonth'];
      if (mc is Map) {
        monthlyCashflowByMonth.clear();
        for (final e in mc.entries) {
          final entry = app_state.decodeMonthlyCashflowEntry(e.value);
          if (entry != null) monthlyCashflowByMonth[e.key.toString()] = entry;
        }
      }
      final pid = L['primaryIncomeAssetId']?.toString();
      primaryIncomeAssetId = (pid == null || pid.isEmpty) ? null : pid;
      if (L.containsKey('effectiveTaxRatePct')) {
        final tax = L['effectiveTaxRatePct'];
        effectiveTaxRatePct = tax == null ? null : (tax is num ? tax.toDouble() : double.tryParse(tax.toString()));
      }
      incomeLastUpdated = app_state.dateTimeFromJsonField(L['incomeLastUpdated']);
      expenseEstimatesLastUpdated = app_state.dateTimeFromJsonField(L['expenseEstimatesLastUpdated']);
      allocationTargetLastUpdated = app_state.dateTimeFromJsonField(L['allocationTargetLastUpdated']);
      assetsLastReviewed = app_state.dateTimeFromJsonField(L['assetsLastReviewed']);
      liabilitiesLastReviewed = app_state.dateTimeFromJsonField(L['liabilitiesLastReviewed']);
      final aif = L['allocInvestFraction'];
      if (aif is num) allocInvestFraction = aif.toDouble();
      final aim = L['allocInvestmentsMonthly'];
      if (aim is num) allocInvestmentsMonthly = aim.toDouble();
      final asm = L['allocSavingsMonthly'];
      if (asm is num) allocSavingsMonthly = asm.toDouble();
      _fxUsdPerUnitOverride.clear();
      final fx = L['fxUsdPerUnitOverride'];
      if (fx is Map) {
        for (final e in fx.entries) {
          final name = e.key.toString();
          CurrencyCode? c;
          for (final x in CurrencyCode.values) {
            if (x.name == name) {
              c = x;
              break;
            }
          }
          if (c == null || c == CurrencyCode.usd) continue;
          final v = e.value;
          final d = v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '');
          if (d != null && d > 0) _fxUsdPerUnitOverride[c] = d;
        }
      }
      app_state.decodeProjectionMap(projectionInvestReturnPctAnnual, L['projectionInvestReturnPctAnnual']);
      app_state.decodeProjectionMap(projectionSavingsReturnPctAnnual, L['projectionSavingsReturnPctAnnual']);
      app_state.decodeProjectionMap(projectionInflationPctAnnual, L['projectionInflationPctAnnual']);
    }

    final ctx = root['context'];
    if (ctx is Map) {
      final c = Map<String, dynamic>.from(ctx);
      final at = c['noteSavedAtUtc'];
      contextNoteSavedAtUtc.clear();
      if (at is Map) {
        for (final e in at.entries) {
          final ms = e.value;
          if (ms is int) {
            contextNoteSavedAtUtc[e.key.toString()] = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
          } else if (ms is num) {
            contextNoteSavedAtUtc[e.key.toString()] = DateTime.fromMillisecondsSinceEpoch(ms.round(), isUtc: true);
          }
        }
      }
    }

    final ia = root['internalAgents'];
    if (ia is Map) {
      final im = Map<String, dynamic>.from(ia);
      _internalAgentSystemPromptById.clear();
      internalAgentLastStructuredById.clear();
      internalAgentLastRunById.clear();
      final sp = im['systemPromptById'];
      if (sp is Map) {
        for (final e in sp.entries) {
          _internalAgentSystemPromptById[e.key.toString()] = e.value?.toString() ?? '';
        }
      }
      final st = im['lastStructuredById'];
      if (st is Map) {
        for (final e in st.entries) {
          final key = e.key.toString();
          final val = e.value;
          if (val is Map) {
            final m = Map<String, dynamic>.from(val);
            internalAgentLastStructuredById[key] = m.map((k, v) => MapEntry(k.toString(), v as Object?));
          }
        }
      }
      final lr = im['lastRunById'];
      if (lr is Map) {
        for (final e in lr.entries) {
          final ms = e.value;
          if (ms is int) {
            internalAgentLastRunById[e.key.toString()] = DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true);
          } else if (ms is num) {
            internalAgentLastRunById[e.key.toString()] = DateTime.fromMillisecondsSinceEpoch(ms.round(), isUtc: true);
          }
        }
      }
    }

    final chatsRoot = root['chats'];
    if (chatsRoot is Map) {
      final ch = Map<String, dynamic>.from(chatsRoot);
      chats.clear();
      _chatMessagesByThreadId.clear();
      final threadsRaw = ch['threads'];
      if (threadsRaw is List) {
        for (final e in threadsRaw) {
          final t = app_state.decodeChatThread(e);
          if (t != null) {
            chats.add(t);
            _chatMessagesByThreadId.putIfAbsent(t.id, () => []);
          }
        }
      }
      final msgRoot = ch['messages'];
      if (msgRoot is Map) {
        for (final e in msgRoot.entries) {
          final id = e.key.toString();
          final list = e.value;
          if (list is! List) continue;
          final out = <ChatMessage>[];
          for (final row in list) {
            final cm = ChatMessage.fromJson(row);
            if (cm != null) out.add(cm);
          }
          _chatMessagesByThreadId[id] = out;
        }
      }
    }

    final sched = root['scheduledTasks'];
    if (sched is List) {
      scheduledAgentTasks
        ..clear()
        ..addAll([
          for (final e in sched)
            if (ScheduledAgentTask.fromJson(e) != null) ScheduledAgentTask.fromJson(e)!,
        ]);
    }

    syncAllocationsFromFraction(notify: false);
  }

  ThemeData themedLight() {
    return AppTheme.light;
  }

  ThemeData themedDark() {
    return AppTheme.dark;
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

/// Reminder targets surfaced to the user (Command Center + Notifications).
/// Order matches the Settings reminder block.
enum ReminderDomain { expenses, cashflow, income, assets, liabilities }

String reminderDomainLabel(ReminderDomain d) => switch (d) {
      ReminderDomain.expenses => 'Expenses',
      ReminderDomain.cashflow => 'Cash flow',
      ReminderDomain.income => 'Income',
      ReminderDomain.assets => 'Assets',
      ReminderDomain.liabilities => 'Liabilities',
    };

enum LlmProvider { appleFoundation, openai, anthropic, gemini }

enum AgentDomain { expenses, cashflow, income, assets, liabilities, projection }

enum AgentAccess { read, write }

/// Chat / schedule behavior for user-defined [AppAgent]s.
enum AppAgentKind {
  /// Suggests next steps across the app; minimize unsolicited ledger writes.
  helper,
  /// Reads/writes ledger domains and Home summary when tools are enabled.
  analyst,
  /// Uses Gemini for market/news context (requires Gemini API key).
  researcher,
}

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
    this.kind = AppAgentKind.analyst,
    this.toolHomeSummary = false,
    this.toolWebResearch = false,
    this.toolSettingsAdmin = false,
    this.llmProviderOverride,
  });

  final String id;
  String name;
  String description;
  String systemPrompt;
  List<AgentPermission> permissions;
  String contextMarkdown;
  AppAgentKind kind;
  bool toolHomeSummary;
  bool toolWebResearch;
  bool toolSettingsAdmin;
  LlmProvider? llmProviderOverride;

  AppAgent clone() => AppAgent(
        id: id,
        name: name,
        description: description,
        systemPrompt: systemPrompt,
        permissions: [...permissions],
        contextMarkdown: contextMarkdown,
        kind: kind,
        toolHomeSummary: toolHomeSummary,
        toolWebResearch: toolWebResearch,
        toolSettingsAdmin: toolSettingsAdmin,
        llmProviderOverride: llmProviderOverride,
      );
}

/// Playground override for which LLM route a thread uses (default = agent + global settings).
enum AgentChatLlmOverride {
  useDefault,
  appleFoundation,
  openai,
  anthropic,
  gemini,
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
    this.llmOverride = AgentChatLlmOverride.useDefault,
    this.modelOverride,
    this.systemPromptSuffix,
    this.enabledToolIds,
  });

  final String id;
  String agentId;
  String title;
  final DateTime createdAt;
  DateTime updatedAt;
  int messageCount;
  int tokensUsed;
  String lastLine;
  AgentChatLlmOverride llmOverride;
  String? modelOverride;
  String? systemPromptSuffix;
  List<String>? enabledToolIds;

  AgentChatThread clone() => AgentChatThread(
        id: id,
        agentId: agentId,
        title: title,
        createdAt: createdAt,
        updatedAt: updatedAt,
        messageCount: messageCount,
        tokensUsed: tokensUsed,
        lastLine: lastLine,
        llmOverride: llmOverride,
        modelOverride: modelOverride,
        systemPromptSuffix: systemPromptSuffix,
        enabledToolIds: enabledToolIds == null ? null : List<String>.from(enabledToolIds!),
      );
}

List<AppAgent> _seedDefaultAgents() => [
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
      AppAgent(
        id: AppModel.morningBriefingAgentId,
        name: 'Morning briefing',
        description: 'Daily portfolio touchpoint and market themes for Home (uses Gemini).',
        kind: AppAgentKind.researcher,
        toolHomeSummary: true,
        toolWebResearch: true,
        systemPrompt: '''
You prepare a brief daily note for the Home screen.
Blend the user's portfolio/context with high-level public-market themes. Do not invent specific headlines, firms, or dates.
If recent news is uncertain, say so in one short clause. Calm, practical tone—no hype.
When asked to deliver the briefing, finish by updating the Home summary via set_home_summary in zoro_actions.
''',
        permissions: const [
          AgentPermission(domain: AgentDomain.expenses, access: AgentAccess.read),
          AgentPermission(domain: AgentDomain.cashflow, access: AgentAccess.read),
          AgentPermission(domain: AgentDomain.income, access: AgentAccess.read),
          AgentPermission(domain: AgentDomain.assets, access: AgentAccess.read),
          AgentPermission(domain: AgentDomain.liabilities, access: AgentAccess.read),
        ],
        contextMarkdown: '',
      ),
    ];
