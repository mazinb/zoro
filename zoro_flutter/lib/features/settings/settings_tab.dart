import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../core/finance/currency.dart';
import '../../shared/help/tab_help_content.dart';
import '../../shared/settings/home_messages_settings_card.dart';
import '../../shared/widgets/tab_header_actions.dart';
import '../../core/entitlements/mobile_entitlements.dart';
import '../../shared/widgets/cloud_import_consent_sheet.dart';
import 'dart:io' show Platform;

import '../../core/iap/apple_subscription_store.dart';
import '../../core/iap/play_subscription_store.dart';
import '../../core/platform/platform_ai.dart';
import '../../core/legal/legal_urls.dart';
import '../../core/legal/open_legal_url.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import 'data_transfer_pane.dart';
import '../command_center/home_summary_helper_sheet.dart';
import 'internal_agent_prompt_editor_page.dart';

abstract class SettingsTabIndex {
  static const int reminders = 0;
  static const int agents = 1;
  static const int usage = 2;
  // Back-compat for older callers.
  static const int permissions = usage;
}

class SettingsTab extends StatefulWidget {
  const SettingsTab({
    super.key,
    required this.model,
    required this.tabIndexListenable,
    this.agentSectionListenable,
  });

  final AppModel model;
  final ValueListenable<int> tabIndexListenable;

