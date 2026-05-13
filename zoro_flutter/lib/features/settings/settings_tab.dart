import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/finance/currency.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../core/state/scheduled_agent_task.dart';
import '../../dev/compile_time_api_keys.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'internal_agent_prompt_editor_page.dart';
import 'scheduled_task_editor_page.dart';

abstract class SettingsTabIndex {
  static const int reminders = 0;
  static const int agents = 1;
  static const int apiKeys = 2;
  // Back-compat for older callers.
  static const int permissions = apiKeys;
}

class SettingsTab extends StatefulWidget {
  const SettingsTab({super.key, required this.model, required this.tabIndexListenable});

  final AppModel model;
  final ValueListenable<int> tabIndexListenable;

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this, initialIndex: widget.tabIndexListenable.value.clamp(0, 2));
    widget.tabIndexListenable.addListener(_onTabIndexRequested);
  }

  @override
  void didUpdateWidget(covariant SettingsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tabIndexListenable != widget.tabIndexListenable) {
      oldWidget.tabIndexListenable.removeListener(_onTabIndexRequested);
      widget.tabIndexListenable.addListener(_onTabIndexRequested);
      _onTabIndexRequested();
    }
  }

  @override
  void dispose() {
    widget.tabIndexListenable.removeListener(_onTabIndexRequested);
    _tabs.dispose();
    super.dispose();
  }

  void _onTabIndexRequested() {
    final target = widget.tabIndexListenable.value.clamp(0, 2);
    if (_tabs.index == target) return;
    _tabs.animateTo(target);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            children: [
              Text(
                'Settings',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TabBar(
            controller: _tabs,
            labelStyle: const TextStyle(fontWeight: FontWeight.w900),
            tabs: const [
              Tab(text: 'General'),
              Tab(text: 'Agents'),
              Tab(text: 'API keys'),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _GeneralPane(model: widget.model),
              _AgentsPane(model: widget.model),
              _ApiKeysPane(model: widget.model),
            ],
          ),
        ),
      ],
    );
  }
}

class _GeneralPane extends StatefulWidget {
  const _GeneralPane({required this.model});

  final AppModel model;

  @override
  State<_GeneralPane> createState() => _GeneralPaneState();
}

class _GeneralPaneState extends State<_GeneralPane> {
  /// How many THB per 1 USD (user-facing). Stored model uses USD per 1 THB.
  late final TextEditingController _usdToThbCtrl;
  /// How many INR per 1 USD (user-facing).
  late final TextEditingController _usdToInrCtrl;
  Timer? _fxApplyDebounce;
  bool _fxSilentControllerSync = false;

  AppModel get model => widget.model;

  static int _daysInMonth(int year, int month) => DateTime(year, month + 1, 0).day;

