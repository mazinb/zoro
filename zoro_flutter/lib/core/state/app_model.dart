import 'package:flutter/material.dart';

import '../../shared/theme/app_theme.dart';
import '../constants/web_expenses_income.dart';
import '../finance/currency.dart';
import 'cashflow_income_line.dart';
import 'ledger_rows.dart';
import 'monthly_cashflow_entry.dart';

class AppModel extends ChangeNotifier {
  AppModel() {
    syncAllocationsFromFraction(notify: false);
    _seedDummyCashflowData();
  }

  Color get accent => AppTheme.primaryBlue;

  Color get accentSoft => accent.withValues(alpha: 0.12);

  /// When true, monetary figures are masked (e.g. on Home and Ledger). Toggled from Home.
  bool privacyHideAmounts = false;

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

  /// Chats are always tied to an agent (UI-only).
  final List<AgentChatThread> chats = [
    AgentChatThread(
      id: 'chat-1',
      agentId: 'agent-3',
      title: 'Raise savings rate',
      createdAt: DateTime(2026, 4, 26, 9, 10),
      updatedAt: DateTime(2026, 4, 27, 10, 45),
      messageCount: 14,
      tokensUsed: 8200,
    ),
    AgentChatThread(
      id: 'chat-2',
      agentId: 'agent-1',
      title: 'Retire at 55?',
      createdAt: DateTime(2026, 4, 25, 20, 0),
      updatedAt: DateTime(2026, 4, 25, 20, 40),
      messageCount: 8,
      tokensUsed: 6100,
    ),
  ];

  /// Permissions / keys (UI-only). Used by Chat and (later) Agents.
  LlmProvider activeLlmProvider = LlmProvider.openai;
  String? openAiApiKey;
  String? anthropicApiKey;
  String? geminiApiKey;

  /// Optional tuning (kept simple for now).
  String openAiModel = 'gpt-4.1-mini';
  String anthropicModel = 'claude-3.5-sonnet';
  String geminiModel = 'gemini-1.5-pro';
  double temperature = 0.3;

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
  bool remindersUseQuarterEnds = true;