  /// When set, switches the Agents sub-section (home / ledger / context / goals / data).
  final ValueListenable<AgentSettingsSection>? agentSectionListenable;

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
    widget.agentSectionListenable?.addListener(_onAgentSectionRequested);
  }

  @override
  void didUpdateWidget(covariant SettingsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tabIndexListenable != widget.tabIndexListenable) {
      oldWidget.tabIndexListenable.removeListener(_onTabIndexRequested);
      widget.tabIndexListenable.removeListener(_onTabIndexRequested);
      widget.tabIndexListenable.addListener(_onTabIndexRequested);
      widget.agentSectionListenable?.removeListener(_onAgentSectionRequested);
      widget.agentSectionListenable?.addListener(_onAgentSectionRequested);
      _onTabIndexRequested();
      _onAgentSectionRequested();
    }
  }

  @override
  void dispose() {
    widget.tabIndexListenable.removeListener(_onTabIndexRequested);
    widget.agentSectionListenable?.removeListener(_onAgentSectionRequested);
    _tabs.dispose();
    super.dispose();
  }

  void _onAgentSectionRequested() {
    // Handled by [_AgentsPane] via its own listener.
  }

  void _onTabIndexRequested() {
    final target = widget.tabIndexListenable.value.clamp(0, 2);
    if (_tabs.index == target) return;
    _tabs.animateTo(target);
  }

  void openHelpersSection(AgentSettingsSection section) {
    _tabs.animateTo(1);
    final s = widget.agentSectionListenable;
    if (s is ValueNotifier<AgentSettingsSection>) {
      s.value = section;
    }
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
              const Spacer(),
              ListenableBuilder(
                listenable: widget.model,
                builder: (context, _) => TabHeaderActions(
                  model: widget.model,
                  help: TabHelpContent.settings,
                  guideEnabled: true,
                  assistantEnabled: true,
                  howItWorksExtras: widget.model,
                  howItWorksShowBullets: widget.model.guideEnabledSettings,
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
              Tab(text: 'Helpers'),
              Tab(text: 'Usage'),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _GeneralPane(model: widget.model),
              _AgentsPane(
                model: widget.model,
                sectionListenable: widget.agentSectionListenable,
              ),
              ListenableBuilder(
                listenable: widget.model,
                builder: (context, _) => _UsagePane(model: widget.model),
              ),
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

  void _syncFxFieldsFromModel() {
    final u1 = model.usdPerUnitResolved(model.homeCurrencyQuickPick1);
    final next1 = u1 > 0 ? (1 / u1).toStringAsFixed(2) : '';
    final pick2 = model.homeCurrencyQuickPick2;
    final next2 = pick2 == null
        ? ''
        : () {
            final u2 = model.usdPerUnitResolved(pick2);
            return u2 > 0 ? (1 / u2).toStringAsFixed(2) : '';
          }();
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
    if (model.homeCurrencyQuickPick1 != CurrencyCode.usd) {
      if (thbPerUsd != null && thbPerUsd > 0) {
        model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, 1 / thbPerUsd);
      } else {
        model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, null);
      }
    }
    final pick2 = model.homeCurrencyQuickPick2;
    if (pick2 != null) {
      if (inrPerUsd != null && inrPerUsd > 0) {
        model.setFxUsdPerUnitOverride(pick2, 1 / inrPerUsd);
      } else {
        model.setFxUsdPerUnitOverride(pick2, null);
      }
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
                    if (model.homeCurrencyQuickPick1 != CurrencyCode.usd) model.homeCurrencyQuickPick1,
                    if (model.homeCurrencyQuickPick2 != null) model.homeCurrencyQuickPick2!,
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
    CurrencyCode.hkd,
  ];

  Widget _fxRateRow(
    BuildContext context, {
    required TextEditingController controller,
    required CurrencyCode selected,
    required ValueChanged<CurrencyCode> onCurrencyChanged,
    CurrencyCode? exclude,
    Widget? trailing,
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
                  if (c != exclude)
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
          if (trailing != null) ...[
            const SizedBox(width: 4),
            trailing,
          ],
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
                  if (model.homeCurrencyQuickPick1 == CurrencyCode.usd)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () {
                          model.addHomeCurrency();
                          _syncFxFieldsFromModel();
                          setState(() {});
                        },
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add currency'),
                      ),
                    )
                  else
                    _fxRateRow(
                      context,
                      controller: _usdToThbCtrl,
                      selected: model.homeCurrencyQuickPick1,
                      exclude: model.homeCurrencyQuickPick2,
                      onCurrencyChanged: (c) {
                        if (c == model.homeCurrencyQuickPick1) return;
                        model.setFxUsdPerUnitOverride(model.homeCurrencyQuickPick1, null);
                        model.setHomeCurrencyQuickPick(1, c);
                        _syncFxFieldsFromModel();
                        _applyFxFromFieldsToModel();
                      },
                    ),
                  if (model.homeCurrencyQuickPick2 != null) ...[
                    Divider(height: 1, thickness: 0.5, color: cs.outlineVariant.withValues(alpha: 0.35)),
                    _fxRateRow(
                      context,
                      controller: _usdToInrCtrl,
                      selected: model.homeCurrencyQuickPick2!,
                      exclude: model.homeCurrencyQuickPick1,
                      onCurrencyChanged: (c) {
                        final cur = model.homeCurrencyQuickPick2;
                        if (cur == null || c == cur) return;
                        model.setFxUsdPerUnitOverride(cur, null);
                        model.setHomeCurrencyQuickPick(2, c);
                        _syncFxFieldsFromModel();
                        _applyFxFromFieldsToModel();
                      },
                      trailing: IconButton(
                        tooltip: 'Remove second currency',
                        icon: Icon(Icons.close, size: 20, color: cs.onSurfaceVariant),
                        onPressed: () {
                          model.setSecondHomeCurrency(null);
                          _syncFxFieldsFromModel();
                          setState(() {});
                        },
                      ),
                    ),
                  ] else if (model.homeCurrencyQuickPick1 != CurrencyCode.usd)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () {
                          model.addHomeCurrency();
                          _syncFxFieldsFromModel();
                          setState(() {});
                        },
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add second currency'),
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

  void _openAgentSettingsSection(AgentSettingsSection section) {
    context.findAncestorStateOfType<_SettingsTabState>()?.openHelpersSection(section);
  }

  Future<void> _openExportPage() async {
    if (!mounted) return;
    // Prefer navigating within Settings → Helpers → Data.
    if (context.findAncestorStateOfType<_SettingsTabState>() != null) {
      _openAgentSettingsSection(AgentSettingsSection.data);
      return;
    }
    // Fallback (should be rare): open a dedicated page.
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (ctx) => Scaffold(
          appBar: AppBar(title: const Text('Export / import')),
          body: DataTransferPane(model: model),
        ),
      ),
    );
  }

  Future<void> _confirmReset() async {
    HapticFeedback.mediumImpact();
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Zoro?'),
        content: const Text('This will erase all on-device data and restart onboarding.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop(false);
              await _openExportPage();
            },
            child: const Text('Export'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Erase'),
          ),
        ],
      ),
    );
    if (res != true) return;
    await model.resetAllUserDataAndRestartOnboarding();
  }

  @override
  Widget build(BuildContext context) {
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
            HomeMessagesSettingsCard(
              model: model,
              onOpenHomeSettings: () => _openAgentSettingsSection(AgentSettingsSection.home),
            ),
            const SizedBox(height: 12),
            _NotificationsCard(model: model),
        if (model.notificationsEnabled) ...[
          const SizedBox(height: 12),
          _settingsCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _CadenceRow(
                  label: 'Goals',
                  value: model.remindersGoalsCadence,
                  onChanged: model.setReminderCadenceGoals,
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
        ],
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: _confirmReset,
            child: const Text('Restart onboarding'),
          ),
        ),
          ],
        );
      },
    );
  }
}

