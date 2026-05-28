import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import '../chat/chat_message.dart';
import '../constants/web_expenses_income.dart';
import '../finance/currency.dart';
import '../finance/goal_allocation.dart';
import '../finance/goal_asset_buckets.dart';
import '../finance/corpus_backtest.dart';
import '../finance/goals_calculator.dart';
import '../finance/historical_returns.dart';
import '../../dev/compile_time_api_keys.dart';
import '../finance/row_review_result.dart';
import '../llm/apple_foundation_channel.dart';
import '../llm/llm_key_store.dart';
import '../notifications/notification_service.dart';
import '../persistence/agent_json.dart';
import '../persistence/app_state_codec.dart' as app_state;
import '../persistence/app_state_store.dart';
import 'cashflow_income_line.dart';
import 'financial_goals.dart';
import 'internal_app_agent_definition.dart';
import 'ledger_rows.dart';
import 'monthly_cashflow_entry.dart';

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
    repairDuplicateAssetIds(notify: false);
    repairDuplicateLiabilityIds(notify: false);
    ensureRetirementGoal();
    syncAllocationsFromFraction(notify: false);
    _seedDummyCashflowData();
  }

  static const double spendVarianceBandPct = 0.10;
  static const Color spendOverColor = Color(0xFFEF4444); // red
  static const Color spendUnderColor = Color(0xFF10B981); // green
  static const Color spendInBandColor = AppTheme.slate600; // grey
  static const Color spendNoDataColor = AppTheme.slate500;

  /// Seeded “Morning briefing” agent id (chat / Home summary).
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
      await reconcileNotifications();
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
    if (homeSummaryText == value) return;
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
  void applyPersistedSnapshot(Map<String, dynamic> root) {
    _applyAppStateMap(root);
    if (!onboardingComplete &&
        (userTouchedExpenses ||
            userTouchedIncome ||
            userTouchedAssets ||
            userTouchedLiabilities ||
            monthlyCashflowByMonth.isNotEmpty ||
            incomeLines.isNotEmpty)) {
      onboardingComplete = true;
    }
  }

  /// Import path: replace in-memory state and flush to disk.
  Future<void> applyImportedSnapshot(Map<String, dynamic> root) async {
    applyPersistedSnapshot(root);
    await persistAppStateToDisk();
    notifyListeners();
  }

  /// Import path: replace ledger data only (assets, liabilities, cashflow, etc.).
  Future<void> applyImportedLedger(Map<String, dynamic> ledger) async {
    _applyAppStateMap({'formatVersion': app_state.kAppStateFormatVersion, 'ledger': ledger});
    await AppStateStore.saveLedger(ledger);
    notifyListeners();
  }

  /// Merge ledger rows by stable [id] (names may differ after a sanitized export).
  Future<void> mergeImportedLedger(Map<String, dynamic> ledger) async {
    final L = Map<String, dynamic>.from(ledger);
    final assetsRaw = L['assets'];
    if (assetsRaw is List) {
      for (final e in assetsRaw) {
        final row = app_state.decodeLedgerAssetRow(e);
        if (row == null) continue;
        final ix = assets.indexWhere((a) => a.id == row.id);
        if (ix >= 0) {
          replaceAsset(ix, row);
        } else {
          addAsset(row);
        }
      }
    }
    final liabRaw = L['liabilities'];
    if (liabRaw is List) {
      for (final e in liabRaw) {
        final row = app_state.decodeLedgerLiabilityRow(e);
        if (row == null) continue;
        final ix = liabilities.indexWhere((l) => l.id == row.id);
        if (ix >= 0) {
          replaceLiability(ix, row);
        } else {
          addLiability(row);
        }
      }
    }
    final incRaw = L['incomeLines'];
    if (incRaw is List) {
      for (final e in incRaw) {
        final line = app_state.decodeIncomeLine(e);
        if (line == null) continue;
        final ix = incomeLines.indexWhere((l) => l.id == line.id);
        if (ix >= 0) {
          incomeLines[ix] = line;
        } else {
          incomeLines.add(line);
        }
      }
      notifyIncomeChanged();
    }
    final eb = L['expenseBuckets'];
    if (eb is Map) {
      for (final e in eb.entries) {
        final key = e.key.toString();
        if (!expenseBucketKeys.contains(key)) continue;
        final v = e.value;
        final d = v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '');
        if (d != null) setExpenseBucket(key, d);
      }
    }
    final ectx = L['expenseBucketContextMarkdown'];
    if (ectx is Map) {
      for (final e in ectx.entries) {
        final key = e.key.toString();
        if (!expenseBucketKeys.contains(key)) continue;
        setExpenseBucketContextMarkdown(bucketKey: key, markdown: e.value?.toString() ?? '');
      }
    }
    final mc = L['monthlyCashflowByMonth'];
    if (mc is Map) {
      for (final e in mc.entries) {
        final entry = app_state.decodeMonthlyCashflowEntry(e.value);
        if (entry != null) upsertMonthlyCashflow(entry);
      }
    }
    if (L.containsKey('primaryIncomeAssetId')) {
      final pid = L['primaryIncomeAssetId']?.toString();
      primaryIncomeAssetId = (pid == null || pid.isEmpty) ? null : pid;
    }
    if (L.containsKey('effectiveTaxRatePct')) {
      final tax = L['effectiveTaxRatePct'];
      effectiveTaxRatePct = tax == null ? null : (tax is num ? tax.toDouble() : double.tryParse(tax.toString()));
    }
    final fx = L['fxUsdPerUnitOverride'];
    if (fx is Map) {
      for (final e in fx.entries) {
        for (final c in CurrencyCode.values) {
          if (c.name == e.key.toString()) {
            final v = e.value;
            final d = v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '');
            if (d != null) _fxUsdPerUnitOverride[c] = d;
            break;
          }
        }
      }
    }
    await AppStateStore.saveLedger(buildLedgerPersistedMap());
    notifyListeners();
  }

  /// Replace chats from a portable export `chats` block.
  Future<void> applyImportedChats(Map<String, dynamic> chats) async {
    _applyAppStateMap({
      'formatVersion': app_state.kAppStateFormatVersion,
      'chats': chats,
    });
    await persistAppStateToDisk();
    notifyListeners();
  }

  Future<void> replaceAllGoalsFromImport(List<FinancialGoal> incoming) async {
    financialGoals
      ..clear()
      ..addAll(incoming);
    goalsLastUpdated = DateTime.now();
    await persistAppStateToDisk();
    notifyListeners();
  }

  Future<void> applyImportedSettings(Map<String, dynamic> settings, {required bool replace}) async {
    final snap = buildPersistedSnapshot();
    if (replace) {
      snap['settings'] = settings;
    } else {
      final current = Map<String, dynamic>.from(snap['settings'] as Map);
      current.addAll(settings);
      snap['settings'] = current;
    }
    applyPersistedSnapshot(snap);
    await persistAppStateToDisk();
    notifyListeners();
  }

  Future<void> applyImportedAgent(AppAgent agent, {required bool replace}) async {
    if (replace) {
      final idx = agents.indexWhere((a) => a.id == agent.id);
      if (idx >= 0) {
        agents[idx] = agent;
      } else {
        agents.add(agent);
      }
    } else {
      upsertAgentFromTool(agent);
    }
    await persistAppStateToDisk();
    notifyListeners();
  }

  /// Full on-disk snapshot (API keys excluded) — in-memory monolithic shape.
  Map<String, dynamic> buildPersistedSnapshot() => _buildAppStateMap();

  /// Ledger section only (inline markdown). Used for ledger export.
  Map<String, dynamic> buildLedgerPersistedMap() =>
      Map<String, dynamic>.from(_buildAppStateMap()['ledger'] as Map);

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
    internalAgentLastRunById[agentId] = DateTime.now().toUtc();
    _scheduleAppStatePersist();
    notifyListeners();
    // Flush soon so last-run survives app kill and Settings → (i) always sees
    // fresh data (microtask-only persist can lag behind user navigation).
    unawaited(persistAppStateToDisk());
  }

  /// Ephemeral UI state for ledger/context row reviews (not persisted).
  final Map<String, RowReviewSlot> ledgerAssetReviewById = {};
  final Map<String, RowReviewSlot> ledgerLiabilityReviewById = {};
  final Map<String, RowReviewSlot> contextAssetReviewById = {};
  final Map<String, RowReviewSlot> contextLiabilityReviewById = {};

  void clearLedgerAssetReviews() {
    ledgerAssetReviewById.clear();
    notifyListeners();
  }

  void clearLedgerLiabilityReviews() {
    ledgerLiabilityReviewById.clear();
    notifyListeners();
  }

  void clearContextAssetReviews() {
    contextAssetReviewById.clear();
    notifyListeners();
  }

  void clearContextLiabilityReviews() {
    contextLiabilityReviewById.clear();
    notifyListeners();
  }

  void setLedgerAssetReview(
    String assetId, {
    bool? reviewing,
    RowReviewResult? result,
    bool? bannerDismissed,
  }) {
    final slot = ledgerAssetReviewById.putIfAbsent(assetId, RowReviewSlot.new);
    if (reviewing != null) slot.reviewing = reviewing;
    if (result != null) slot.result = result;
    if (bannerDismissed != null) slot.bannerDismissed = bannerDismissed;
    notifyListeners();
  }

  void setLedgerLiabilityReview(
    String liabilityId, {
    bool? reviewing,
    RowReviewResult? result,
    bool? bannerDismissed,
  }) {
    final slot = ledgerLiabilityReviewById.putIfAbsent(liabilityId, RowReviewSlot.new);
    if (reviewing != null) slot.reviewing = reviewing;
    if (result != null) slot.result = result;
    if (bannerDismissed != null) slot.bannerDismissed = bannerDismissed;
    notifyListeners();
  }

  void setContextAssetReview(
    String assetId, {
    bool? reviewing,
    RowReviewResult? result,
    bool? bannerDismissed,
  }) {
    final slot = contextAssetReviewById.putIfAbsent(assetId, RowReviewSlot.new);
    if (reviewing != null) slot.reviewing = reviewing;
    if (result != null) slot.result = result;
    if (bannerDismissed != null) slot.bannerDismissed = bannerDismissed;
    notifyListeners();
  }

  void setContextLiabilityReview(
    String liabilityId, {
    bool? reviewing,
    RowReviewResult? result,
    bool? bannerDismissed,
  }) {
    final slot = contextLiabilityReviewById.putIfAbsent(liabilityId, RowReviewSlot.new);
    if (reviewing != null) slot.reviewing = reviewing;
    if (result != null) slot.result = result;
    if (bannerDismissed != null) slot.bannerDismissed = bannerDismissed;
    notifyListeners();
  }

  void dismissLedgerAssetReviewBanner(String assetId) {
    setLedgerAssetReview(assetId, bannerDismissed: true);
  }

  void dismissLedgerLiabilityReviewBanner(String liabilityId) {
    setLedgerLiabilityReview(liabilityId, bannerDismissed: true);
  }

  void dismissContextAssetReviewBanner(String assetId) {
    setContextAssetReview(assetId, bannerDismissed: true);
  }

  void dismissContextLiabilityReviewBanner(String liabilityId) {
    setContextLiabilityReview(liabilityId, bannerDismissed: true);
  }

  /// Apply ledger review suggested comment when present.
  void applyLedgerAssetReviewComment(String assetId) {
    final r = ledgerAssetReviewById[assetId]?.result;
    final note = r?.suggestedComment.trim() ?? '';
    if (note.isEmpty) return;
    final a = assetById(assetId);
    if (a == null) return;
    a.comment = note;
    assetsLastReviewed = DateTime.now();
    userTouchedAssets = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void applyContextAssetReview(String assetId) {
    final md = contextAssetReviewById[assetId]?.result?.suggestedContextMarkdown.trim() ?? '';
    if (md.isEmpty) return;
    setAssetContextMarkdown(assetId: assetId, markdown: md);
  }

  void applyContextLiabilityReview(String liabilityId) {
    final md =
        contextLiabilityReviewById[liabilityId]?.result?.suggestedContextMarkdown.trim() ?? '';
    if (md.isEmpty) return;
    setLiabilityContextMarkdown(liabilityId: liabilityId, markdown: md);
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
  ReminderCadence remindersGoalsCadence = ReminderCadence.quarterly;

  /// After adding a target goal, offer to auto-allocate savings weights.
  bool promptAutoAllocateOnNewGoal = true;

  /// Notify at 50% and 75% of goal timeline elapsed (by time).
  bool goalsTimeProgressNotifications = true;

  /// Per-goal milestone flags: `goalId` → `{half, threeQuarter}`.
  final Map<String, Map<String, bool>> goalsTimeMilestonesFired = {};

  DateTime? goalsLastUpdated;

  /// When retirement corpus assumptions were last applied (Goals helper §1).
  DateTime? retirementCorpusLastUpdated;

  /// When retirement extras / savings weights were last applied (Goals helper §3).
  DateTime? retirementBucketsLastUpdated;

  /// Last time the user applied a Goals helper section (clears “plan changed” in Settings).
  DateTime? goalsReviewAcknowledgedAt;

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

  /// Calendar day (local) on which the daily rotation push last fired.
  /// `null` means "never fired" — first eligible day will fire.
  DateTime? remindersLastFiredOn;

  /// Domain that fired during the most recent daily push. Drives rotation —
  /// the next fire picks the *next* eligible domain after this one.
  ReminderDomain? remindersLastFiredDomain;

  /// Calendar day (local, midnight) of the next OS-scheduled rotation push,
  /// or `null` when nothing is scheduled. iOS local notifications guarantee
  /// delivery at the user's notify slot even without Dart running, so this
  /// is the primary delivery path; [maybePostDailyReminder] is a safety net
  /// for when scheduling fails (revoked permission, plugin error, etc.).
  DateTime? remindersScheduledFireOn;

  /// Domain whose content was baked into the OS-scheduled push referenced by
  /// [remindersScheduledFireOn]. Consulted on commit to advance rotation.
  ReminderDomain? remindersPendingDomain;

  /// "Has the user actually touched this domain at least once?" — set by domain
  /// mutation methods. Necessary because [_seedDummyCashflowData] pre-populates
  /// [incomeLastUpdated]/etc. with fixed historic dates on first run, so a plain
  /// `last != null` check would buzz fresh installs immediately.
  bool userTouchedExpenses = false;
  bool userTouchedIncome = false;
  bool userTouchedAssets = false;
  bool userTouchedLiabilities = false;

  /// First-run onboarding (currency, income, expense estimates). Persisted in settings.
  bool onboardingComplete = false;

  /// Optional demo data (seeded from onboarding).
  bool dummyDataActive = false;

  /// Snapshot of only the demo data we seeded. Used to remove only untouched entries.
  /// Shape:
  /// { "monthlyCashflowByMonth": { "YYYY-MM": { ...encoded MonthlyCashflowEntry... } } }
  Map<String, dynamic> dummySeedSnapshot = {};

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
      id: SeedLedgerIds.assetCondo,
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
      id: SeedLedgerIds.assetUsBrokerage,
      type: LedgerAssetType.investments,
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
      id: SeedLedgerIds.assetIndiaIndex,
      type: LedgerAssetType.investments,
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
      id: SeedLedgerIds.assetThaiCash,
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
      id: 'l-seed-condo',
      type: LedgerLiabilityType.mortgage,
      name: 'Condo mortgage',
      currencyCountry: 'Thailand',
      total: 4200000,
      interestRatePct: 6.25,
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
      id: 'l-seed-car',
      type: LedgerLiabilityType.carLoan,
      name: 'Car loan',
      currencyCountry: 'Thailand',
      total: 750000,
      interestRatePct: 3.1,
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
      id: SeedLedgerIds.incomeSalary,
      label: 'Salary',
      annualAmount: 4500000,
      currencyCountry: 'Thailand',
    ),
    CashflowIncomeLine(
      id: SeedLedgerIds.incomeRsu,
      label: 'RUS',
      annualAmount: 80000,
      currencyCountry: 'US',
    ),
    CashflowIncomeLine(
      id: SeedLedgerIds.incomeBonus,
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

  MonthlyCashflowEntry? get latestCashflowEntry {
    final keys = monthKeysWithCashflowData(limit: 1);
    if (keys.isEmpty) return null;
    return monthlyEntryFor(keys.first);
  }

  /// Primary cash row (Ledger → Cash); balance tracks latest month closing.
  LedgerAssetRow? get primaryCashAsset {
    final id = primaryIncomeAssetId;
    if (id == null) return null;
    final a = assetById(id);
    if (a == null || !primaryCashBalanceIsMirrored(a)) return null;
    return a;
  }

  /// Latest month closing − opening for the primary cash account.
  double? get primaryCashBalanceChangeMonthly {
    final e = latestCashflowEntry;
    if (e == null) return null;
    return e.closingBalance - e.openingBalance;
  }

  /// Latest month “Saved” outflow from cashflow (maps to Goals savings slice).
  double get latestCashSavedMonthly => latestCashflowEntry?.outflowToCashFd ?? 0;

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

  void _applyDisplayDeltaToLiabilityTotal(String liabilityId, double deltaDisplay) {
    final l = liabilityById(liabilityId);
    if (l == null || deltaDisplay.abs() < 0.005) return;
    final to = currencyCodeForPresetCountry(l.currencyCountry);
    final converted = convertCurrency(
      value: deltaDisplay,
      from: displayCurrency,
      to: to,
      usdPerUnitOverrides: fxUsdPerUnitResolved,
    );
    l.total = (l.total + converted).clamp(0, double.infinity);
  }

  void reverseSavingsCreditsForMonth(String monthKey) {
    final e = monthlyEntryFor(monthKey);
    if (e == null) return;
    for (final line in e.savingsLines) {
      final applied = line.amountApplied;
      if (applied < 0.005) {
        line.amountApplied = 0;
        continue;
      }
      if ((line.assetId ?? '').isNotEmpty) {
        _applyDisplayDeltaToAssetTotal(line.assetId!, -applied);
      } else if ((line.liabilityId ?? '').isNotEmpty) {
        _applyDisplayDeltaToLiabilityTotal(line.liabilityId!, applied);
      }
      line.amountApplied = 0;
    }
  }

  bool commitMonthSavingsLinking(
    String monthKey,
    List<MonthlySavingsLine> newLinesRaw,
  ) {
    reverseSavingsCreditsForMonth(monthKey);
    final e = monthlyEntryFor(monthKey);
    if (e == null) return false;
    final next = newLinesRaw.map((x) => x.clone()..amountApplied = 0).toList();
    e.savingsLines
      ..clear()
      ..addAll(next);
    final complete = monthlySavingsLinkingComplete(e);
    if (complete) {
      for (final line in e.savingsLines) {
        if (line.amount <= 0.005) continue;
        if ((line.assetId ?? '').isNotEmpty) {
          _applyDisplayDeltaToAssetTotal(line.assetId!, line.amount);
          line.amountApplied = line.amount;
        } else if ((line.liabilityId ?? '').isNotEmpty) {
          _applyDisplayDeltaToLiabilityTotal(line.liabilityId!, -line.amount);
          line.amountApplied = line.amount;
        }
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

  /// Optional markdown notes for the invest / savings split (Goals sheet).
  String allocationContextMarkdown = '';

  /// MONTHLY amounts in display-currency space; kept in sync with [allocInvestFraction].
  double allocInvestmentsMonthly = 0;
  double allocSavingsMonthly = 0;

  /// Property/other asset ids included in retirement corpus (unlisted → savings pool).
  final Set<String> retirementExtraAssetIds = {};

  /// Historical return datasets for corpus backtest (built-ins + imported).
  final List<HistoricalReturnSeries> historicalReturnSeries = [];

  /// Equity share of retirement portfolio in backtest (0–100).
  double corpusBacktestEquityPct = 60;

  String corpusBacktestEquitySeriesId = kDefaultUsSp500SeriesId;
  String corpusBacktestDebtSeriesId = kDefaultUsAggBondSeriesId;
  int? corpusBacktestStartYear;

  AssetsGoalsPolicy get assetsGoalsPolicy => AssetsGoalsPolicy(
        retirementExtraAssetIds: retirementExtraAssetIds,
      );

  void setRetirementExtraAssetIds(Set<String> ids) {
    retirementExtraAssetIds
      ..clear()
      ..addAll(ids);
    absorbRetirementHoldingsIntoSurplus(notify: false);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setRetirementAssetIncluded(String assetId, bool included) {
    final a = assetById(assetId);
    if (a == null) return;
    if (a.type != LedgerAssetType.property && a.type != LedgerAssetType.other) return;
    final changed = included
        ? retirementExtraAssetIds.add(assetId)
        : retirementExtraAssetIds.remove(assetId);
    if (!changed) return;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  bool isRetirementExtraAsset(String assetId) => retirementExtraAssetIds.contains(assetId);

  void setTargetSavingsWeight(String goalId, double weight) {
    final ix = financialGoals.indexWhere((g) => g.id == goalId);
    if (ix < 0) return;
    final g = financialGoals[ix];
    if (g.isRetirement) return;
    final w = weight.clamp(0.0, 1e6);
    if (g.savingsWeight == w) return;
    financialGoals[ix] = g.copyWith(savingsWeight: w);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// One retirement goal plus any number of target-amount goals.
  final List<FinancialGoal> financialGoals = [];

  FinancialGoal? get retirementGoal {
    for (final g in financialGoals) {
      if (g.isRetirement) return g;
    }
    return null;
  }

  List<FinancialGoal> get targetGoals =>
      financialGoals.where((g) => !g.isRetirement).toList(growable: false);

  /// Targets sorted by [FinancialGoal.sortOrder] (top of list = filled first from savings).
  List<FinancialGoal> get targetGoalsOrdered {
    final list = targetGoals.toList();
    list.sort((a, b) {
      final c = a.sortOrder.compareTo(b.sortOrder);
      if (c != 0) return c;
      final ia = financialGoals.indexWhere((g) => g.id == a.id);
      final ib = financialGoals.indexWhere((g) => g.id == b.id);
      return ia.compareTo(ib);
    });
    return list;
  }

  void moveTargetGoal(String id, {required bool up}) {
    final ordered = targetGoalsOrdered;
    final ix = ordered.indexWhere((g) => g.id == id);
    if (ix < 0) return;
    final swapIx = up ? ix - 1 : ix + 1;
    if (swapIx < 0 || swapIx >= ordered.length) return;
    final a = ordered[ix];
    final b = ordered[swapIx];
    final aIx = financialGoals.indexWhere((g) => g.id == a.id);
    final bIx = financialGoals.indexWhere((g) => g.id == b.id);
    if (aIx < 0 || bIx < 0) return;
    final aOrder = a.sortOrder;
    financialGoals[aIx] = a.copyWith(sortOrder: b.sortOrder);
    financialGoals[bIx] = b.copyWith(sortOrder: aOrder);
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  double liabilityDisplayValue(LedgerLiabilityRow l) =>
      moneyInDisplayCurrency(l.total, currencyCodeForPresetCountry(l.currencyCountry));

  List<LiabilityAllocationInput> get _liabilityAllocationInputs => [
        for (final l in liabilities)
          LiabilityAllocationInput(
            id: l.id,
            interestRatePct: l.interestRatePct,
            balance: liabilityDisplayValue(l),
          ),
      ];

  double get totalLiabilityPaydownMonthly {
    var sum = 0.0;
    for (final l in liabilities) {
      sum += l.paydownMonthly.clamp(0, double.infinity);
    }
    return sum;
  }

  /// Alias for UI copy that still says "debt pool".
  double get liabilityPaydownPoolMonthly => totalLiabilityPaydownMonthly;

  double get savingsCashBufferMonthly =>
      (allocSavingsMonthly - totalLiabilityPaydownMonthly).clamp(0, allocSavingsMonthly);

  double get savingsMonthlyForTargetsPool =>
      (allocSavingsMonthly - totalLiabilityPaydownMonthly).clamp(0, allocSavingsMonthly);

  Map<String, double> normalizedLiabilityPaydownShares() {
    if (liabilities.isEmpty) return {};
    var sum = 0.0;
    for (final l in liabilities) {
      sum += l.paydownWeight.clamp(0.0, 1e6);
    }
    if (sum <= 0) {
      final even = 1.0 / liabilities.length;
      return {for (final l in liabilities) l.id: even};
    }
    return {for (final l in liabilities) l.id: l.paydownWeight.clamp(0.0, 1e6) / sum};
  }

  double liabilityPaydownMonthly(LedgerLiabilityRow l) => l.paydownMonthly.clamp(0, double.infinity);

  /// Fixes persisted or seeded assets that share the same id (breaks context / cashflow links).
  void repairDuplicateAssetIds({bool notify = true}) {
    final seen = <String>{};
    var changed = false;
    for (var i = 0; i < assets.length; i++) {
      final old = assets[i];
      if (seen.add(old.id)) continue;
      changed = true;
      final newId = newLedgerRowId('a');
      assets[i] = LedgerAssetRow(
        id: newId,
        type: old.type,
        currencyCountry: old.currencyCountry,
        name: old.name,
        total: old.total,
        label: old.label,
        comment: old.comment,
        contextMarkdown: old.contextMarkdown,
        returnRatePct: old.returnRatePct,
      );
    }
    if (changed) {
      goalsLastUpdated = DateTime.now();
      _scheduleAppStatePersist();
      if (notify) notifyListeners();
    }
  }

  /// Fixes persisted or seeded rows that share the same id (breaks paydown / editors).
  void repairDuplicateLiabilityIds({bool notify = true}) {
    final seen = <String>{};
    var changed = false;
    for (var i = 0; i < liabilities.length; i++) {
      final old = liabilities[i];
      if (seen.add(old.id)) continue;
      changed = true;
      liabilities[i] = LedgerLiabilityRow(
        id: newLedgerRowId('l'),
        type: old.type,
        name: old.name,
        currencyCountry: old.currencyCountry,
        total: old.total,
        comment: old.comment,
        contextMarkdown: old.contextMarkdown,
        interestRatePct: old.interestRatePct,
        paydownWeight: old.paydownWeight,
        paydownMonthly: old.paydownMonthly,
      );
    }
    if (changed) {
      goalsLastUpdated = DateTime.now();
      _scheduleAppStatePersist();
      if (notify) notifyListeners();
    }
  }

  /// One-time: derive explicit $/mo from legacy weights + 50% savings cap.
  void migrateLiabilityPaydownMonthlyIfNeeded() {
    if (liabilities.isEmpty) return;
    if (liabilities.any((l) => l.paydownMonthly > 0.005)) return;
    if (allocSavingsMonthly <= 0) return;
    final pool = allocSavingsMonthly * 0.5;
    final shares = normalizedLiabilityPaydownShares();
    for (var i = 0; i < liabilities.length; i++) {
      final id = liabilities[i].id;
      liabilities[i].paydownMonthly = pool * (shares[id] ?? 0);
    }
  }

  /// Raises or lowers this loan's monthly paydown; shortfall is taken evenly from
  /// unallocated savings, other loans, then the invest slice.
  void setLiabilityPaydownMonthly(String liabilityId, double requested) {
    final ix = liabilities.indexWhere((l) => l.id == liabilityId);
    if (ix < 0) return;

    final avail = availableAfterExpensesMonthly;
    requested = requested.clamp(0, avail);

    final old = liabilities[ix].paydownMonthly;
    if ((requested - old).abs() < 0.005) return;

    if (requested < old) {
      liabilities[ix].paydownMonthly = requested;
      _touchAllocationAndGoals();
      return;
    }

    var othersPay = 0.0;
    for (final l in liabilities) {
      if (l.id == liabilityId) continue;
      othersPay += l.paydownMonthly.clamp(0, double.infinity);
    }
    var totalAfter = othersPay + requested;

    if (totalAfter <= allocSavingsMonthly + 1e-6) {
      liabilities[ix].paydownMonthly = requested;
      _touchAllocationAndGoals();
      return;
    }

    var over = totalAfter - allocSavingsMonthly;

    if (othersPay > 0 && over > 0) {
      final cut = over.clamp(0, othersPay);
      final factor = (othersPay - cut) / othersPay;
      for (var i = 0; i < liabilities.length; i++) {
        if (liabilities[i].id == liabilityId) continue;
        liabilities[i].paydownMonthly = (liabilities[i].paydownMonthly * factor).clamp(0, double.infinity);
      }
      over -= cut;
      othersPay *= factor;
      totalAfter = othersPay + requested;
    }

    if (over > 0) {
      final investCut = over.clamp(0, allocInvestmentsMonthly);
      allocInvestmentsMonthly -= investCut;
      allocSavingsMonthly += investCut;
      if (avail > 0) {
        allocInvestFraction = _quantizeAllocInvestFraction(allocInvestmentsMonthly / avail);
      }
      over -= investCut;
    }

    if (totalAfter > allocSavingsMonthly + 1e-6) {
      requested = (allocSavingsMonthly - othersPay).clamp(0, avail);
    }

    liabilities[ix].paydownMonthly = requested;
    _touchAllocationAndGoals();
  }

  void _touchAllocationAndGoals() {
    allocationTargetLastUpdated = DateTime.now();
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void autoAllocateLiabilityPaydownWeights() {
    if (liabilities.isEmpty) return;
    final shares = computeLiabilityPaydownShares(liabilities: _liabilityAllocationInputs);
    final budget = (allocSavingsMonthly * 0.5).clamp(0, allocSavingsMonthly);
    for (var i = 0; i < liabilities.length; i++) {
      final l = liabilities[i];
      final w = shares[l.id];
      if (w == null) continue;
      liabilities[i].paydownWeight = w * liabilities.length;
      liabilities[i].paydownMonthly = budget * w;
    }
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void autoAllocateSavingsPlan() {
    autoAllocateLiabilityPaydownWeights();
    autoAllocateGoalSavingsWeights();
  }

  int? liabilityPayoffMonths(LedgerLiabilityRow l) {
    final pay = liabilityPaydownMonthly(l);
    if (pay <= 0) return null;
    final balance = liabilityDisplayValue(l);
    if (balance <= 0) return null;
    return (balance / pay).ceil();
  }

  /// e.g. "Paid off ~Mar 2028 at current rate"
  String? liabilityPayoffLabel(LedgerLiabilityRow l) {
    final months = liabilityPayoffMonths(l);
    if (months == null) return null;
    final now = DateTime.now();
    final paid = DateTime(now.year, now.month + months, now.day);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${names[paid.month - 1]} ${paid.year}';
  }

  void reorderTargetGoals(int oldIndex, int newIndex) {
    final ordered = targetGoalsOrdered;
    if (oldIndex < 0 || oldIndex >= ordered.length) return;
    var dest = newIndex;
    if (dest > oldIndex) dest--;
    if (dest < 0 || dest >= ordered.length) return;
    final moved = ordered.removeAt(oldIndex);
    ordered.insert(dest, moved);
    for (var i = 0; i < ordered.length; i++) {
      final ix = financialGoals.indexWhere((g) => g.id == ordered[i].id);
      if (ix >= 0) financialGoals[ix] = ordered[i].copyWith(sortOrder: i);
    }
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  Map<String, double> _targetPoolAssignments() {
    final policy = assetsGoalsPolicy;
    return assignSavingsPoolToTargets(
      targetsOrdered: targetGoalsOrdered,
      savingsAssets: savingsPoolAssets(assets, policy),
      displayValue: assetDisplayValue,
      effectiveTarget: goalEffectiveTargetAmount,
      policy: policy,
    );
  }

  double get totalTargetRequiredMonthly {
    var sum = 0.0;
    for (final g in targetGoalsOrdered) {
      sum += goalRequiredMonthlySavingsFor(g);
    }
    return sum;
  }

  double get savingsOverflowToRetirementMonthly => savingsOverflowToRetirement(
        allocSavingsMonthly: savingsMonthlyForTargetsPool,
        totalTargetRequiredMonthly: totalTargetRequiredMonthly,
      );

  /// Monthly invest slice from the Goals split slider (retire-by / need math).
  double investMonthlyForRetirement() => allocInvestmentsMonthly;

  FinancialGoal? financialGoalById(String id) {
    for (final g in financialGoals) {
      if (g.id == id) return g;
    }
    return null;
  }

  LedgerAssetRow? assetById(String id) {
    for (final a in assets) {
      if (a.id == id) return a;
    }
    return null;
  }

  void ensureRetirementGoal() {
    if (retirementGoal != null) return;
    financialGoals.insert(
      0,
      FinancialGoal(
        id: newLedgerRowId('g'),
        kind: FinancialGoalKind.retirement,
        name: 'Retirement',
      ),
    );
  }

  void _pruneGoalAssetLinks(String removedAssetId) {
    var touched = false;
    for (var i = 0; i < financialGoals.length; i++) {
      final g = financialGoals[i];
      if (!g.linkedAssetIds.contains(removedAssetId)) continue;
      financialGoals[i] = g.copyWith(
        linkedAssetIds: g.linkedAssetIds.where((id) => id != removedAssetId).toList(),
      );
      touched = true;
    }
    if (touched) _scheduleAppStatePersist();
  }

  double retirementCurrentAmount(FinancialGoal goal) {
    final policy = assetsGoalsPolicy;
    return assets
        .where((a) => assetCountsTowardRetirement(a, policy))
        .fold<double>(
          0,
          (s, a) => s + retirementBalanceFromAsset(a, assetDisplayValue, policy),
        );
  }

  double goalCurrentAmount(FinancialGoal goal) {
    if (goal.isRetirement) return retirementCurrentAmount(goal);
    return _targetPoolAssignments()[goal.id] ?? 0;
  }

  double? goalProgressFraction(FinancialGoal goal) {
    if (goal.targetAmount <= 0) return null;
    return (goalCurrentAmount(goal) / goal.targetAmount).clamp(0.0, 1.0);
  }

  /// Normalized shares of target savings flow (retirement uses invest flow).
  Map<String, double> normalizedTargetSavingsShares() {
    final targets = targetGoals;
    if (targets.isEmpty) return {};
    final weights = <String, double>{};
    var sum = 0.0;
    for (final g in targets) {
      final w = g.savingsWeight.clamp(0.0, 1e6);
      weights[g.id] = w;
      sum += w;
    }
    if (sum <= 0) {
      final even = 1.0 / targets.length;
      return {for (final g in targets) g.id: even};
    }
    return {for (final e in weights.entries) e.key: e.value / sum};
  }

  Map<String, double> normalizedGoalSavingsShares() => normalizedTargetSavingsShares();

  double savingsMonthlyForGoal(FinancialGoal goal) {
    if (goal.isRetirement) return investMonthlyForRetirement();
    final pool = savingsMonthlyForTargetsPool;
    final share = normalizedTargetSavingsShares()[goal.id] ?? 0;
    return pool * share;
  }

  void _rebalanceGoalSavingsWeights() {
    if (financialGoals.isEmpty) return;
    for (var i = 0; i < financialGoals.length; i++) {
      final g = financialGoals[i];
      if (g.savingsWeight > 0) continue;
      financialGoals[i] = g.copyWith(savingsWeight: 1);
    }
  }

  void upsertFinancialGoal(FinancialGoal goal, {bool touchGoalsUpdated = true}) {
    final ix = financialGoals.indexWhere((g) => g.id == goal.id);
    final prev = ix >= 0 ? financialGoals[ix] : null;
    var next = goal;
    if (prev != null) {
      if (next.targetDate != null && prev.targetDate == null && next.timelineStart == null) {
        next = next.copyWith(timelineStart: DateTime.now());
      }
      if (next.isRetirement) {
        next = retirementGoalWithSurplusAfterCorpusChange(next, prev);
      }
    } else if (next.targetDate != null && next.timelineStart == null) {
      next = next.copyWith(timelineStart: DateTime.now());
    }
    if (goal.isRetirement) {
      for (var j = 0; j < financialGoals.length; j++) {
        if (financialGoals[j].isRetirement && financialGoals[j].id != goal.id) {
          financialGoals.removeAt(j);
          break;
        }
      }
    }
    if (ix >= 0) {
      financialGoals[ix] = next;
    } else {
      financialGoals.add(next);
    }
    _rebalanceGoalSavingsWeights();
    if (next.isRetirement && next.corpusAutoFromExpenses) {
      syncRetirementCorpusTarget(notify: false);
    }
    if (touchGoalsUpdated) goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void addTargetGoal({String name = 'New goal', bool runAutoAllocate = false}) {
    final nextOrder = targetGoals.isEmpty
        ? 0
        : targetGoals.map((g) => g.sortOrder).reduce(math.max) + 1;
    final g = FinancialGoal(
      id: newLedgerRowId('g'),
      kind: FinancialGoalKind.target,
      name: name,
      sortOrder: nextOrder,
    );
    financialGoals.add(g);
    _rebalanceGoalSavingsWeights();
    goalsLastUpdated = DateTime.now();
    if (runAutoAllocate) autoAllocateGoalSavingsWeights();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void removeFinancialGoal(String id) {
    final g = financialGoalById(id);
    if (g == null || g.isRetirement) return;
    financialGoals.removeWhere((x) => x.id == id);
    _rebalanceGoalSavingsWeights();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  double computedRetirementCorpus([FinancialGoal? retirement]) {
    final r = retirement ?? retirementGoal;
    if (r == null) return 0;
    return goalRetirementCorpusBase(
      goal: r,
      recurringExpensesMonthly: recurringExpensesMonthly,
    );
  }

  double goalRetirementCorpusBaseAmount(FinancialGoal goal) => goalRetirementCorpusBase(
        goal: goal,
        recurringExpensesMonthly: recurringExpensesMonthly,
      );

  double goalRetirementSurplus(FinancialGoal goal) => goal.corpusSurplus.clamp(0, double.infinity);

  /// Stored surplus only (not inflated on save).
  double goalRetirementSurplusTotal(FinancialGoal goal) => goalRetirementSurplus(goal);

  FinancialGoal retirementGoalWithSurplusAfterCorpusChange(
    FinancialGoal goal,
    FinancialGoal previous,
  ) {
    if (!goal.isRetirement) return goal;
    final oldBase = goalRetirementCorpusBaseAmount(previous);
    final newBase = goalRetirementCorpusBaseAmount(goal);
    final surplus = surplusAfterCorpusIncrease(
      surplus: goal.corpusSurplus,
      oldBase: oldBase,
      newBase: newBase,
    );
    return goal.copyWith(corpusSurplus: surplus);
  }

  /// When holdings exceed base corpus, raise stored surplus to that excess (asset changes only).
  void absorbRetirementHoldingsIntoSurplus({bool notify = true}) {
    final r = retirementGoal;
    if (r == null) return;
    final base = goalRetirementCorpusBaseAmount(r);
    final overflow = (goalCurrentAmount(r) - base).clamp(0.0, double.infinity);
    if (overflow <= r.corpusSurplus + 0.5) return;
    final ix = financialGoals.indexWhere((g) => g.id == r.id);
    if (ix < 0) return;
    financialGoals[ix] = r.copyWith(corpusSurplus: overflow);
    _scheduleAppStatePersist();
    if (notify) notifyListeners();
  }

  double goalEffectiveTargetAmount(FinancialGoal goal) {
    if (goal.isRetirement) return goalRetirementCorpusBaseAmount(goal);
    return goalEffectiveTarget(
      goal: goal,
      recurringExpensesMonthly: recurringExpensesMonthly,
    );
  }

  double goalRequiredMonthlySavingsFor(FinancialGoal goal, {DateTime? now}) {
    if (goal.isRetirement) {
      return retirementRequiredInvestMonthly(goal, now: now);
    }
    return goalRequiredMonthlySavings(
      goal: goal,
      currentAmount: goalCurrentAmount(goal),
      effectiveTarget: goalEffectiveTargetAmount(goal),
      now: now,
    );
  }

  /// Invest /mo needed to hit fixed corpus by [goal.targetDate] (settings invest return).
  double retirementRequiredInvestMonthly(FinancialGoal goal, {DateTime? now}) {
    final target = goalEffectiveTargetAmount(goal);
    final current = goalCurrentAmount(goal);
    final months = goalMonthsRemaining(goal.targetDate, now: now);
    if (months == null) return 0;
    final annualReturn = projectionInvestReturnPctAnnual[displayCurrency] ?? 0;
    return requiredMonthlyToReachTarget(
      current: current,
      target: target,
      months: months,
      annualReturnPct: annualReturn,
    );
  }

  double get totalRequiredMonthlyForTargets {
    var sum = 0.0;
    for (final g in targetGoalsOrdered) {
      sum += goalRequiredMonthlySavingsFor(g);
    }
    return sum;
  }

  double get totalRequiredMonthlyForRetirement {
    final r = retirementGoal;
    if (r == null) return 0;
    return goalRequiredMonthlySavingsFor(r);
  }

  double get totalRequiredMonthlyForGoals =>
      totalRequiredMonthlyForTargets + totalRequiredMonthlyForRetirement;

  GoalFeasibility goalFeasibility(FinancialGoal goal, {DateTime? now}) {
    final label = goal.isRetirement
        ? 'Retirement'
        : (goal.name.trim().isEmpty ? 'Target' : goal.name.trim());
    String fmt(double v) => formatCurrencyDisplay(v, currency: displayCurrency);
    if (goal.isRetirement) {
      return retirementInvestFeasibility(goal, now: now);
    }
    return assessGoalFeasibility(
      requiredMonthly: goalRequiredMonthlySavingsFor(goal, now: now),
      allocatedMonthly: savingsMonthlyForGoal(goal),
      monthsRemaining: goalMonthsRemaining(goal.targetDate, now: now),
      totalSavingsMonthly: savingsMonthlyForTargetsPool,
      goalLabel: label,
      formatAmount: fmt,
    );
  }

  /// Invest slice vs retirement need: caution if max slider fixes it; broken otherwise.
  GoalFeasibility retirementInvestFeasibility(FinancialGoal goal, {DateTime? now}) {
    String fmt(double v) => formatCurrencyDisplay(v, currency: displayCurrency);
    final required = goalRequiredMonthlySavingsFor(goal, now: now);
    final allocated = allocInvestmentsMonthly;
    final maxInvest = availableAfterExpensesMonthly;
    final monthsLeft = goalMonthsRemaining(goal.targetDate, now: now);

    if (monthsLeft != null && monthsLeft <= 0 && required > 0.5) {
      return const GoalFeasibility(
        level: GoalFeasibilityLevel.broken,
        title: 'Past due',
        detail: 'Past retirement date',
        needsDateAdjust: true,
      );
    }

    if (maxInvest <= 0 && required > 0.5) {
      return const GoalFeasibility(
        level: GoalFeasibilityLevel.broken,
        title: 'No monthly flow',
        detail: 'Add income or lower expenses in Ledger.',
      );
    }

    if (required <= 0.5) {
      return const GoalFeasibility(
        level: GoalFeasibilityLevel.ok,
        title: 'On track',
        detail: '',
      );
    }

    if (allocated >= required * 0.95) {
      return const GoalFeasibility(
        level: GoalFeasibilityLevel.ok,
        title: 'On track',
        detail: '',
      );
    }

    if (maxInvest >= required * 0.95) {
      return GoalFeasibility(
        level: GoalFeasibilityLevel.caution,
        title: 'Behind',
        detail: '${fmt(required)}/mo needed',
      );
    }

    return GoalFeasibility(
      level: GoalFeasibilityLevel.broken,
      title: 'Behind',
      detail: '${fmt(required)}/mo needed',
      needsDateAdjust: true,
    );
  }

  /// Monthly split strip: retirement invest flow only (not legacy target goals).
  GoalFeasibility planFeasibility({DateTime? now}) {
    final r = retirementGoal;
    if (r == null) {
      return const GoalFeasibility(
        level: GoalFeasibilityLevel.ok,
        title: 'On track',
        detail: '',
      );
    }
    return retirementInvestFeasibility(r, now: now);
  }

  /// Months until corpus at invest /mo and settings invest return; null if no invest flow.
  int? monthsToRetirementCorpus(FinancialGoal goal, {DateTime? now}) {
    final monthly = investMonthlyForRetirement();
    if (monthly <= 0.5) return null;
    final annualReturn = projectionInvestReturnPctAnnual[displayCurrency] ?? 0;
    return monthsToReachTargetWithContributions(
      current: goalCurrentAmount(goal),
      target: goalEffectiveTargetAmount(goal),
      monthlyPayment: monthly,
      annualReturnPct: annualReturn,
    );
  }

  /// Retire-by date implied by corpus gap and invest /mo (no picker).
  DateTime? retirementTargetDateFromPlan(FinancialGoal goal, {DateTime? now}) {
    final months = monthsToRetirementCorpus(goal, now: now);
    if (months == null) return null;
    final n = now ?? DateTime.now();
    return DateTime(n.year, n.month + months, n.day);
  }

  /// Earliest retire-by at invest /mo to reach base corpus; clears plan surplus.
  bool updateRetirementTargetDateFromPlan({DateTime? now}) {
    final r = retirementGoal;
    if (r == null) return false;
    final planGoal = r.copyWith(corpusSurplus: 0);
    final computed = retirementTargetDateFromPlan(planGoal, now: now);
    if (computed == null) return false;
    upsertFinancialGoal(
      planGoal.copyWith(
        targetDate: computed,
        timelineStart: r.timelineStart ?? DateTime.now(),
      ),
    );
    return true;
  }

  void syncRetirementCorpusTarget({bool notify = true}) {
    final r = retirementGoal;
    if (r == null || !r.corpusAutoFromExpenses) return;
    final corpus = computedRetirementCorpus(r);
    if ((r.targetAmount - corpus).abs() < 0.5) return;
    final ix = financialGoals.indexWhere((g) => g.id == r.id);
    if (ix < 0) return;
    financialGoals[ix] = r.copyWith(targetAmount: corpus);
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    if (notify) notifyListeners();
  }

  void applyComputedRetirementTarget() => syncRetirementCorpusTarget();

  void ensureDefaultHistoricalReturns() {
    final merged = mergeHistoricalReturnSeries(
      stored: historicalReturnSeries,
      incoming: const [],
    );
    if (historicalReturnSeries.length != merged.length ||
        !historicalReturnSeries.every((s) => merged.any((m) => m.id == s.id))) {
      historicalReturnSeries
        ..clear()
        ..addAll(merged);
    }
  }

  HistoricalReturnSeries? historicalSeriesById(String id) =>
      historicalReturnSeriesById(historicalReturnSeries, id);

  List<HistoricalReturnSeries> historicalSeriesForClass(HistoricalAssetClass assetClass) =>
      historicalReturnSeriesForClass(historicalReturnSeries, assetClass);

  void setCorpusBacktestEquityPct(double pct) {
    final next = pct.clamp(0, 100);
    if ((corpusBacktestEquityPct - next).abs() < 0.01) return;
    corpusBacktestEquityPct = next.toDouble();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setCorpusBacktestSeriesIds({String? equityId, String? debtId}) {
    var changed = false;
    if (equityId != null && equityId.isNotEmpty && corpusBacktestEquitySeriesId != equityId) {
      corpusBacktestEquitySeriesId = equityId;
      changed = true;
    }
    if (debtId != null && debtId.isNotEmpty && corpusBacktestDebtSeriesId != debtId) {
      corpusBacktestDebtSeriesId = debtId;
      changed = true;
    }
    if (!changed) return;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setCorpusBacktestStartYear(int? year) {
    if (year == corpusBacktestStartYear) return;
    corpusBacktestStartYear = year;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void mergeHistoricalReturnSeriesFromImport(Iterable<HistoricalReturnSeries> incoming) {
    final merged = mergeHistoricalReturnSeries(
      stored: historicalReturnSeries,
      incoming: incoming,
    );
    historicalReturnSeries
      ..clear()
      ..addAll(merged);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  Future<void> replaceHistoricalReturnSeriesFromImport(List<HistoricalReturnSeries> incoming) async {
    historicalReturnSeries
      ..clear()
      ..addAll(mergeHistoricalReturnSeries(stored: const [], incoming: incoming));
    _scheduleAppStatePersist();
    notifyListeners();
  }

  CorpusBacktestResult? corpusBacktestPreview({double? safeWithdrawalRatePct}) {
    ensureDefaultHistoricalReturns();
    final r = retirementGoal;
    if (r == null) return null;
    final equity = historicalSeriesById(corpusBacktestEquitySeriesId) ??
        historicalSeriesById(kDefaultUsSp500SeriesId);
    final debt = historicalSeriesById(corpusBacktestDebtSeriesId) ??
        historicalSeriesById(kDefaultUsAggBondSeriesId);
    if (equity == null || debt == null) return null;
    final swr = safeWithdrawalRatePct ?? r.safeWithdrawalRatePct;
    final initial = r.corpusAutoFromExpenses
        ? computeRetirementCorpusBase(
            recurringExpensesMonthly: recurringExpensesMonthly,
            safeWithdrawalRatePct: swr,
          )
        : goalRetirementCorpusBaseAmount(r);
    if (initial <= 0.5) return null;
    final expenseMonthly = r.corpusAutoFromExpenses ? recurringExpensesMonthly : initial * swr / 100 / 12;
    final inflation = projectionInflationPctAnnual[displayCurrency] ?? 0;
    return runCorpusBacktest(
      initialCorpus: initial,
      monthlyExpense: expenseMonthly,
      inflationPctAnnual: inflation,
      equitySeries: equity,
      debtSeries: debt,
      equityPct: corpusBacktestEquityPct,
      startYear: corpusBacktestStartYear,
    );
  }

  void setRetirementCorpusParams({
    double? safeWithdrawalRatePct,
    double? corpusBufferPct,
    bool? corpusAutoFromExpenses,
  }) {
    final r = retirementGoal;
    if (r == null) return;
    var next = r;
    if (safeWithdrawalRatePct != null) {
      next = next.copyWith(safeWithdrawalRatePct: clampWithdrawalRatePct(safeWithdrawalRatePct));
    }
    if (corpusBufferPct != null) {
      next = next.copyWith(corpusBufferPct: clampCorpusBufferPct(corpusBufferPct));
    }
    if (corpusAutoFromExpenses != null) {
      next = next.copyWith(corpusAutoFromExpenses: corpusAutoFromExpenses);
    }
    upsertFinancialGoal(next, touchGoalsUpdated: false);
    syncRetirementCorpusTarget(notify: false);
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Deficit-weighted savings weights for target goals (retirement uses invest flow).
  void autoAllocateGoalSavingsWeights({DateTime? now}) {
    final targets = targetGoals;
    if (targets.isEmpty) return;
    final inputs = buildTargetAllocationInputs(
      targets: targets,
      currentFor: goalCurrentAmount,
      effectiveTargetFor: goalEffectiveTargetAmount,
      now: now,
    );
    final weights = computeDeficitSavingsWeights(goals: inputs);
    for (var i = 0; i < financialGoals.length; i++) {
      final g = financialGoals[i];
      if (g.isRetirement) continue;
      final w = weights[g.id];
      if (w == null) continue;
      financialGoals[i] = g.copyWith(savingsWeight: w);
    }
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setPromptAutoAllocateOnNewGoal(bool v) {
    if (promptAutoAllocateOnNewGoal == v) return;
    promptAutoAllocateOnNewGoal = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setGoalsTimeProgressNotifications(bool v) {
    if (goalsTimeProgressNotifications == v) return;
    goalsTimeProgressNotifications = v;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void setReminderCadenceGoals(ReminderCadence v) {
    remindersGoalsCadence = v;
    _onReminderCadenceChanged();
  }

  void markGoalsUpdated() {
    goalsLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void _maybeFireGoalTimeMilestones({DateTime? now}) {
    if (!notificationsEnabled || !goalsTimeProgressNotifications) return;
    final n = now ?? DateTime.now();
    for (final g in financialGoals) {
      if (g.targetDate == null || g.timelineStart == null) continue;
      final frac = goalTimeProgressFraction(
        timelineStart: g.timelineStart,
        targetDate: g.targetDate,
        now: n,
      );
      if (frac == null) continue;
      final flags = goalsTimeMilestonesFired.putIfAbsent(g.id, () => {});
      final label = g.isRetirement ? 'Retirement' : g.name.trim();
      final title = label.isEmpty ? 'Goal' : label;
      if (frac >= 0.5 && flags['half'] != true) {
        flags['half'] = true;
        unawaited(
          NotificationService.instance.showGoalProgressMilestone(
            title: title,
            body: 'Halfway through your timeline for $title.',
          ),
        );
        _scheduleAppStatePersist();
      }
      if (frac >= 0.75 && flags['threeQuarter'] != true) {
        flags['threeQuarter'] = true;
        unawaited(
          NotificationService.instance.showGoalProgressMilestone(
            title: title,
            body: 'Three-quarters of the way to your target date for $title.',
          ),
        );
        _scheduleAppStatePersist();
      }
    }
  }

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
    const order = [
      LlmProvider.openai,
      LlmProvider.anthropic,
      LlmProvider.gemini,
      LlmProvider.appleFoundation,
    ];
    for (final p in order) {
      if (apiKeyFor(p) != null) {
        if (activeLlmProvider != p) {
          activeLlmProvider = p;
          _scheduleAppStatePersist();
          notifyListeners();
        }
        return;
      }
    }
  }

  /// Ensures [activeLlmProvider] can run assistants (cloud key or Apple on-device).
  Future<bool> prepareLlmForAssistant() async {
    await refreshAppleFoundationCapabilities();
    if (apiKeyFor(activeLlmProvider) == null) {
      _syncActiveProviderIfKeyRemoved();
    }
    if (apiKeyFor(activeLlmProvider) == null && appleFoundationRuntimeAvailable) {
      setAppleFoundationEnabled(true);
      activeLlmProvider = LlmProvider.appleFoundation;
      _scheduleAppStatePersist();
      notifyListeners();
    }
    return apiKeyFor(activeLlmProvider) != null;
  }

  String get llmAssistantUnavailableMessage {
    if (appleFoundationRuntimeAvailable && !appleFoundationEnabled) {
      return 'Turn on Apple on-device model in Settings → API keys.';
    }
    final reason = appleFoundationDisabledReason?.trim();
    if (!hasAnyApiKey && reason != null && reason.isNotEmpty) {
      return reason;
    }
    if (!hasAnyApiKey && !appleFoundationRuntimeAvailable) {
      return 'Add an API key in Settings, or use a device with Apple on-device models (iOS 26+).';
    }
    return 'No language model available. Check Settings → API keys.';
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

  void _onReminderCadenceChanged() {
    _scheduleAppStatePersist();
    if (notificationsEnabled) {
      unawaited(reconcileNotifications());
    }
    notifyListeners();
  }

  void setReminderCadenceExpenses(ReminderCadence v) {
    remindersExpensesCadence = v;
    _onReminderCadenceChanged();
  }

  void setReminderCadenceCashflow(ReminderCadence v) {
    remindersCashflowCadence = v;
    _onReminderCadenceChanged();
  }

  void setReminderCadenceIncome(ReminderCadence v) {
    remindersIncomeCadence = v;
    _onReminderCadenceChanged();
  }

  void setReminderCadenceAssets(ReminderCadence v) {
    remindersAssetsCadence = v;
    _onReminderCadenceChanged();
  }

  void setReminderCadenceLiabilities(ReminderCadence v) {
    remindersLiabilitiesCadence = v;
    _onReminderCadenceChanged();
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
    unawaited(reconcileNotifications());
    notifyListeners();
  }

  /// Clears today's rotation dispatch cursor so a new notify slot can fire.
  /// Called when the user changes reminder time — the once-per-day cap applies
  /// per configured slot, not across time edits on the same calendar day.
  void resetDailyReminderDispatchState() {
    remindersLastFiredOn = null;
    remindersLastFiredDomain = null;
    remindersScheduledFireOn = null;
    remindersPendingDomain = null;
  }

  void setReminderNotifyTime({required int hour, required int minute}) {
    final h = hour.clamp(0, 23);
    final m = minute.clamp(0, 59);
    if (reminderNotifyHour == h && reminderNotifyMinute == m) return;
    reminderNotifyHour = h;
    reminderNotifyMinute = m;
    resetDailyReminderDispatchState();
    _scheduleAppStatePersist();
    unawaited(reconcileNotifications());
    notifyListeners();
  }

  /// Returns the cadence configured for [d].
  ReminderCadence reminderCadenceFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => remindersExpensesCadence,
        ReminderDomain.cashflow => remindersCashflowCadence,
        ReminderDomain.income => remindersIncomeCadence,
        ReminderDomain.assets => remindersAssetsCadence,
        ReminderDomain.liabilities => remindersLiabilitiesCadence,
        ReminderDomain.goals => remindersGoalsCadence,
      };

  /// True once the user has moved past the seeded first-run state (any ledger
  /// edit or imported cash-flow month). Matches when Home "blue" overdue rows
  /// reflect real usage rather than demo dates alone.
  bool get remindersOnboardingComplete =>
      userTouchedExpenses ||
      userTouchedIncome ||
      userTouchedAssets ||
      userTouchedLiabilities ||
      monthlyCashflowByMonth.isNotEmpty;

  /// Domains that can appear on the daily OS alarm (cadence on, user has real
  /// data). Does not require an overdue review — unlike [isReminderNotifiable].
  bool isReminderSchedulable(ReminderDomain d) {
    if (!notificationsEnabled) return false;
    if (reminderCadenceFor(d) == ReminderCadence.off) return false;
    if (!remindersOnboardingComplete) return false;
    return userHasContentFor(d);
  }

  List<ReminderDomain> schedulableReminderDomains() => [
        for (final d in ReminderDomain.values)
          if (isReminderSchedulable(d)) d,
      ];

  /// Rotation pick for OS scheduling when nothing is overdue yet.
  ReminderDomain? nextSchedulableRotationDomain() {
    final eligible = schedulableReminderDomains();
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

  /// Per-domain content check (used in tests). Notifications gate on
  /// [remindersOnboardingComplete] plus the same overdue anchors as Home.
  bool userHasContentFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => userTouchedExpenses,
        ReminderDomain.cashflow => monthlyCashflowByMonth.isNotEmpty,
        ReminderDomain.income => userTouchedIncome,
        ReminderDomain.assets => userTouchedAssets,
        ReminderDomain.liabilities => userTouchedLiabilities,
        ReminderDomain.goals => financialGoals.isNotEmpty,
      };

  bool _reviewOverdueFor(ReminderDomain d, DateTime now) => switch (d) {
        ReminderDomain.expenses => expensesReviewOverdueAt(now),
        ReminderDomain.cashflow => cashflowReviewOverdueAt(now),
        ReminderDomain.income => incomeReviewOverdueAt(now),
        ReminderDomain.assets => assetsReviewOverdueAt(now),
        ReminderDomain.liabilities => liabilitiesReviewOverdueAt(now),
        ReminderDomain.goals => goalsReviewOverdueAt(now),
      };

  /// Eligibility predicate for the daily rotation. Domain-only checks: master
  /// switch on, cadence ≠ Off, user actually has content, and review is
  /// overdue. The "fire at most once a day" gate lives in
  /// [canFireDailyReminderNow] / [maybePostDailyReminder] so eligibility stays
  /// independent of dispatch timing.
  bool isReminderNotifiable(ReminderDomain d, {DateTime? now}) {
    if (!notificationsEnabled) return false;
    if (reminderCadenceFor(d) == ReminderCadence.off) return false;
    if (!remindersOnboardingComplete) return false;
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

  /// True when the Dart fallback may fire a rotation push *right now*:
  /// notifications on, today's notify slot has been reached, and no reminder
  /// fired yet today. Defers only while an OS schedule for *today* is still
  /// in the future — once that slot passes (or was cleared for catch-up),
  /// fallback is allowed in case iOS never delivered the scheduled push.
  bool canFireDailyReminderNow({DateTime? now}) {
    if (!notificationsEnabled) return false;
    final n = (now ?? DateTime.now()).toLocal();
    final last = remindersLastFiredOn;
    if (last != null && _isSameLocalDay(last, n)) return false;
    final slot = DateTime(n.year, n.month, n.day, reminderNotifyHour, reminderNotifyMinute);
    if (n.isBefore(slot)) return false;

    final pending = remindersScheduledFireOn;
    if (pending != null) {
      final pendingLocal = pending.toLocal();
      final pendingDay = DateTime(pendingLocal.year, pendingLocal.month, pendingLocal.day);
      final today = DateTime(n.year, n.month, n.day);
      if (pendingDay.isAfter(today)) return false;
      if (pendingDay == today && n.isBefore(slot)) return false;
    }
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
    remindersLastFiredOn = at ?? DateTime.now();
    remindersLastFiredDomain = domain;
    remindersPendingDomain = null;
    _scheduleAppStatePersist();
  }

  /// When the gate is open and there's an
  /// eligible domain, posts one rotation push and persists state synchronously
  /// (await — important: the background isolate dies right after this returns
  /// and a microtask-only persist can lose the "fired today" flag).
  ///
  /// Returns the domain that fired, or `null` when nothing was posted.
  Future<ReminderDomain?> maybePostDailyReminder({DateTime? now}) async {
    final n = now ?? DateTime.now();
    if (!canFireDailyReminderNow(now: n)) return null;
    final pending = remindersPendingDomain;
    final domain = (pending != null && isReminderNotifiable(pending, now: n))
        ? pending
        : nextRotationDomain(now: n);
    if (domain == null) return null;
    try {
      await NotificationService.instance.postReminderForDomain(domain);
    } catch (_) {
      return null;
    }
    recordDailyReminderFired(domain, at: n);
    await persistAppStateToDisk();
    try {
      await _scheduleNextReminderSlot();
    } catch (_) {}
    notifyListeners();
    return domain;
  }

  /// Pushes the current notification configuration to the OS:
  /// - cancels everything when [notificationsEnabled] is false,
  /// - commits any past-scheduled reminder push and (re)schedules the next
  ///   one-shot reminder for the upcoming notify slot with the next rotation
  ///   domain's content. iOS local notifications fire on time without Dart
  ///   running, so this is the primary delivery path; [maybePostDailyReminder]
  ///   is only a fallback for when scheduling fails.
  ///
  /// Best-effort; failures (plugin unsupported on web, missing permission) are
  /// swallowed so UI flows stay responsive.
  Future<void> syncNotifications() async {
    try {
      final svc = NotificationService.instance;
      if (!notificationsEnabled) {
        await svc.cancelAll();
        remindersScheduledFireOn = null;
        remindersPendingDomain = null;
        return;
      }
      await _scheduleNextReminderSlot();
    } catch (e, st) {
      // ignore: avoid_print
      print('[ZoroNotif] sync failed: $e\n$st');
    }
  }

  /// Re-syncs OS alarms from persisted prefs, then runs the Dart fallback when
  /// today's slot has passed. Call after bootstrap and on resume — never before
  /// disk state is loaded (doing so cancels all alarms with defaults).
  Future<void> reconcileNotifications() async {
    try {
      await NotificationService.instance.init();
    } catch (e, st) {
      // ignore: avoid_print
      print('[ZoroNotif] reconcile init failed: $e\n$st');
      return;
    }
    await syncNotifications();
    await maybePostDailyReminder();
    _maybeFireGoalTimeMilestones();
  }

  /// Cancels any current reminder schedule, commits past pending fires into
  /// the rotation cursor, and schedules a new OS one-shot for the upcoming
  /// notify slot with the next rotation domain's content. Idempotent: calling
  /// multiple times before the slot fires reschedules the same domain without
  /// advancing rotation. Persists to disk before returning.
  Future<void> _scheduleNextReminderSlot() async {
    final svc = NotificationService.instance;
    final now = DateTime.now();

    // A past OS slot with no "fired today" record means delivery may have failed.
    // Clear the schedule marker so Dart fallback can post, but keep
    // [remindersPendingDomain] so catch-up targets the right domain.
    final pending = remindersScheduledFireOn;
    if (pending != null) {
      final fireMoment = DateTime(
        pending.year,
        pending.month,
        pending.day,
        reminderNotifyHour,
        reminderNotifyMinute,
      );
      if (!now.isBefore(fireMoment)) {
        final alreadyFiredToday =
            remindersLastFiredOn != null && _isSameLocalDay(remindersLastFiredOn!, now);
        remindersScheduledFireOn = null;
        if (alreadyFiredToday) {
          remindersPendingDomain = null;
        }
        // else: keep [remindersPendingDomain] for [maybePostDailyReminder] catch-up
        // and fall through to schedule the next OS slot (do not return early).
      }
    }

    final todaySlot = DateTime(
      now.year,
      now.month,
      now.day,
      reminderNotifyHour,
      reminderNotifyMinute,
    );
    final nextSlot =
        now.isBefore(todaySlot) ? todaySlot : todaySlot.add(const Duration(days: 1));

    // Prefer overdue domains for copy + rotation; fall back to any schedulable
    // domain so the user's notify time always registers an OS alarm (like the
    // Settings test button). Immediate [maybePostDailyReminder] stays overdue-only.
    final overdueDomain = nextRotationDomain(now: nextSlot);
    final schedulableDomain = nextSchedulableRotationDomain();
    final domain = overdueDomain ?? schedulableDomain;

    await svc.cancelReminderSlot();

    if (domain == null) {
      // New users (onboarding false) and caught-up users still get an OS alarm.
      await svc.scheduleDailyCheckInAt(when: nextSlot);
      remindersScheduledFireOn = DateTime(nextSlot.year, nextSlot.month, nextSlot.day);
      remindersPendingDomain = null;
      await persistAppStateToDisk();
      return;
    }

    await svc.scheduleReminderForDomainAt(domain: domain, when: nextSlot);
    remindersScheduledFireOn = DateTime(nextSlot.year, nextSlot.month, nextSlot.day);
    remindersPendingDomain = domain;
    await persistAppStateToDisk();
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
      for (final sl in e.savingsLines) {
        sl.amount = convertCurrency(value: sl.amount, from: from, to: next, usdPerUnitOverrides: fx);
        sl.amountApplied = convertCurrency(
          value: sl.amountApplied,
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
    final toAdd = assets.any((a) => a.id == row.id)
        ? LedgerAssetRow(
            id: newLedgerRowId('a'),
            type: row.type,
            currencyCountry: row.currencyCountry,
            name: row.name,
            total: row.total,
            label: row.label,
            comment: row.comment,
            contextMarkdown: row.contextMarkdown,
            returnRatePct: row.returnRatePct,
          )
        : row;
    assets.add(toAdd);
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
    _pruneGoalAssetLinks(removedId);
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
    syncRetirementCorpusTarget(notify: false);
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void markExpenseEstimatesUpdated() {
    expenseEstimatesLastUpdated = DateTime.now();
    userTouchedExpenses = true;
    _scheduleAppStatePersist();
    notifyListeners();
  }

  /// Applies first-run onboarding: USD home currency, two FX picks, income lines, buckets.
  void applyOnboardingSetup({
    required CurrencyCode homeQuickPick1,
    required CurrencyCode homeQuickPick2,
    required Map<CurrencyCode, double> unitsPerUsdByCurrency,
    required double salaryAnnualUsd,
    double? bonusAnnualUsd,
    double? rsuAnnualUsd,
    double? effectiveTaxRatePct,
    required Map<String, double> expenseBucketsMonthlyUsd,
    String? expenseContextNote,
  }) {
    for (final e in unitsPerUsdByCurrency.entries) {
      if (e.value > 0) {
        setFxUsdPerUnitOverride(e.key, 1 / e.value);
      }
    }
    setHomeCurrencyQuickPick(1, homeQuickPick1);
    setHomeCurrencyQuickPick(2, homeQuickPick2);
    if (displayCurrency != CurrencyCode.usd) {
      setDisplayCurrency(CurrencyCode.usd);
    }
    incomeLines
      ..clear()
      ..add(
        CashflowIncomeLine(
          id: newLedgerRowId('i'),
          label: 'Salary',
          annualAmount: salaryAnnualUsd,
          currencyCountry: CurrencyCode.usd.code,
        ),
      );
    if (bonusAnnualUsd != null && bonusAnnualUsd > 0) {
      incomeLines.add(
        CashflowIncomeLine(
          id: newLedgerRowId('i'),
          label: 'Bonus',
          annualAmount: bonusAnnualUsd,
          currencyCountry: CurrencyCode.usd.code,
        ),
      );
    }
    if (rsuAnnualUsd != null && rsuAnnualUsd > 0) {
      incomeLines.add(
        CashflowIncomeLine(
          id: newLedgerRowId('i'),
          label: 'RSUs',
          annualAmount: rsuAnnualUsd,
          currencyCountry: CurrencyCode.usd.code,
        ),
      );
    }
    incomeLastUpdated = DateTime.now();
    userTouchedIncome = true;
    setEffectiveTaxRatePct(effectiveTaxRatePct);
    for (final e in expenseBucketsMonthlyUsd.entries) {
      setExpenseBucket(e.key, e.value);
    }
    if (expenseContextNote != null && expenseContextNote.trim().isNotEmpty) {
      setExpenseBucketContextMarkdown(bucketKey: 'other', markdown: expenseContextNote.trim());
    }
    markExpenseEstimatesUpdated();
    onboardingComplete = true;
    syncAllocationsFromFraction();
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

  LedgerLiabilityRow? liabilityById(String id) {
    for (final l in liabilities) {
      if (l.id == id) return l;
    }
    return null;
  }

  void setAssetContextMarkdown({required String assetId, required String markdown}) {
    final matches = <int>[
      for (var i = 0; i < assets.length; i++)
        if (assets[i].id == assetId) i,
    ];
    if (matches.isEmpty) return;
    if (matches.length > 1) {
      repairDuplicateAssetIds(notify: false);
      final idx = assets.indexWhere((a) => a.id == assetId);
      if (idx < 0) return;
      assets[idx].contextMarkdown = markdown;
    } else {
      assets[matches.first].contextMarkdown = markdown;
    }
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

  bool goalsReviewOverdueAt(DateTime now) =>
      _isOverdue(now: now, last: goalsLastUpdated, cadence: remindersGoalsCadence);

  /// Latest change across retirement helper sections and goal edits.
  DateTime? retirementPlanLastUpdatedAt() {
    DateTime? best = goalsLastUpdated;
    void consider(DateTime? d) {
      if (d == null) return;
      final b = best;
      if (b == null || d.isAfter(b)) best = d;
    }
    consider(retirementCorpusLastUpdated);
    consider(allocationTargetLastUpdated);
    consider(retirementBucketsLastUpdated);
    return best;
  }

  bool goalsPlanHasUnacknowledgedUpdates({DateTime? now}) {
    final planAt = retirementPlanLastUpdatedAt();
    if (planAt == null) return false;
    final ack = goalsReviewAcknowledgedAt;
    if (ack == null) return true;
    return planAt.isAfter(ack);
  }

  void markRetirementCorpusUpdated() {
    retirementCorpusLastUpdated = DateTime.now();
    goalsReviewAcknowledgedAt = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void markRetirementSplitUpdated() {
    goalsReviewAcknowledgedAt = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void markRetirementBucketsUpdated() {
    retirementBucketsLastUpdated = DateTime.now();
    goalsReviewAcknowledgedAt = DateTime.now();
    _scheduleAppStatePersist();
    notifyListeners();
  }

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

  bool get dummyDataPristine {
    if (!dummyDataActive) return false;
    final snapRaw = dummySeedSnapshot['monthlyCashflowByMonth'];
    if (snapRaw is! Map) return false;
    for (final e in snapRaw.entries) {
      final mk = e.key.toString();
      final cur = monthlyCashflowByMonth[mk];
      if (cur == null) return false;
      final curEnc = app_state.encodeMonthlyCashflowEntry(cur);
      if (curEnc.toString() != e.value.toString()) return false;
    }
    return true;
  }

  void seedDummyData() {
    if (dummyDataActive) return;
    final now = DateTime.now();
    final base = DateTime(now.year, now.month, 1);
    final months = <String>[];
    for (var i = 6; i >= 1; i--) {
      final d = DateTime(base.year, base.month - i, 1);
      months.add(monthKeyFor(d));
    }

    final seeded = <String, dynamic>{};
    var opening = 12000.0;
    for (final mk in months) {
      final earned = (netIncomeMonthly * 0.92).clamp(0, double.infinity).toDouble();
      final spending = (totalExpensesMonthly * 0.95).clamp(0, double.infinity).toDouble();
      final saved = (availableAfterExpensesMonthly * 0.35).clamp(0, double.infinity).toDouble();
      final invested = (availableAfterExpensesMonthly * 0.55).clamp(0, double.infinity).toDouble();
      final closing = (opening + earned - spending - saved - invested).clamp(0, double.infinity).toDouble();
      final e = MonthlyCashflowEntry(
        monthKey: mk,
        openingBalance: opening,
        closingBalance: closing,
        monthlyEarned: earned,
        monthlySpending: spending,
        outflowToCashFd: saved,
        outflowToInvested: invested,
        savingsLines: const [],
        investmentLines: const [],
      );
      monthlyCashflowByMonth[mk] = e;
      seeded[mk] = app_state.encodeMonthlyCashflowEntry(e);
      opening = closing;
    }

    dummyDataActive = true;
    dummySeedSnapshot = {'monthlyCashflowByMonth': seeded};
    _scheduleAppStatePersist();
    notifyListeners();
  }

  void clearDummyDataIfUntouched() {
    final snapRaw = dummySeedSnapshot['monthlyCashflowByMonth'];
    if (snapRaw is Map) {
      for (final e in snapRaw.entries) {
        final mk = e.key.toString();
        final cur = monthlyCashflowByMonth[mk];
        if (cur == null) continue;
        final curEnc = app_state.encodeMonthlyCashflowEntry(cur);
        if (curEnc.toString() == e.value.toString()) {
          monthlyCashflowByMonth.remove(mk);
        }
      }
    }
    dummyDataActive = false;
    dummySeedSnapshot = {};
    _scheduleAppStatePersist();
    notifyListeners();
  }

  Future<void> resetAllUserDataAndRestartOnboarding() async {
    assets.clear();
    liabilities.clear();
    incomeLines.clear();
    monthlyCashflowByMonth.clear();
    expenseBuckets = {
      for (final k in expenseBucketKeys) k: presetForCountry(expensePresetCountry).buckets[k]!.value,
    };
    expenseBucketContextMarkdown = {for (final k in expenseBucketKeys) k: ''};
    primaryIncomeAssetId = null;
    effectiveTaxRatePct = null;
    incomeLastUpdated = null;
    expenseEstimatesLastUpdated = null;
    allocationTargetLastUpdated = null;
    assetsLastReviewed = null;
    liabilitiesLastReviewed = null;
    allocInvestFraction = 0.5;
    allocInvestmentsMonthly = 0;
    allocSavingsMonthly = 0;
    allocationContextMarkdown = '';

    clearLedgerAssetReviews();
    clearLedgerLiabilityReviews();
    clearContextAssetReviews();
    clearContextLiabilityReviews();
    contextNoteSavedAtUtc.clear();
    financialGoals.clear();

    userTouchedExpenses = false;
    userTouchedIncome = false;
    userTouchedAssets = false;
    userTouchedLiabilities = false;
    onboardingComplete = false;
    dummyDataActive = false;
    dummySeedSnapshot = {};

    await persistAppStateToDisk();
    notifyListeners();
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

  /// Primary paycheck row (label “Salary”, or first line containing “salary”).
  CashflowIncomeLine? get primarySalaryIncomeLine {
    for (final line in incomeLines) {
      if (line.label.trim().toLowerCase() == 'salary') return line;
    }
    for (final line in incomeLines) {
      if (line.label.trim().toLowerCase().contains('salary')) return line;
    }
    return incomeLines.isEmpty ? null : incomeLines.first;
  }

  /// Post-tax monthly take-home for [primarySalaryIncomeLine] (display currency).
  double get salaryNetMonthlyDisplay {
    final line = primarySalaryIncomeLine;
    if (line == null || line.annualAmount <= 0.005) return 0;
    final grossMonthly = moneyInDisplayCurrency(
      line.annualAmount / 12.0,
      currencyCodeForIncomeLineCurrency(line.currencyCountry),
    );
    final rate = (effectiveTaxRatePct ?? 0).clamp(0, 100) / 100.0;
    return (grossMonthly * (1 - rate)).clamp(0, double.infinity);
  }

  /// Savings commitment as % of paycheck (can exceed 100).
  double get savingsPctOfSalary {
    final paycheck = salaryNetMonthlyDisplay;
    if (paycheck <= 0.005) return 0;
    return allocSavingsMonthly / paycheck * 100;
  }

  void setAllocFromSavingsPctOfSalary(double pct) {
    final paycheck = salaryNetMonthlyDisplay;
    if (paycheck <= 0.005) {
      setAllocationSavings(0, quantize: false);
      return;
    }
    setAllocationSavings(paycheck * (pct / 100), quantize: false);
  }

  void setAllocationContextMarkdown(String markdown) {
    allocationContextMarkdown = markdown.trim();
    _scheduleAppStatePersist();
    notifyListeners();
  }

  double predictedMonthlyForExpenseBucket(String k) => expenseBuckets[k] ?? 0;

  void setAllocInvestFraction(double f, {bool quantize = true}) {
    allocInvestFraction = quantize ? _quantizeAllocInvestFraction(f) : f.clamp(0.0, 1.0);
    allocationTargetLastUpdated = DateTime.now();
    syncAllocationsFromFraction();
    _scheduleAppStatePersist();
  }

  /// Sets invest/savings monthly amounts exactly; headline % follows these amounts.
  void setAllocationMonthlyExact({required double investMonthly, required double savingsMonthly}) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestFraction = 0;
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
      _scheduleAppStatePersist();
      notifyListeners();
      return;
    }
    var invest = investMonthly.clamp(0.0, avail);
    var savings = savingsMonthly.clamp(0.0, avail);
    final total = invest + savings;
    if (total > avail + 1e-6) {
      final scale = avail / total;
      invest *= scale;
      savings *= scale;
    }
    allocInvestmentsMonthly = invest;
    allocSavingsMonthly = savings;
    allocInvestFraction = invest / avail;
    allocationTargetLastUpdated = DateTime.now();
    _clampLiabilityPaydownToSavings();
    _scheduleAppStatePersist();
    notifyListeners();
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
    _clampLiabilityPaydownToSavings();
    if (notify) notifyListeners();
  }

  void _clampLiabilityPaydownToSavings() {
    final total = totalLiabilityPaydownMonthly;
    if (total <= allocSavingsMonthly + 1e-6 || total <= 0) return;
    final factor = allocSavingsMonthly / total;
    for (var i = 0; i < liabilities.length; i++) {
      liabilities[i].paydownMonthly = (liabilities[i].paydownMonthly * factor).clamp(0, double.infinity);
    }
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

  void setAllocationSavings(double v, {bool quantize = true}) {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0) {
      allocInvestFraction = 0;
      allocInvestmentsMonthly = 0;
      allocSavingsMonthly = 0;
      _scheduleAppStatePersist();
      notifyListeners();
      return;
    }
    if (quantize) {
      allocInvestFraction = _quantizeAllocInvestFraction(1.0 - (v / avail));
      allocationTargetLastUpdated = DateTime.now();
      syncAllocationsFromFraction();
    } else {
      setAllocationMonthlyExact(
        investMonthly: avail - v.clamp(0.0, avail),
        savingsMonthly: v.clamp(0.0, avail),
      );
      return;
    }
    allocationTargetLastUpdated = DateTime.now();
    _scheduleAppStatePersist();
  }

  /// Invest / saved headline % from actual monthly amounts (not quantized slider steps).
  int investPctOfAvailableRounded() {
    final avail = availableAfterExpensesMonthly;
    if (avail <= 0.005) return 0;
    return (allocInvestmentsMonthly / avail * 100).round().clamp(0, 100);
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
        'onboardingComplete': onboardingComplete,
        'dummyDataActive': dummyDataActive,
        'dummySeedSnapshot': dummySeedSnapshot,
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
        'remindersGoalsCadence': remindersGoalsCadence.name,
        'promptAutoAllocateOnNewGoal': promptAutoAllocateOnNewGoal,
        'goalsTimeProgressNotifications': goalsTimeProgressNotifications,
        'goalsTimeMilestonesFired': goalsTimeMilestonesFired,
        'goalsLastUpdated': goalsLastUpdated?.toUtc().toIso8601String(),
        'retirementCorpusLastUpdated': retirementCorpusLastUpdated?.toUtc().toIso8601String(),
        'retirementBucketsLastUpdated': retirementBucketsLastUpdated?.toUtc().toIso8601String(),
        'goalsReviewAcknowledgedAt': goalsReviewAcknowledgedAt?.toUtc().toIso8601String(),
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
        if (allocationContextMarkdown.trim().isNotEmpty)
          'allocationContextMarkdown': allocationContextMarkdown,
        'retirementExtraAssetIds': retirementExtraAssetIds.toList(),
        'corpusBacktest': app_state.encodeCorpusBacktestBlock(this),
        if (historicalReturnSeries.any((s) => !s.builtin))
          'historicalReturnSeries':
              historicalReturnSeries.where((s) => !s.builtin).map(encodeHistoricalReturnSeries).toList(),
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
      'goals': financialGoals.map(app_state.encodeFinancialGoal).toList(),
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
      if (s.containsKey('onboardingComplete')) {
        onboardingComplete = s['onboardingComplete'] == true;
      }
      if (s.containsKey('dummyDataActive')) {
        dummyDataActive = s['dummyDataActive'] == true;
      }
      final seed = s['dummySeedSnapshot'];
      if (seed is Map) {
        dummySeedSnapshot = Map<String, dynamic>.from(seed);
      }
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
      // Home's SegmentedButton is USD + two quick picks; every segment value must
      // be unique — corrupted prefs (e.g. duplicate slots or USD in a slot) assert in debug.
      var fixedHomeCurrencyQuickPicks = false;
      if (homeCurrencyQuickPick1 == CurrencyCode.usd) {
        homeCurrencyQuickPick1 = CurrencyCode.thb;
        fixedHomeCurrencyQuickPicks = true;
      }
      if (homeCurrencyQuickPick2 == CurrencyCode.usd) {
        homeCurrencyQuickPick2 = CurrencyCode.inr;
        fixedHomeCurrencyQuickPicks = true;
      }
      if (homeCurrencyQuickPick1 == homeCurrencyQuickPick2) {
        homeCurrencyQuickPick2 = kDisplayCurrencyPickerOptions.firstWhere(
          (c) => c != CurrencyCode.usd && c != homeCurrencyQuickPick1,
          orElse: () => CurrencyCode.inr,
        );
        fixedHomeCurrencyQuickPicks = true;
      }
      if (fixedHomeCurrencyQuickPicks) {
        _scheduleAppStatePersist();
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
      remindersGoalsCadence = app_state.reminderCadenceFromJson(s['remindersGoalsCadence']);
      if (s.containsKey('promptAutoAllocateOnNewGoal')) {
        promptAutoAllocateOnNewGoal = s['promptAutoAllocateOnNewGoal'] != false;
      }
      if (s.containsKey('goalsTimeProgressNotifications')) {
        goalsTimeProgressNotifications = s['goalsTimeProgressNotifications'] != false;
      }
      final gmf = s['goalsTimeMilestonesFired'];
      if (gmf is Map) {
        goalsTimeMilestonesFired.clear();
        for (final e in gmf.entries) {
          if (e.value is Map) {
            final inner = Map<String, dynamic>.from(e.value as Map);
            goalsTimeMilestonesFired[e.key.toString()] = {
              for (final f in inner.entries) f.key.toString(): f.value == true,
            };
          }
        }
      }
      goalsLastUpdated = app_state.dateTimeFromJsonField(s['goalsLastUpdated']);
      retirementCorpusLastUpdated = app_state.dateTimeFromJsonField(s['retirementCorpusLastUpdated']);
      retirementBucketsLastUpdated = app_state.dateTimeFromJsonField(s['retirementBucketsLastUpdated']);
      goalsReviewAcknowledgedAt = app_state.dateTimeFromJsonField(s['goalsReviewAcknowledgedAt']);
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
        repairDuplicateAssetIds(notify: false);
      }
      final liabRaw = L['liabilities'];
      if (liabRaw is List) {
        liabilities
          ..clear()
          ..addAll([
            for (final e in liabRaw)
              if (app_state.decodeLedgerLiabilityRow(e) != null) app_state.decodeLedgerLiabilityRow(e)!,
          ]);
        repairDuplicateLiabilityIds(notify: false);
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
      final acm = L['allocationContextMarkdown'];
      if (acm is String) allocationContextMarkdown = acm;
      retirementExtraAssetIds.clear();
      final rea = L['retirementExtraAssetIds'];
      if (rea is List) {
        for (final e in rea) {
          final id = e.toString().trim();
          if (id.isNotEmpty) retirementExtraAssetIds.add(id);
        }
      } else if (!L.containsKey('retirementExtraAssetIds') && assetsRaw is List) {
        for (final e in assetsRaw) {
          if (e is! Map) continue;
          final m = Map<String, dynamic>.from(e);
          if (m['includeInRetirement'] != true) continue;
          final id = m['id']?.toString();
          if (id == null || id.isEmpty) continue;
          final type = LedgerAssetTypeUi.fromApi(m['type']?.toString());
          if (type == LedgerAssetType.property || type == LedgerAssetType.other) {
            retirementExtraAssetIds.add(id);
          }
        }
        if (L['propertyInRetirement'] == true) {
          for (final a in assets) {
            if (a.type == LedgerAssetType.property) retirementExtraAssetIds.add(a.id);
          }
        }
        final oam = L['otherAssetsMode']?.toString();
        if (oam == 'retirement' || oam == 'split') {
          for (final a in assets) {
            if (a.type == LedgerAssetType.other) retirementExtraAssetIds.add(a.id);
          }
        }
      }
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
      historicalReturnSeries.clear();
      final hrs = L['historicalReturnSeries'];
      if (hrs is List) {
        for (final e in hrs) {
          final s = decodeHistoricalReturnSeries(e);
          if (s != null) historicalReturnSeries.add(s);
        }
      }
      app_state.decodeCorpusBacktestBlock(L['corpusBacktest'], this);
      ensureDefaultHistoricalReturns();
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

    final goalsRaw = root['goals'];
    financialGoals.clear();
    if (goalsRaw is List) {
      for (final e in goalsRaw) {
        final g = app_state.decodeFinancialGoal(e);
        if (g != null) financialGoals.add(g);
      }
    }
    ensureRetirementGoal();
    _rebalanceGoalSavingsWeights();
    syncRetirementCorpusTarget(notify: false);

    syncAllocationsFromFraction(notify: false);
    migrateLiabilityPaydownMonthlyIfNeeded();
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
enum ReminderDomain { expenses, cashflow, income, assets, liabilities, goals }

String reminderDomainLabel(ReminderDomain d) => switch (d) {
      ReminderDomain.expenses => 'Expenses',
      ReminderDomain.cashflow => 'Cash flow',
      ReminderDomain.income => 'Income',
      ReminderDomain.assets => 'Assets',
      ReminderDomain.liabilities => 'Liabilities',
      ReminderDomain.goals => 'Goals',
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