  /// Yearly reminders are due on this month/day (default: Mar 31).
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
      contextMarkdown: '',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.brokerage,
      currencyCountry: 'US',
      name: 'US Brokerage',
      total: 350000,
      label: '',
      comment: '',
      contextMarkdown: '',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.brokerage,
      currencyCountry: 'India',
      name: 'India Index Fund',
      total: 2000000,
      label: '',
      comment: '',
      contextMarkdown: '',
    ),
    LedgerAssetRow(
      id: newLedgerRowId('a'),
      type: LedgerAssetType.savings,
      currencyCountry: 'Thailand',
      name: 'Thai Cash',
      total: 1500000,
      label: '',
      comment: '',
      contextMarkdown: '',
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
      contextMarkdown: '',
    ),
    LedgerLiabilityRow(
      id: newLedgerRowId('l'),
      type: LedgerLiabilityType.carLoan,
      name: 'Car loan',
      currencyCountry: 'Thailand',
      total: 750000,
      comment: '',
      contextMarkdown: '',
    ),
  ];

  /// Multiple income sources; each line has its own currency (like ledger assets).
  final List<CashflowIncomeLine> incomeLines = [
    CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: 'Salary',
      annualAmount: 10000000,
      currencyCountry: 'Thailand',
    ),
    CashflowIncomeLine(
      id: newLedgerRowId('i'),
      label: 'RSUs',
      annualAmount: 80000,
      currencyCountry: 'US',
    ),
  ];

  double? effectiveTaxRatePct = 22;

  /// Expenses (mirrors web buckets). Amounts are interpreted in [displayCurrency] for display/FX.
  late Map<String, double> expenseBuckets = {
    for (final k in expenseBucketKeys) k: presetForCountry(expensePresetCountry).buckets[k]!.value,
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
    notifyListeners();
  }

  void updateChat(int index, AgentChatThread t) {
    if (index < 0 || index >= chats.length) return;
    chats[index] = t;
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
    notifyListeners();
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

  void setTemperature(double v) {
    final next = v.clamp(0.0, 1.0).toDouble();
    if (temperature == next) return;
    temperature = next;
    notifyListeners();
  }

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
    if (remindersUseQuarterEnds == v) return;
    remindersUseQuarterEnds = v;
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

  double actualSpendForMonth(String monthKey) {
    return monthlyEntryFor(monthKey)?.monthlySpending ?? 0;
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
    notifyListeners();
  }

  void setLiabilityContextMarkdown({required String liabilityId, required String markdown}) {
    final idx = liabilities.indexWhere((l) => l.id == liabilityId);
    if (idx < 0) return;
    liabilities[idx].contextMarkdown = markdown;
    liabilitiesLastReviewed = DateTime.now();
    notifyListeners();
  }

  void setMonthlyEntryContextMarkdown({required String monthKey, required String markdown}) {
    final e = monthlyCashflowByMonth[monthKey];
    if (e == null) return;
    e.contextMarkdown = markdown;
    notifyListeners();
  }

  DateTime _quarterEndFor(int year, int quarter) {
    final endMonth = switch (quarter) { 1 => 3, 2 => 6, 3 => 9, _ => 12 };
    // Last day of month.
    final lastDay = DateTime(year, endMonth + 1, 0).day;
    return DateTime(year, endMonth, lastDay);
  }

  DateTime _mostRecentQuarterEnd(DateTime now) {
    final q = ((now.month - 1) ~/ 3) + 1;
    final thisEnd = _quarterEndFor(now.year, q);
    if (!now.isBefore(thisEnd.add(const Duration(days: 1)))) return thisEnd;
    final prevQ = q == 1 ? 4 : (q - 1);
    final prevY = q == 1 ? (now.year - 1) : now.year;
    return _quarterEndFor(prevY, prevQ);
  }

  DateTime _mostRecentYearlyAnchor(DateTime now) {
    final maxDayThisYear = DateTime(now.year, remindersYearlyMonth + 1, 0).day;
    final safeDayThisYear = remindersYearlyDay.clamp(1, maxDayThisYear);
    final thisYear = DateTime(now.year, remindersYearlyMonth, safeDayThisYear);
    if (!now.isBefore(thisYear.add(const Duration(days: 1)))) return thisYear;
    final maxDayPrevYear = DateTime(now.year - 1, remindersYearlyMonth + 1, 0).day;
    final safeDayPrevYear = remindersYearlyDay.clamp(1, maxDayPrevYear);
    return DateTime(now.year - 1, remindersYearlyMonth, safeDayPrevYear);
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
        if (!remindersUseQuarterEnds) {
          // Fallback: 90-day rolling window.
          final cutoff = now.subtract(const Duration(days: 90));
          return last == null || last.isBefore(cutoff);
        }
        final anchor = _mostRecentQuarterEnd(now);
        return last == null || last.isBefore(anchor);
      case ReminderCadence.yearly:
        final anchor = _mostRecentYearlyAnchor(now);
        return last == null || last.isBefore(anchor);
      case ReminderCadence.off:
        return false;
    }
  }

  bool get expensesReviewOverdue => _isOverdue(now: DateTime.now(), last: expenseEstimatesLastUpdated, cadence: remindersExpensesCadence);
  bool get incomeReviewOverdue => _isOverdue(now: DateTime.now(), last: incomeLastUpdated, cadence: remindersIncomeCadence);
  bool get assetsReviewOverdue => _isOverdue(now: DateTime.now(), last: assetsLastReviewed, cadence: remindersAssetsCadence);
  bool get liabilitiesReviewOverdue => _isOverdue(now: DateTime.now(), last: liabilitiesLastReviewed, cadence: remindersLiabilitiesCadence);

  bool get cashflowReviewOverdue {
    final now = DateTime.now();
    if (remindersCashflowCadence == ReminderCadence.off) return false;
    // Consider "cashflow reviewed" for the month if there's an entry for the current month.
    final mk = monthKeyFor(now);
    final hasThisMonth = monthlyCashflowByMonth[mk] != null;
    final dueDay = remindersMonthlyDayOfMonth.clamp(1, 28);
    final dueThisMonth = DateTime(now.year, now.month, dueDay);
    if (now.isBefore(dueThisMonth)) return false;
    return !hasThisMonth;
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
      final spendJitter = 0.9 + (i % 5) * 0.03;
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
  });

  final String id;
  final String agentId;
  String title;
  final DateTime createdAt;
  DateTime updatedAt;
  int messageCount;
  int tokensUsed;

  AgentChatThread clone() => AgentChatThread(
        id: id,
        agentId: agentId,
        title: title,
        createdAt: createdAt,
        updatedAt: updatedAt,
        messageCount: messageCount,
        tokensUsed: tokensUsed,
      );
}