class _AgentsPane extends StatefulWidget {
  const _AgentsPane({required this.model, this.sectionListenable});

  final AppModel model;
  final ValueListenable<AgentSettingsSection>? sectionListenable;

  @override
  State<_AgentsPane> createState() => _AgentsPaneState();
}

class _AgentsPaneState extends State<_AgentsPane> {
  AgentSettingsSection _section = AgentSettingsSection.context;
  late final TextEditingController _homeSummaryCtrl;
  final FocusNode _homeSummaryFocus = FocusNode();
  bool _suppressHomeSummaryOnChanged = false;

  @override
  void initState() {
    super.initState();
    _homeSummaryCtrl = TextEditingController(text: widget.model.homeSummaryText);
    widget.model.addListener(_syncHomeSummaryCtrlFromModel);
    widget.sectionListenable?.addListener(_onSectionListenable);
    _onSectionListenable();
  }

  void _onSectionListenable() {
    final l = widget.sectionListenable;
    if (l == null) return;
    final next = l.value;
    if (_section != next) setState(() => _section = next);
  }

  @override
  void dispose() {
    widget.sectionListenable?.removeListener(_onSectionListenable);
    widget.model.removeListener(_syncHomeSummaryCtrlFromModel);
    _homeSummaryCtrl.dispose();
    _homeSummaryFocus.dispose();
    super.dispose();
  }

  void _syncHomeSummaryCtrlFromModel() {
    if (!mounted) return;
    if (_homeSummaryFocus.hasFocus) return;
    final m = widget.model.homeSummaryText;
    if (_homeSummaryCtrl.text == m) return;
    _suppressHomeSummaryOnChanged = true;
    _homeSummaryCtrl.value = TextEditingValue(
      text: m,
      selection: TextSelection.collapsed(offset: m.length),
    );
    _suppressHomeSummaryOnChanged = false;
  }