  static String _monthName(int m) {
    const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m];
  }

  void _syncFxFieldsFromModel() {
    final u1 = model.usdPerUnitResolved(model.homeCurrencyQuickPick1);
    final u2 = model.usdPerUnitResolved(model.homeCurrencyQuickPick2);
    final next1 = u1 > 0 ? (1 / u1).toStringAsFixed(2) : '';
    final next2 = u2 > 0 ? (1 / u2).toStringAsFixed(2) : '';
    _fxSilentControllerSync = true;
    _usdToThbCtrl.text = next1;
    _usdToInrCtrl.text = next2;
    _fxSilentControllerSync = false;
  }

  @override
  void initState() {
    super.initState();
    _usdToThbCtrl = TextEditingController();
    _usdToInrCtrl = TextEditingController();
    _syncFxFieldsFromModel();
    _usdToThbCtrl.addListener(_scheduleFxApplyFromFields);
    _usdToInrCtrl.addListener(_scheduleFxApplyFromFields);
  }

  void _scheduleFxApplyFromFields() {
    if (_fxSilentControllerSync) return;
    _fxApplyDebounce?.cancel();
    _fxApplyDebounce = Timer(const Duration(milliseconds: 450), _applyFxFromFieldsToModel);
  }

  void _applyFxFromFieldsToModel() {
    if (!mounted) return;
    final thbPerUsd = double.tryParse(_usdToThbCtrl.text.trim().replaceAll(',', ''));
    final inrPerUsd = double.tryParse(_usdToInrCtrl.text.trim().replaceAll(',', ''));
    if (thbPerUsd != null && thbPerUsd > 0) {
      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, 1 / thbPerUsd);
    } else {
      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, null);
    }
    if (inrPerUsd != null && inrPerUsd > 0) {
      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick2, 1 / inrPerUsd);
    } else {
      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick2, null);
    }
    _syncFxFieldsFromModel();
    setState(() {});
  }

  @override
  void dispose() {
    _fxApplyDebounce?.cancel();
    _usdToThbCtrl.removeListener(_scheduleFxApplyFromFields);
    _usdToInrCtrl.removeListener(_scheduleFxApplyFromFields);
    _usdToThbCtrl.dispose();
    _usdToInrCtrl.dispose();
    super.dispose();
  }

  /// Solid Material 3 surface card. Matches Agents/API Keys panes (which use
  /// [Card]/`surfaceContainerHighest`) so General tab cards stay visible
  /// against the page background in light *and* dark mode.
  Widget _settingsCard({required Widget child, EdgeInsetsGeometry? padding}) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: padding != null ? Padding(padding: padding, child: child) : child,
    );
  }

  Widget _currencyAssumptionsCard() {
    final cs = Theme.of(context).colorScheme;
    return _settingsCard(
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: false,
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.only(bottom: 12),
          collapsedIconColor: cs.onSurfaceVariant,
          iconColor: cs.onSurfaceVariant,
          title: const Text(
            'Interest & inflation',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final c in {
                    CurrencyCode.usd,
                    model.homeCurrencyQuickPick1,
                    model.homeCurrencyQuickPick2,
                  })
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('${c.flag} ${c.code} · ${c.symbol}', style: const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                  child: Text('Invest', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
                              Text(
                                '${(model.projectionInvestReturnPctAnnual[c] ?? 0).toStringAsFixed(1)}%',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              ),
                            ],
                          ),
                          Slider(
                            value: (model.projectionInvestReturnPctAnnual[c] ?? 0).clamp(0.0, 20.0),
                            max: 20,
                            onChanged: (v) => setState(() => model.setProjectionRatesForCurrency(c, investPct: v)),
                          ),
                          Row(
                            children: [
                              Expanded(
                                  child: Text('Savings', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
                              Text(
                                '${(model.projectionSavingsReturnPctAnnual[c] ?? 0).toStringAsFixed(1)}%',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              ),
                            ],
                          ),
                          Slider(
                            value: (model.projectionSavingsReturnPctAnnual[c] ?? 0).clamp(0.0, 20.0),
                            max: 20,
                            onChanged: (v) => setState(() => model.setProjectionRatesForCurrency(c, savingsPct: v)),
                          ),
                          Row(
                            children: [
                              Expanded(
                                  child: Text('Inflation', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant))),
                              Text(
                                '${(model.projectionInflationPctAnnual[c] ?? 0).toStringAsFixed(1)}%',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                              ),
                            ],
                          ),
                          Slider(
                            value: (model.projectionInflationPctAnnual[c] ?? 0).clamp(0.0, 15.0),
                            max: 15,
                            onChanged: (v) => setState(() => model.setProjectionRatesForCurrency(c, inflationPct: v)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static const _fxPickerOptions = <CurrencyCode>[
    CurrencyCode.thb,
    CurrencyCode.inr,
    CurrencyCode.aed,
    CurrencyCode.sgd,
    CurrencyCode.aud,
    CurrencyCode.eur,
    CurrencyCode.jpy,
  ];

  Widget _fxRateRow(
    BuildContext context, {
    required TextEditingController controller,
    required CurrencyCode selected,
    required ValueChanged<CurrencyCode> onCurrencyChanged,
  }) {
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fieldFill = cs.surfaceContainerHighest.withValues(alpha: isDark ? 0.38 : 0.72);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Text('🇺🇸', style: TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Text('1 USD', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: cs.onSurface)),
          const SizedBox(width: 8),
          Text('=', style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w700)),
          const SizedBox(width: 8),
          SizedBox(
            width: 88,
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: fieldFill,
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: cs.primary.withValues(alpha: 0.5), width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          DropdownButtonHideUnderline(
            child: DropdownButton<CurrencyCode>(
              value: selected,
              isDense: true,
              items: [
                for (final c in _fxPickerOptions)
                  DropdownMenuItem(
                    value: c,
                    child: Text(
                      '${c.flag} ${c.code} · ${c.symbol}',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: cs.onSurfaceVariant),
                    ),
                  ),
              ],
              onChanged: (c) {
                if (c == null) return;
                onCurrencyChanged(c);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _fxCard(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return _settingsCard(
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: false,
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.only(bottom: 12),
          collapsedIconColor: cs.onSurfaceVariant,
          iconColor: cs.onSurfaceVariant,
          title: const Text(
            'Exchange rates',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _fxRateRow(
                    context,
                    controller: _usdToThbCtrl,
                    selected: model.homeCurrencyQuickPick1,
                    onCurrencyChanged: (c) {
                      if (c == model.homeCurrencyQuickPick1) return;
                      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, null);
                      model.setHomeCurrencyQuickPick(1, c);
                      _syncFxFieldsFromModel();
                      _applyFxFromFieldsToModel();
                    },
                  ),
                  Divider(height: 1, thickness: 0.5, color: cs.outlineVariant.withValues(alpha: 0.35)),
                  _fxRateRow(
                    context,
                    controller: _usdToInrCtrl,
                    selected: model.homeCurrencyQuickPick2,
                    onCurrencyChanged: (c) {
                      if (c == model.homeCurrencyQuickPick2) return;
                      model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick2, null);
                      model.setHomeCurrencyQuickPick(2, c);
                      _syncFxFieldsFromModel();
                      _applyFxFromFieldsToModel();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final yearlyDayMax = _daysInMonth(now.year, model.remindersYearlyMonth);
    final safeYearlyDay = model.remindersYearlyDay.clamp(1, yearlyDayMax);

    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _settingsCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Appearance',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<ThemeMode>(
                    segments: const [
                      ButtonSegment(
                        value: ThemeMode.system,
                        label: Text('System'),
                        icon: Icon(Icons.brightness_auto, size: 18),
                      ),
                      ButtonSegment(
                        value: ThemeMode.light,
                        label: Text('Light'),
                        icon: Icon(Icons.light_mode, size: 18),
                      ),
                      ButtonSegment(
                        value: ThemeMode.dark,
                        label: Text('Dark'),
                        icon: Icon(Icons.dark_mode, size: 18),
                      ),
                    ],
                    selected: {model.themeModePreference},
                    onSelectionChanged: (s) {
                      if (s.isEmpty) return;
                      model.setThemeMode(s.first);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _fxCard(context),
            const SizedBox(height: 12),
            _currencyAssumptionsCard(),
            const SizedBox(height: 12),
        const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        _NotificationsCard(model: model),
        const SizedBox(height: 12),
        const Text('Reminders', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        const SizedBox(height: 8),
        _settingsCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
                _CadenceRow(
                  label: 'Expenses',
                  value: model.remindersExpensesCadence,
                  onChanged: model.setReminderCadenceExpenses,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Cash flow',
                  value: model.remindersCashflowCadence,
                  onChanged: model.setReminderCadenceCashflow,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Income',
                  value: model.remindersIncomeCadence,
                  onChanged: model.setReminderCadenceIncome,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Assets',
                  value: model.remindersAssetsCadence,
                  onChanged: model.setReminderCadenceAssets,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Liabilities',
                  value: model.remindersLiabilitiesCadence,
                  onChanged: model.setReminderCadenceLiabilities,
                ),
              ],
            ),
        ),
        const SizedBox(height: 12),
        _settingsCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Monthly',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    DropdownButton<int>(
                      value: model.remindersMonthlyDayOfMonth.clamp(1, 28),
                      items: [for (var d = 1; d <= 28; d++) DropdownMenuItem(value: d, child: Text('Day $d'))],
                      onChanged: (v) {
                        if (v == null) return;
                        model.setRemindersMonthlyDayOfMonth(v);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Expanded(
                      child: Text('Quarterly', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                    DropdownButton<int>(
                      value: model.remindersQuarterMonthInQuarter.clamp(1, 3),
                      items: const [
                        DropdownMenuItem(value: 1, child: Text('First')),
                        DropdownMenuItem(value: 2, child: Text('Second')),
                        DropdownMenuItem(value: 3, child: Text('Third')),
                      ],
                      onChanged: (m) {
                        if (m == null) return;
                        model.setRemindersQuarterlySchedule(monthInQuarter: m, day: 1);
                      },
                    ),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: 1,
                      items: [for (var d = 1; d <= 28; d++) DropdownMenuItem(value: d, child: Text(d.toString()))],
                      onChanged: (d) {
                        if (d == null) return;
                        model.setRemindersQuarterlySchedule(monthInQuarter: model.remindersQuarterMonthInQuarter, day: d);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Yearly',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    DropdownButton<int>(
                      value: model.remindersYearlyMonth.clamp(1, 12),
                      items: [
                        for (var m = 1; m <= 12; m++)
                          DropdownMenuItem(
                            value: m,
                            child: Text(_monthName(m)),
                          ),
                      ],
                      onChanged: (m) {
                        if (m == null) return;
                        final maxDay = _daysInMonth(now.year, m);
                        final nextDay = safeYearlyDay.clamp(1, maxDay);
                        model.setRemindersYearlyDate(month: m, day: nextDay);
                      },
                    ),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: safeYearlyDay,
                      items: [
                        for (var d = 1; d <= yearlyDayMax; d++)
                          DropdownMenuItem(
                            value: d,
                            child: Text(d.toString()),
                          ),
                      ],
                      onChanged: (d) {
                        if (d == null) return;
                        model.setRemindersYearlyDate(month: model.remindersYearlyMonth, day: d);
                      },
                    ),
                  ],
                ),
              ],
            ),
        ),
        const SizedBox(height: 12),
        const SizedBox.shrink(),
          ],
        );
      },
    );
  }
}

class _AgentsPane extends StatefulWidget {
  const _AgentsPane({required this.model});

  final AppModel model;

  @override
  State<_AgentsPane> createState() => _AgentsPaneState();
}

class _AgentsPaneState extends State<_AgentsPane> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  _AgentSettingsSection _section = _AgentSettingsSection.context;
  late final TextEditingController _homeSummaryCtrl;

  @override
  void initState() {
    super.initState();
    _homeSummaryCtrl = TextEditingController(text: widget.model.homeSummaryText);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _homeSummaryCtrl.dispose();
    super.dispose();
  }

  bool _matchesQuery(AppAgent a, String q) {
    if (q.isEmpty) return true;
    final hay = '${a.name}\n${a.description}\n${a.systemPrompt}\n${a.contextMarkdown}'.toLowerCase();
    return hay.contains(q);
  }

  List<AppAgent> _filteredAgents({required bool Function(AppAgent a) where}) {
    final model = widget.model;
    final q = _query.trim().toLowerCase();
    return model.agents.where(where).where((a) => _matchesQuery(a, q)).toList();
  }

  Widget _iconSwitcher() {
    final accent = widget.model.accent;
    final cs = Theme.of(context).colorScheme;

    Widget iconTab({
      required _AgentSettingsSection s,
      required IconData icon,
    }) {
      final on = _section == s;
      return InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => _section = s),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: on ? accent.withValues(alpha: 0.12) : cs.surfaceContainerHighest,
            border: Border.all(color: on ? accent.withValues(alpha: 0.45) : cs.outlineVariant),
          ),
          child: Icon(icon, color: on ? accent : cs.onSurfaceVariant),
        ),
      );
    }

    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          iconTab(s: _AgentSettingsSection.home, icon: Icons.dashboard_outlined),
          const SizedBox(width: 16),
          iconTab(s: _AgentSettingsSection.ledger, icon: Icons.view_agenda_outlined),
          const SizedBox(width: 16),
          iconTab(s: _AgentSettingsSection.context, icon: Icons.library_books_outlined),
          const SizedBox(width: 16),
          iconTab(s: _AgentSettingsSection.chat, icon: Icons.chat_bubble_outline),
          const SizedBox(width: 16),
          iconTab(s: _AgentSettingsSection.schedule, icon: Icons.repeat),
        ],
      ),
    );
  }

  Widget _searchAndPlusRow(BuildContext context, {required VoidCallback onCreate, String searchHint = 'Search'}) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: searchHint,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          height: 48,
          width: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: cs.outlineVariant),
            color: cs.surfaceContainerHigh,
          ),
          child: IconButton(
            tooltip: 'Create',
            onPressed: onCreate,
            icon: const Icon(Icons.add),
          ),
        ),
      ],
    );
  }

  Widget _homePane() {
    final model = widget.model;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Home summary',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            TextButton(
              onPressed: model.homeSummaryText.trim().isEmpty
                  ? null
                  : () {
                      _homeSummaryCtrl.clear();
                      model.setHomeSummaryText('');
                      setState(() {});
                    },
              child: const Text('Clear'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Expanded(
          child: TextField(
            controller: _homeSummaryCtrl,
            expands: true,
            maxLines: null,
            minLines: null,
            keyboardType: TextInputType.multiline,
            textAlignVertical: TextAlignVertical.top,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Add a short note that shows on Home…',
              contentPadding: EdgeInsets.all(12),
            ),
            onChanged: (v) => model.setHomeSummaryText(v),
          ),
        ),
      ],
    );
  }

  Widget _contextPane() {
    final model = widget.model;
    final cs = Theme.of(context).colorScheme;
    const contextIds = {
      InternalAppAgentIds.assetContext,
      InternalAppAgentIds.liabilityContext,
      InternalAppAgentIds.expenseBucketContext,
      InternalAppAgentIds.monthCashflowContext,
      InternalAppAgentIds.contextOrchestrator,
    };
    final defs = kInternalAppAgentDefinitions.where((d) => contextIds.contains(d.id)).toList()
      ..sort((a, b) {
        if (a.id == InternalAppAgentIds.contextOrchestrator) return -1;
        if (b.id == InternalAppAgentIds.contextOrchestrator) return 1;
        return a.title.compareTo(b.title);
      });
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              for (final def in defs)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: model.accentSoft,
                        child: Icon(def.icon, color: model.accent, size: 22),
                      ),
                      title: Text(def.title, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text(def.listSubtitle, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
                      trailing: Icon(Icons.chevron_right, color: cs.outline),
                      onTap: () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (ctx) => InternalAgentPromptEditorPage(definition: def, model: model),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _ledgerPane() {
    final model = widget.model;
    final cs = Theme.of(context).colorScheme;
    bool isLedger(InternalAppAgentDefinition d) =>
        d.id == InternalAppAgentIds.ledgerOrchestrator || d.id.startsWith('ledger_');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              for (final def in kInternalAppAgentDefinitions.where(isLedger))
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: model.accentSoft,
                        child: Icon(def.icon, color: model.accent, size: 22),
                      ),
                      title: Text(def.title, style: const TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text(def.listSubtitle, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
                      trailing: Icon(Icons.chevron_right, color: cs.outline),
                      onTap: () {
                        Navigator.of(context).push<void>(
                          MaterialPageRoute(
                            builder: (ctx) => InternalAgentPromptEditorPage(definition: def, model: model),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _agentLibraryPane({
    required List<AppAgent> agents,
    required VoidCallback onCreate,
    required String emptyText,
  }) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _searchAndPlusRow(context, onCreate: onCreate),
        const SizedBox(height: 12),
        if (agents.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(emptyText, style: TextStyle(color: cs.onSurfaceVariant)),
          )
        else
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                for (final e in agents.asMap().entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _openAgentEditor(context, index: e.key),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(e.value.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 2),
                                    Text(e.value.description, style: TextStyle(color: cs.onSurfaceVariant)),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${_userAgentKindLabel(e.value.kind)} · permissions: ${e.value.permissions.isEmpty ? 'none' : e.value.permissions.length}',
                                      style: TextStyle(color: cs.outline, fontSize: 12, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right, color: cs.outline),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  String _userAgentKindLabel(AppAgentKind k) => switch (k) {
        AppAgentKind.helper => 'Helper',
        AppAgentKind.analyst => 'Analyst',
        AppAgentKind.researcher => 'Researcher',
      };

  Widget _schedulePane(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.model,
      builder: (context, _) {
        final tasks = widget.model.scheduledAgentTasks;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Recurring agents',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (ctx) => ScheduledTaskEditorPage(model: widget.model),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Local time. Open the app to run anything that was due while you were away.',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12, height: 1.35),
            ),
            const SizedBox(height: 12),
            if (tasks.isEmpty)
              Expanded(
                child: Center(
                  child: Text(
                    'No schedules yet. Tap Add, or enable “Morning briefing” in the editor.',
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    for (var i = 0; i < tasks.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {
                              Navigator.of(context).push<void>(
                                MaterialPageRoute<void>(
                                  builder: (ctx) => ScheduledTaskEditorPage(
                                    model: widget.model,
                                    taskIndex: i,
                                  ),
                                ),
                              );
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          tasks[i].name,
                                          style: const TextStyle(fontWeight: FontWeight.w900),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          scheduleTaskSummaryLine(tasks[i]),
                                          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Next: ${computeNextRunLocal(tasks[i], notBefore: DateTime.now()).toLocal().toString().split(".").first}',
                                          style: TextStyle(
                                            color: Theme.of(context).colorScheme.outline,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        if (tasks[i].lastError != null && tasks[i].lastError!.trim().isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 6),
                                            child: Text(
                                              'Last error: ${tasks[i].lastError}',
                                              style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  Switch(
                                    value: tasks[i].enabled,
                                    onChanged: (v) {
                                      final t = tasks[i].clone();
                                      t.enabled = v;
                                      widget.model.updateScheduledTaskAt(i, t);
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatAgents = _filteredAgents(where: (_) => true);

    Widget body = switch (_section) {
      _AgentSettingsSection.home => _homePane(),
      _AgentSettingsSection.ledger => _ledgerPane(),
      _AgentSettingsSection.context => _contextPane(),
      _AgentSettingsSection.chat => _agentLibraryPane(
          agents: chatAgents,
          onCreate: () => _openAgentEditor(context),
          emptyText: 'No agents yet.',
        ),
      _AgentSettingsSection.schedule => _schedulePane(context),
    };

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _iconSwitcher(),
          const SizedBox(height: 16),
          Expanded(child: body),
        ],
      ),
    );
  }

  Future<void> _openAgentEditor(BuildContext context, {int? index}) async {
    final model = widget.model;
    final isNew = index == null;
    final draft = isNew
        ? AppAgent(
            id: 'agent-${DateTime.now().microsecondsSinceEpoch}',
            name: '',
            description: '',
            systemPrompt: '',
            permissions: const [],
            contextMarkdown: '',
            kind: AppAgentKind.analyst,
            toolHomeSummary: false,
            toolWebResearch: false,
          )
        : model.agents[index].clone();

    final outcome = await showLiquidGlassModalBottomSheet<_AgentEditorOutcome>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _AgentEditorSheet(model: model, draft: draft, canDelete: !isNew),
    );
    if (!context.mounted || outcome == null) return;
    if (outcome.delete && index != null) {
      model.removeAgentAt(index);
      return;
    }
    final next = outcome.agent;
    if (next == null) return;
    if (isNew) {
      model.addAgent(next);
    } else {
      model.updateAgent(index, next);
    }
  }
}

enum _AgentSettingsSection { home, ledger, context, chat, schedule }

class _ApiKeysPane extends StatefulWidget {
  const _ApiKeysPane({required this.model});

  final AppModel model;

  @override
  State<_ApiKeysPane> createState() => _ApiKeysPaneState();
}

class _ApiKeysPaneState extends State<_ApiKeysPane> {
  late final TextEditingController _openAiCtrl;
  late final TextEditingController _anthropicCtrl;
  late final TextEditingController _geminiCtrl;
  bool _didAutofill = false;
  bool _revealOpenAi = false;
  bool _revealAnthropic = false;
  bool _revealGemini = false;

  late final TextEditingController _openAiModelCtrl;
  late final TextEditingController _anthropicModelCtrl;
  late final TextEditingController _geminiModelCtrl;

  static const _openAiModelOptions = <String>[
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4.1-nano',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-5.5',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ];

  static const _anthropicModelOptions = <String>[
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-opus-4-7',
    'claude-sonnet-4-5',
  ];

  static const _geminiModelOptions = <String>[
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ];

  @override
  void initState() {
    super.initState();
    final m = widget.model;

    final openAi = (m.openAiApiKey ?? '').trim();
    final anthropic = (m.anthropicApiKey ?? '').trim();
    final gemini = (m.geminiApiKey ?? '').trim();

    final shouldPrefill = kDebugMode || CompileTimeApiKeys.allowLocalKeyAutofill;
    final looksLikeOpenAiKey = openAi.startsWith('sk-');
    final nextOpenAi = ((!looksLikeOpenAiKey || openAi.isEmpty) && shouldPrefill) ? CompileTimeApiKeys.openAiApiKey : openAi;
    final nextGemini = (gemini.isEmpty && shouldPrefill) ? CompileTimeApiKeys.geminiApiKey : gemini;

    _openAiCtrl = TextEditingController(text: nextOpenAi);
    _anthropicCtrl = TextEditingController(text: anthropic);
    _geminiCtrl = TextEditingController(text: nextGemini);

    _openAiModelCtrl = TextEditingController(text: m.openAiModel);
    _anthropicModelCtrl = TextEditingController(text: m.anthropicModel);
    _geminiModelCtrl = TextEditingController(text: m.geminiModel);

    _maybeAutofill();

    // Normalize model selections to dropdown options in debug builds.
    if (kDebugMode) {
      if (!_openAiModelOptions.contains(_openAiModelCtrl.text.trim())) {
        final next = _openAiModelOptions.first;
        _openAiModelCtrl.text = next;
        m.setModelFor(LlmProvider.openai, next);
      }
      if (!_anthropicModelOptions.contains(_anthropicModelCtrl.text.trim())) {
        final next = _anthropicModelOptions.first;
        _anthropicModelCtrl.text = next;
        m.setModelFor(LlmProvider.anthropic, next);
      }
      if (!_geminiModelOptions.contains(_geminiModelCtrl.text.trim())) {
        final next = _geminiModelOptions.first;
        _geminiModelCtrl.text = next;
        m.setModelFor(LlmProvider.gemini, next);
      }
    }
  }

  void _maybeAutofill() {
    if (_didAutofill) return;
    if (!(kDebugMode || CompileTimeApiKeys.allowLocalKeyAutofill)) return;

    final m = widget.model;
    final openAiExisting = (m.openAiApiKey ?? '').trim();
    final geminiExisting = (m.geminiApiKey ?? '').trim();

    final openAiKey = CompileTimeApiKeys.openAiApiKey.trim();
    final geminiKey = CompileTimeApiKeys.geminiApiKey.trim();

    var changed = false;
    final openAiLooksValid = openAiExisting.startsWith('sk-');
    if ((!openAiLooksValid || _openAiCtrl.text.trim().isEmpty) && openAiKey.isNotEmpty) {
      _openAiCtrl.text = openAiKey;
      _openAiCtrl.selection = TextSelection.collapsed(offset: _openAiCtrl.text.length);
      changed = true;
    }
    if (_geminiCtrl.text.trim().isEmpty && geminiKey.isNotEmpty) {
      _geminiCtrl.text = geminiKey;
      _geminiCtrl.selection = TextSelection.collapsed(offset: _geminiCtrl.text.length);
      changed = true;
    }

    // Persist the prefill so other screens can use it immediately.
    if ((!openAiLooksValid || openAiExisting.isEmpty) && _openAiCtrl.text.trim().isNotEmpty) {
      m.setApiKey(provider: LlmProvider.openai, key: _openAiCtrl.text.trim());
    }
    if (geminiExisting.isEmpty && _geminiCtrl.text.trim().isNotEmpty) {
      m.setApiKey(provider: LlmProvider.gemini, key: _geminiCtrl.text.trim());
    }

    _didAutofill = true;
    if (changed && mounted) setState(() {});
  }

  @override
  void reassemble() {
    super.reassemble();
    // Hot reload keeps State; reapply debug autofill.
    _didAutofill = false;
    _maybeAutofill();
  }

  @override
  void dispose() {
    _openAiCtrl.dispose();
    _anthropicCtrl.dispose();
    _geminiCtrl.dispose();
    _openAiModelCtrl.dispose();
    _anthropicModelCtrl.dispose();
    _geminiModelCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _maybeAutofill();
    });

    Future<void> openExternal(String url) async {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Opening…'), behavior: SnackBarBehavior.floating, duration: Duration(milliseconds: 900)),
      );
      try {
        final uri = Uri.parse(url);
        final ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
        if (!ok && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not open $url'), behavior: SnackBarBehavior.floating),
          );
        }
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Open failed: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    }

    Future<void> pasteKey({
      required TextEditingController controller,
      required LlmProvider provider,
    }) async {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim();
      if (text == null || text.isEmpty) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Clipboard is empty'), behavior: SnackBarBehavior.floating),
        );
        return;
      }
      controller.text = text;
      controller.selection = TextSelection.collapsed(offset: controller.text.length);
      m.setApiKey(provider: provider, key: text);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pasted'), behavior: SnackBarBehavior.floating, duration: Duration(milliseconds: 800)),
      );
    }

    return ListenableBuilder(
      listenable: m,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Apple on-device'),
              value: m.appleFoundationEnabled && m.appleFoundationRuntimeAvailable,
              onChanged: m.appleFoundationRuntimeAvailable ? m.setAppleFoundationEnabled : null,
              subtitle: (!m.appleFoundationRuntimeAvailable &&
                      (m.appleFoundationDisabledReason ?? '').trim().isNotEmpty)
                  ? Text(
                      m.appleFoundationDisabledReason!.trim(),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                      ),
                    )
                  : null,
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                TextField(
                  controller: _openAiCtrl,
                  obscureText: !_revealOpenAi,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.openai, key: v),
                  decoration: InputDecoration(
                    labelText: 'OpenAI API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealOpenAi ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealOpenAi = !_revealOpenAi),
                          icon: Icon(_revealOpenAi ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _openAiCtrl, provider: LlmProvider.openai),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://platform.openai.com/api-keys'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'OpenAI model',
                  controller: _openAiModelCtrl,
                  options: _openAiModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.openai, v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _anthropicCtrl,
                  obscureText: !_revealAnthropic,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.anthropic, key: v),
                  decoration: InputDecoration(
                    labelText: 'Anthropic API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealAnthropic ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealAnthropic = !_revealAnthropic),
                          icon: Icon(_revealAnthropic ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _anthropicCtrl, provider: LlmProvider.anthropic),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://console.anthropic.com/settings/keys'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'Anthropic model',
                  controller: _anthropicModelCtrl,
                  options: _anthropicModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.anthropic, v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _geminiCtrl,
                  obscureText: !_revealGemini,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.gemini, key: v),
                  decoration: InputDecoration(
                    labelText: 'Gemini API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealGemini ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealGemini = !_revealGemini),
                          icon: Icon(_revealGemini ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _geminiCtrl, provider: LlmProvider.gemini),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://aistudio.google.com/app/apikey'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'Gemini model',
                  controller: _geminiModelCtrl,
                  options: _geminiModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.gemini, v),
                ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ModelPicker extends StatelessWidget {
  const _ModelPicker({
    required this.label,
    required this.controller,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final current = controller.text.trim();
    final normalizedOptions = options.toSet().toList();
    final selected = normalizedOptions.contains(current) ? current : normalizedOptions.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey('$label:$selected'),
          initialValue: selected,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
          items: [
            for (final m in normalizedOptions) DropdownMenuItem(value: m, child: Text(m)),
          ],
          onChanged: (v) {
            if (v == null) return;
            controller.text = v;
            controller.selection = TextSelection.collapsed(offset: controller.text.length);
            onChanged(v);
          },
        ),
      ],
    );
  }
}

class _CadenceRow extends StatelessWidget {
  const _CadenceRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final ReminderCadence value;
  final ValueChanged<ReminderCadence> onChanged;

  static String _cadenceLabel(ReminderCadence c) => switch (c) {
        ReminderCadence.off => 'Off',
        ReminderCadence.monthly => 'Monthly',
        ReminderCadence.quarterly => 'Quarterly',
        ReminderCadence.yearly => 'Yearly',
      };

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        DropdownButton<ReminderCadence>(
          value: value,
          items: [
            for (final c in ReminderCadence.values)
              DropdownMenuItem(
                value: c,
                child: Text(_cadenceLabel(c)),
              ),
          ],
          onChanged: (v) {
            if (v == null) return;
            onChanged(v);
          },
        ),
      ],
    );
  }
}

class _AgentEditorOutcome {
  const _AgentEditorOutcome({this.agent, this.delete = false});

  final AppAgent? agent;
  final bool delete;
}

class _AgentEditorSheet extends StatefulWidget {
  const _AgentEditorSheet({required this.model, required this.draft, required this.canDelete});

  final AppModel model;
  final AppAgent draft;
  final bool canDelete;

  @override
  State<_AgentEditorSheet> createState() => _AgentEditorSheetState();
}

class _AgentEditorSheetState extends State<_AgentEditorSheet> {
  late AppAgent _agent;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _promptCtrl;
  late final TextEditingController _mdCtrl;

  IconData _domainIcon(AgentDomain d) => switch (d) {
        AgentDomain.expenses => Icons.pie_chart_outline,
        AgentDomain.cashflow => Icons.swap_vert,
        AgentDomain.income => Icons.payments_outlined,
        AgentDomain.assets => Icons.savings_outlined,
        AgentDomain.liabilities => Icons.credit_card,
        AgentDomain.projection => Icons.auto_graph,
      };

  String _domainLabel(AgentDomain d) => switch (d) {
        AgentDomain.expenses => 'Expenses',
        AgentDomain.cashflow => 'Cash flow',
        AgentDomain.income => 'Income',
        AgentDomain.assets => 'Assets',
        AgentDomain.liabilities => 'Liabilities',
        AgentDomain.projection => 'Projection / FX',
      };

  String _agentKindEditorLabel(AppAgentKind k) => switch (k) {
        AppAgentKind.helper => 'Helper — guides across the app',
        AppAgentKind.analyst => 'Analyst — data + ledger tools',
        AppAgentKind.researcher => 'Researcher — Gemini + markets tone',
      };

  bool _hasPerm(AgentDomain d, AgentAccess a) => _agent.permissions.contains(AgentPermission(domain: d, access: a));

  void _setPerm(AgentDomain d, AgentAccess a, bool on) {
    setState(() {
      final next = [..._agent.permissions];
      final p = AgentPermission(domain: d, access: a);
      if (on) {
        if (!next.contains(p)) next.add(p);
      } else {
        next.remove(p);
      }
      _agent.permissions = next;
    });
  }

  @override
  void initState() {
    super.initState();
    _agent = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _agent.name);
    _descCtrl = TextEditingController(text: _agent.description);
    _promptCtrl = TextEditingController(text: _agent.systemPrompt);
    _mdCtrl = TextEditingController(text: _agent.contextMarkdown);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _promptCtrl.dispose();
    _mdCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _agent.name = _nameCtrl.text.trim();
    _agent.description = _descCtrl.text.trim();
    _agent.systemPrompt = _promptCtrl.text.trim();
    _agent.contextMarkdown = _mdCtrl.text.trim();
    if (_agent.name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agent name is required'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    Navigator.of(context).pop(_AgentEditorOutcome(agent: _agent));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 6, 16, 16 + bottom + safeBottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Agent',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<AppAgentKind>(
              initialValue: _agent.kind,
              decoration: const InputDecoration(
                labelText: 'Agent type',
                border: OutlineInputBorder(),
              ),
              items: [
                for (final k in AppAgentKind.values)
                  DropdownMenuItem(
                    value: k,
                    child: Text(_agentKindEditorLabel(k)),
                  ),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() {
                  _agent.kind = v;
                  if (v == AppAgentKind.researcher) {
                    _agent.toolWebResearch = true;
                  }
                });
              },
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Home summary tool'),
              subtitle: const Text('Model can set the Home card via zoro_actions'),
              value: _agent.toolHomeSummary,
              onChanged: (v) => setState(() => _agent.toolHomeSummary = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Web / markets context'),
              subtitle: Text(
                _agent.kind == AppAgentKind.researcher
                    ? 'On for researcher (Gemini).'
                    : 'Extra guidance for external context (still uses your chat provider unless researcher).',
                style: const TextStyle(fontSize: 12),
              ),
              value: _agent.toolWebResearch,
              onChanged: _agent.kind == AppAgentKind.researcher
                  ? null
                  : (v) => setState(() => _agent.toolWebResearch = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Settings admin tools'),
              subtitle: const Text('Can change agents, LLM defaults, and privacy via zoro_actions'),
              value: _agent.toolSettingsAdmin,
              onChanged: (v) => setState(() => _agent.toolSettingsAdmin = v),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<LlmProvider?>(
              initialValue: _agent.llmProviderOverride,
              decoration: const InputDecoration(
                labelText: 'LLM routing override',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem<LlmProvider?>(
                  value: null,
                  child: Text('Default (researcher → Gemini, others → global picker)'),
                ),
                for (final p in LlmProvider.values)
                  DropdownMenuItem(
                    value: p,
                    child: Text(switch (p) {
                      LlmProvider.appleFoundation => 'Apple on-device',
                      LlmProvider.openai => 'OpenAI',
                      LlmProvider.anthropic => 'Anthropic',
                      LlmProvider.gemini => 'Gemini',
                    }),
                  ),
              ],
              onChanged: (v) => setState(() => _agent.llmProviderOverride = v),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _promptCtrl,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'System prompt',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            const Text('Permissions', style: TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            ...AgentDomain.values.map((d) {
              final cs = Theme.of(context).colorScheme;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: cs.outlineVariant),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: cs.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(_domainIcon(d), color: cs.onSurfaceVariant, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_domainLabel(d), style: const TextStyle(fontWeight: FontWeight.w900)),
                      ),
                      FilterChip(
                        label: const Text('Read'),
                        selected: _hasPerm(d, AgentAccess.read),
                        onSelected: (on) => _setPerm(d, AgentAccess.read, on),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Write'),
                        selected: _hasPerm(d, AgentAccess.write),
                        onSelected: (on) => _setPerm(d, AgentAccess.write, on),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            TextField(
              controller: _mdCtrl,
              maxLines: 10,
              decoration: const InputDecoration(
                labelText: 'Context note (Markdown)',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (widget.canDelete)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(const _AgentEditorOutcome(delete: true)),
                    child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const Spacer(),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(onPressed: _save, child: const Text('Save')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// (Linking assets/liabilities into agent context removed for now.)

class _NotificationsCard extends StatefulWidget {
  const _NotificationsCard({required this.model});

  final AppModel model;

  @override
  State<_NotificationsCard> createState() => _NotificationsCardState();
}

class _NotificationsCardState extends State<_NotificationsCard> {
  bool _busy = false;
  NotificationAuthStatus _authStatus = NotificationAuthStatus.unknown;

  @override
  void initState() {
    super.initState();
    _refreshAuthStatus();
  }

  Future<void> _refreshAuthStatus() async {
    final s = await NotificationService.instance.currentAuthStatus();
    if (!mounted) return;
    setState(() => _authStatus = s);
  }

  Future<void> _onMasterChanged(bool v) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (v) {
        final granted = await NotificationService.instance.requestPermission();
        await _refreshAuthStatus();
        if (!granted) {
          if (!mounted) return;
          final denied = _authStatus == NotificationAuthStatus.denied;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                denied
                    ? 'Notifications are blocked at the OS level. Open System Settings to enable.'
                    : 'Notifications were not granted.',
              ),
              behavior: SnackBarBehavior.floating,
              action: denied
                  ? SnackBarAction(
                      label: 'Settings',
                      onPressed: _openSystemSettings,
                    )
                  : null,
            ),
          );
          return;
        }
      }
      widget.model.setNotificationsEnabled(v);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickTime() async {
    final model = widget.model;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: model.reminderNotifyHour, minute: model.reminderNotifyMinute),
    );
    if (picked == null) return;
    model.setReminderNotifyTime(hour: picked.hour, minute: picked.minute);
  }

  Future<void> _openSystemSettings() async {
    try {
      await openAppSettings();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not open system settings. Open iOS Settings → Zoro → Notifications.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _permissionRowText() => switch (_authStatus) {
        NotificationAuthStatus.denied => 'Disabled in system settings',
        NotificationAuthStatus.unknown => 'Checking system settings',
        NotificationAuthStatus.unsupported => 'Not supported',
        NotificationAuthStatus.authorized => '',
      };

  Color _authColor(ColorScheme scheme) => switch (_authStatus) {
        NotificationAuthStatus.authorized => scheme.primary,
        NotificationAuthStatus.denied => scheme.error,
        _ => scheme.onSurfaceVariant,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final model = widget.model;
    final timeLabel =
        '${model.reminderNotifyHour.toString().padLeft(2, '0')}:${model.reminderNotifyMinute.toString().padLeft(2, '0')}';
    final showPermissionRow = _authStatus != NotificationAuthStatus.authorized;
    return Material(
      color: scheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Allow notifications', style: TextStyle(fontWeight: FontWeight.w900)),
              value: model.notificationsEnabled,
              onChanged: _busy ? null : _onMasterChanged,
            ),
            if (showPermissionRow) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.info_outline, size: 18, color: _authColor(scheme)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _permissionRowText(),
                      style: TextStyle(color: _authColor(scheme), fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (_authStatus == NotificationAuthStatus.denied)
                    TextButton(
                      onPressed: _openSystemSettings,
                      child: const Text('Open Settings'),
                    ),
                ],
              ),
            ],
            if (model.notificationsEnabled) ...[
              const Divider(height: 20),
              InkWell(
                onTap: _pickTime,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Icon(Icons.schedule, color: scheme.onSurfaceVariant, size: 20),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text('Reminder check time', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                      Text(timeLabel, style: TextStyle(fontWeight: FontWeight.w800, color: scheme.onSurface)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

