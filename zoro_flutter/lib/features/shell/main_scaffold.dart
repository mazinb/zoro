import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/notifications/notification_payload.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../command_center/command_center_tab.dart';
import '../context/context_tab.dart';
import '../ledger/ledger_tab.dart';
import '../goals/goals_guide_flow.dart';
import '../goals/goals_tab.dart';
import '../settings/settings_tab.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key, required this.model});

  final AppModel model;

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> with WidgetsBindingObserver {
  int _index = 0;
  String? _ledgerFocus;
  final ValueNotifier<int> _settingsTabIndex = ValueNotifier<int>(0);
  final ValueNotifier<AgentSettingsSection> _settingsAgentSection =
      ValueNotifier<AgentSettingsSection>(AgentSettingsSection.context);

  static const int _homeIndex = 0;
  static const int _ledgerIndex = 1;
  static const int _settingsIndex = 4;

  void _onPrivacyInteractionDenied() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Amounts are hidden. On Home, tap the eye icon to show values and edit.'),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Home',
          onPressed: () => setState(() => _index = _homeIndex),
        ),
      ),
    );
  }

  void _goToSettingsTab(int tabIndex, {AgentSettingsSection? agentSection}) {
    setState(() => _index = _settingsIndex);
    _settingsTabIndex.value = tabIndex;
    if (agentSection != null) {
      _settingsAgentSection.value = agentSection;
    }
  }

  void toastGoToSettings({
    required String message,
    required int settingsTabIndex,
    String actionLabel = 'Settings',
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: actionLabel,
          onPressed: () => _goToSettingsTab(settingsTabIndex),
        ),
      ),
    );
  }

  StreamSubscription<NotificationPayload>? _notifTapSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _notifTapSub = NotificationService.instance.onTap.listen(_handleNotificationPayload);
    // Drain any payload that launched the app from a terminated state.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pending = NotificationService.instance.consumeLaunchPayload();
      if (pending != null) {
        _handleNotificationPayload(pending);
      }
      // OS schedules are synced in [AppModel.bootstrap] after disk load.
      // If bootstrap already finished (hot reload), reconcile once here.
      if (widget.model.bootstrapped) {
        unawaited(widget.model.reconcileNotifications());
      }
    });
  }

  @override
  void dispose() {
    _notifTapSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _settingsTabIndex.dispose();
    _settingsAgentSection.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      unawaited(widget.model.persistAppStateToDisk());
    }
    if (state == AppLifecycleState.resumed) {
      widget.model.runDueScheduledAgentTasks();
      unawaited(widget.model.reconcileNotifications());
    }
  }

  void _handleNotificationPayload(NotificationPayload payload) {
    if (!mounted) return;
    switch (payload.kind) {
      case NotificationKind.agentTask:
        // Briefings land on Home; on-resume runner will refresh if still due.
        setState(() {
          _index = _homeIndex;
          _ledgerFocus = null;
        });
      case NotificationKind.reminder:
        final domain = payload.domain;
        if (domain == null) return;
        setState(() {
          _index = _ledgerIndex;
          _ledgerFocus = domain.name;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      CommandCenterTab(
        model: widget.model,
        onGoToLedger: (section) => setState(() {
          _index = _ledgerIndex;
          _ledgerFocus = section;
        }),
      ),
      LedgerTab(
        model: widget.model,
        focusSection: _ledgerFocus,
        onPrivacyInteractionDenied: _onPrivacyInteractionDenied,
      ),
      ContextTab(model: widget.model),
      GoalsTab(
        model: widget.model,
        onGoToSettingsAgents: () => _goToSettingsTab(
          SettingsTabIndex.agents,
          agentSection: AgentSettingsSection.goals,
        ),
        onGoToSettingsPermissions: () => _goToSettingsTab(SettingsTabIndex.permissions),
        onOpenGuide: () => openGoalsGuideLauncher(
          context: context,
          model: widget.model,
          onGoToSettingsGoals: () => _goToSettingsTab(
            SettingsTabIndex.agents,
            agentSection: AgentSettingsSection.goals,
          ),
        ),
      ),
      SettingsTab(
        model: widget.model,
        tabIndexListenable: _settingsTabIndex,
        agentSectionListenable: _settingsAgentSection,
      ),
    ];

    final bottomOverlayPad = MediaQuery.paddingOf(context).bottom +
        kBottomNavigationBarHeight +
        18; // floating pill margins + breathing room

    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: bottomOverlayPad),
          child: IndexedStack(
            index: _index,
            children: pages,
          ),
        ),
      ),
      bottomNavigationBar: Material(
        color: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        elevation: 0,
        child: SafeArea(
          top: false,
          minimum: EdgeInsets.zero,
          child: LiquidGlassBar(
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.view_agenda_outlined),
                  selectedIcon: Icon(Icons.view_agenda),
                  label: 'Ledger',
                ),
                NavigationDestination(
                  icon: Icon(Icons.library_books_outlined),
                  selectedIcon: Icon(Icons.library_books),
                  label: 'Context',
                ),
                NavigationDestination(
                  icon: Icon(Icons.flag_outlined),
                  selectedIcon: Icon(Icons.flag),
                  label: 'Goals',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings),
                  label: 'Settings',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