  Widget _iconSwitcher() {
    final accent = widget.model.accent;
    final cs = Theme.of(context).colorScheme;

    Widget iconTab({
      required AgentSettingsSection s,
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
          iconTab(s: AgentSettingsSection.home, icon: Icons.dashboard_outlined),
          const SizedBox(width: 16),
          iconTab(s: AgentSettingsSection.ledger, icon: Icons.view_agenda_outlined),
          const SizedBox(width: 16),
          iconTab(s: AgentSettingsSection.context, icon: Icons.library_books_outlined),
          const SizedBox(width: 16),
          iconTab(s: AgentSettingsSection.goals, icon: Icons.flag_outlined),
          const SizedBox(width: 16),
          iconTab(s: AgentSettingsSection.data, icon: Icons.import_export),
        ],
      ),
    );
  }

  Widget _homePane() {
    final model = widget.model;
    final homeHelperDef = internalAppAgentDefinitionById(InternalAppAgentIds.homeSummaryHelper);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (homeHelperDef != null) ...[
          Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: model.accentSoft,
                child: Icon(homeHelperDef.icon, color: model.accent, size: 22),
              ),
              title: Text(homeHelperDef.title, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(
                homeHelperDef.listSubtitle,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
              trailing: Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.outline),
              onTap: () {
                Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (ctx) => InternalAgentPromptEditorPage(definition: homeHelperDef, model: model),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Text(
              'Home summary',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            IconButton(
              tooltip: 'Daily focus topics',
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              onPressed: () => showHomeSummaryHelperSheet(context, model),
              icon: Icon(Icons.info_outline, size: 20, color: Theme.of(context).colorScheme.outline),
            ),
            const Spacer(),
            TextButton(
              onPressed: model.homeSummaryText.trim().isEmpty
                  ? null
                  : () {
                      _suppressHomeSummaryOnChanged = true;
                      _homeSummaryCtrl.value = const TextEditingValue();
                      _suppressHomeSummaryOnChanged = false;
                      model.setHomeSummaryText('');
                    },
              child: const Text('Clear'),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Expanded(
          child: TextField(
            controller: _homeSummaryCtrl,
            focusNode: _homeSummaryFocus,
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
            onChanged: (v) {
              if (_suppressHomeSummaryOnChanged) return;
              model.setHomeSummaryText(v);
            },
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

  Widget _goalsPane() {
    final model = widget.model;
    final cs = Theme.of(context).colorScheme;
    const goalsIds = {
      InternalAppAgentIds.goalsRetirementCorpus,
      InternalAppAgentIds.goalsRetirementSplit,
      InternalAppAgentIds.goalsRetirementBuckets,
      InternalAppAgentIds.goalsReviewLiabilities,
      InternalAppAgentIds.goalsReviewAssetReturns,
      InternalAppAgentIds.goalsReviewAssumptions,
      InternalAppAgentIds.goalsExpenseEstimator,
    };
    final defs = kInternalAppAgentDefinitions.where((d) => goalsIds.contains(d.id)).toList()
      ..sort((a, b) {
        const order = [
          InternalAppAgentIds.goalsRetirementCorpus,
          InternalAppAgentIds.goalsRetirementSplit,
          InternalAppAgentIds.goalsRetirementBuckets,
          InternalAppAgentIds.goalsReviewLiabilities,
          InternalAppAgentIds.goalsReviewAssetReturns,
          InternalAppAgentIds.goalsReviewAssumptions,
          InternalAppAgentIds.goalsExpenseEstimator,
        ];
        return order.indexOf(a.id).compareTo(order.indexOf(b.id));
      });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              Text(
                'Guide prompts',
                style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurface, fontSize: 15),
              ),
              const SizedBox(height: 8),
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
        d.id == InternalAppAgentIds.ledgerOrchestrator ||
        d.id.startsWith('ledger_');

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

  @override
  Widget build(BuildContext context) {
    Widget body = switch (_section) {
      AgentSettingsSection.home => _homePane(),
      AgentSettingsSection.ledger => _ledgerPane(),
      AgentSettingsSection.context => _contextPane(),
      AgentSettingsSection.goals => _goalsPane(),
      AgentSettingsSection.data => DataTransferPane(model: widget.model),
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
}

enum AgentSettingsSection { home, ledger, context, goals, data }

class _UsagePane extends StatefulWidget {
  const _UsagePane({required this.model});

  final AppModel model;

  @override
  State<_UsagePane> createState() => _UsagePaneState();
}

class _UsagePaneState extends State<_UsagePane> {
  StreamSubscription<void>? _purchaseUpdatesSub;

  AppModel get model => widget.model;

  @override
  void initState() {
    super.initState();
    unawaited(model.refreshMobileEntitlements());
    if (!kIsWeb) {
      _purchaseUpdatesSub ??= AppleSubscriptionStore.purchaseUpdates().listen((_) {
        unawaited(model.applyEntitlementsFromIap(model.iap));
      });
    }
  }

  @override
  void dispose() {
    _purchaseUpdatesSub?.cancel();
    super.dispose();
  }

  static String _freePlanLine(AppModel model, MobileEntitlements? ent, int credits) {
    if (model.inSetupImportPhase && ent != null) {
      return '${ent.onboardingImportsRemaining} of ${MobileEntitlements.onboardingImportAllowance} setup imports left · $credits credits';
    }
    if (ent?.freeAiUsed == true) {
      return 'Monthly free import used · $credits credits';
    }
    return '1 free import this month · $credits credits';
  }

  static String _importLimitDetail(AppModel model, MobileEntitlements? ent) {
    if (model.isPro) return 'Unlimited imports with Pro.';
    if (model.inSetupImportPhase && ent != null) {
      return 'During setup you can run up to ${MobileEntitlements.onboardingImportAllowance} imports '
          '(${ent.onboardingImportsRemaining} left). After assets and 6 months of expenses are in, '
          'you get 1 free import per month.';
    }
    if (ent?.freeAiUsed == true) {
      return 'Your free import this month is used. Buy credits or upgrade to Pro for more.';
    }
    return 'After setup: 1 free import per month, then 1 credit per import.';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final iap = model.iap;
    final catalog = iap.catalog;
    final isPro = model.isPro;
    final ent = model.mobileEntitlements;
    final credits = model.creditsBalance;

    Future<void> buy(ProductDetails? p) async {
      if (p == null) return;
      await iap.buyProduct(p);
      await model.applyEntitlementsFromIap(iap);
    }

    Future<void> restore() async {
      await iap.restore();
      await model.applyEntitlementsFromIap(iap);
    }

    Widget card({required Widget child}) {
      return Material(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isPro ? 'Pro' : 'Free',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              if (isPro) ...[
                const SizedBox(height: 8),
                Text(
                  'Unlimited imports and exports',
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
                ),
              ] else ...[
                const SizedBox(height: 8),
                Text(
                  _freePlanLine(model, ent, credits),
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
                ),
                const SizedBox(height: 6),
                Text(
                  _importLimitDetail(model, ent),
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, height: 1.35),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (iap.lastError != null && iap.lastError!.trim().isNotEmpty) ...[
          Text(iap.lastError!, style: TextStyle(color: cs.error, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
        ],
        card(child: _ImportAiUsageSection(model: model)),
        const SizedBox(height: 12),
        card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!isPro) ...[
                FilledButton(
                  onPressed: iap.available && !iap.busy ? () => buy(catalog?.proMonthly) : null,
                  child: Text(
                    catalog?.proMonthly == null ? 'Pro' : 'Pro · ${catalog!.proMonthly!.price}/mo',
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: iap.available && !iap.busy ? () => buy(catalog?.credit1) : null,
                  child: Text(
                    catalog?.credit1 == null ? 'Credits' : 'Credits · ${catalog!.credit1!.price}',
                  ),
                ),
                TextButton(
                  onPressed: iap.available && !iap.busy ? restore : null,
                  child: const Text('Restore purchases'),
                ),
              ] else ...[
                OutlinedButton(
                  onPressed: () {
                    if (!kIsWeb && Platform.isIOS) {
                      AppleSubscriptionStore.showManageSubscriptions();
                    } else if (!kIsWeb && Platform.isAndroid) {
                      PlaySubscriptionStore.showManageSubscriptions();
                    }
                  },
                  child: const Text('Manage subscription'),
                ),
                TextButton(
                  onPressed: iap.available && !iap.busy ? restore : null,
                  child: const Text('Restore purchases'),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SubscriptionLegalLinks(colorScheme: cs),
      ],
    );
  }
}

class _SubscriptionLegalLinks extends StatelessWidget {
  const _SubscriptionLegalLinks({required this.colorScheme});

  final ColorScheme colorScheme;

  Future<void> _open(BuildContext context, String url) async {
    await openExternalUrl(url, context: context);
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 0,
        children: [
          TextButton(
            onPressed: () => _open(context, LegalUrls.termsOfUse),
            child: const Text('Terms of Use'),
          ),
          TextButton(
            onPressed: () => _open(context, LegalUrls.privacyPolicy),
            child: const Text('Privacy Policy'),
          ),
        ],
      ),
    );
  }
}

class _ImportAiUsageSection extends StatefulWidget {
  const _ImportAiUsageSection({required this.model});

  final AppModel model;

  @override
  State<_ImportAiUsageSection> createState() => _ImportAiUsageSectionState();
}

class _ImportAiUsageSectionState extends State<_ImportAiUsageSection> {
  AppModel get model => widget.model;

  String? _onDeviceNote() {
    if (model.appleFoundationRuntimeAvailable) return null;
    return PlatformAi.onDeviceUnavailableNote(disabledReason: model.appleFoundationDisabledReason);
  }

  Future<void> _onCloudToggle(bool value) async {
    if (value) {
      final ok = await CloudImportConsentGate.ensure(context, model);
      if (!ok && mounted) setState(() {});
      return;
    }
    await model.setCloudImportEnabled(false);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final onDeviceNote = _onDeviceNote();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ImportAiUsageRow(
          title: PlatformAi.onDeviceSettingsTitle,
          icon: Icons.memory_outlined,
          requests: model.onDeviceRequestCount,
          note: onDeviceNote,
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(Icons.cloud_outlined, size: 20, color: cs.onSurfaceVariant),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Cloud AI · ${model.cloudAiRequestCount} requests',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
            Switch.adaptive(
              value: model.canUseCloudImport,
              onChanged: _onCloudToggle,
            ),
          ],
        ),
      ],
    );
  }
}

class _ImportAiUsageRow extends StatelessWidget {
  const _ImportAiUsageRow({
    required this.title,
    required this.icon,
    required this.requests,
    this.note,
  });

  final String title;
  final IconData icon;
  final int requests;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: cs.onSurfaceVariant),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '$title · $requests requests',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
            ),
          ],
        ),
        if (note != null) ...[
          const SizedBox(height: 6),
          Text(
            note!,
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, height: 1.35),
          ),
        ],
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

class _NotificationsCard extends StatefulWidget {
  const _NotificationsCard({required this.model});

  final AppModel model;

  @override
  State<_NotificationsCard> createState() => _NotificationsCardState();
}

class _NotificationsCardState extends State<_NotificationsCard> {
  bool _busy = false;

  Future<void> _onMasterChanged(bool v) async {
    if (_busy) return;
    if (!v) {
      widget.model.setNotificationsEnabled(false);
      return;
    }
    setState(() => _busy = true);
    try {
      final svc = NotificationService.instance;
      if (await svc.isAuthorized()) {
        widget.model.setNotificationsEnabled(true);
        return;
      }
      // Always call requestPermission first. iOS only shows the system prompt here
      // (not on checkPermissions). Skipping straight to "Settings" when status looks
      // "denied" also breaks first launch — notDetermined reads as not enabled too,
      // and the Notifications row won't exist in Settings until we've asked once.
      final granted = await svc.requestPermission();
      if (!granted) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text(
              'Notifications are not enabled. Allow them in the prompt, or turn on Zoro in Settings.',
            ),
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'Settings',
              onPressed: () {
                unawaited(launchUrl(Uri.parse('app-settings:')));
              },
            ),
          ),
        );
        return;
      }
      widget.model.setNotificationsEnabled(true);
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

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final model = widget.model;
    final timeLabel =
        '${model.reminderNotifyHour.toString().padLeft(2, '0')}:${model.reminderNotifyMinute.toString().padLeft(2, '0')}';
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

