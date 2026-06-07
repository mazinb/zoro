import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/notifications/notification_payload.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/state/app_model.dart';
import '../../shared/widgets/liquid_glass.dart';
import '../command_center/command_center_tab.dart';
import '../../core/home/home_summary_focus_domain.dart';
import '../command_center/home_summary_helper_service.dart';
import '../context/context_tab.dart';
import '../ledger/ledger_tab.dart';
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
  static const int _contextIndex = 2;
  static const int _goalsIndex = 3;
  static const int _settingsIndex = 4;
  bool _pendingOpenGoalsHelper = false;
  final GlobalKey<GoalsTabState> _goalsTabKey = GlobalKey<GoalsTabState>();
  String? _homeSummaryHelperAttemptedDayKey;
  bool _homeSummaryHelperBootstrapHandled = false;

  void _onPrivacyInteractionDenied() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Amounts are hidden. On Home, tap the eye icon to show values and edit.'),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Home',
          onPressed: () => _selectShellTab(_homeIndex),
        ),
      ),
    );
  }

  void _goToSettingsTab(int tabIndex, {AgentSettingsSection? agentSection}) {
    _selectShellTab(_settingsIndex);
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
    widget.model.addListener(_onAppModelChanged);
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
    widget.model.removeListener(_onAppModelChanged);
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
      unawaited(widget.model.reconcileNotifications());
      unawaited(widget.model.refreshMobileEntitlements());
      _maybeRunHomeSummaryHelper();
    }
  }

  void _onAppModelChanged() {
    if (!widget.model.bootstrapped || _homeSummaryHelperBootstrapHandled) return;
    _homeSummaryHelperBootstrapHandled = true;
    // Defer until after bootstrap notifications reconcile — avoids overlapping Apple FM calls.
    Future<void>.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      _maybeRunHomeSummaryHelper();
    });
  }

  void _maybeRunHomeSummaryHelper() {
    if (!widget.model.bootstrapped || !widget.model.onboardingComplete) return;
    final dayKey = homeSummaryCalendarDayKey(DateTime.now());
    if (_homeSummaryHelperAttemptedDayKey == dayKey) return;
    _homeSummaryHelperAttemptedDayKey = dayKey;
    unawaited(HomeSummaryHelperService().maybeRunOnAppOpen(widget.model));
  }

  void _clearReviewStateForTab(int tabIndex) {
    if (tabIndex == _ledgerIndex) {
      widget.model.clearLedgerAssetReviews();
      widget.model.clearLedgerLiabilityReviews();
    }
    if (tabIndex == _contextIndex) {
      widget.model.clearContextAssetReviews();
      widget.model.clearContextLiabilityReviews();
    }
  }

  /// Row-review icons/subtitles are ephemeral; clear when leaving Ledger or Context.
  void _selectShellTab(int next, {void Function()? andThen}) {
    if (next != _index) _clearReviewStateForTab(_index);
    setState(() {
      _index = next;
      andThen?.call();
    });
  }

  void _showGoalsLockedMessage() {
    final m = widget.model;
    final message = !m.onboardingComplete
        ? 'Complete onboarding, then import your assets and 6 months of expenses to unlock Goals.'
        : 'Import your assets and at least 6 months of cashflow to unlock Goals.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Ledger',
          onPressed: () => _selectShellTab(_ledgerIndex),
        ),
      ),
    );
  }

  bool _trySelectGoalsTab({void Function()? andThen}) {
    if (!widget.model.goalsTabUnlocked) {
      _showGoalsLockedMessage();
      return false;
    }
    _selectShellTab(_goalsIndex, andThen: andThen);
    return true;
  }

  void _onBottomNavSelected(int next) {
    if (next == _goalsIndex && !widget.model.goalsTabUnlocked) {
      _showGoalsLockedMessage();
      return;
    }
    _selectShellTab(next);
  }

  void _goToGoalsAndOpenHelper() {
    if (!_trySelectGoalsTab(andThen: () {
      _ledgerFocus = null;
      _pendingOpenGoalsHelper = true;
    })) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _goalsTabKey.currentState?.openHelperHub();
      if (mounted) setState(() => _pendingOpenGoalsHelper = false);
    });
  }

  void _handleNotificationPayload(NotificationPayload payload) {
    if (!mounted) return;
    switch (payload.kind) {
      case NotificationKind.agentTask:
        _selectShellTab(_homeIndex, andThen: () => _ledgerFocus = null);
      case NotificationKind.reminder:
        final domain = payload.domain;
        if (domain == null) return;
        if (domain == ReminderDomain.goals) {
          _goToGoalsAndOpenHelper();
          return;
        }
        _selectShellTab(_ledgerIndex, andThen: () => _ledgerFocus = domain.name);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      CommandCenterTab(
        model: widget.model,
        onGoToLedger: (section) => _selectShellTab(_ledgerIndex, andThen: () => _ledgerFocus = section),
        onGoToGoals: () => _trySelectGoalsTab(andThen: () => _ledgerFocus = null),
        onOpenGoalsHelper: _goToGoalsAndOpenHelper,
      ),
      LedgerTab(
        model: widget.model,
        focusSection: _ledgerFocus,
        onPrivacyInteractionDenied: _onPrivacyInteractionDenied,
      ),
      ContextTab(model: widget.model),
      GoalsTab(
        key: _goalsTabKey,
        model: widget.model,
        pendingOpenHelper: _pendingOpenGoalsHelper,
        onPendingOpenHelperHandled: () {
          if (_pendingOpenGoalsHelper) setState(() => _pendingOpenGoalsHelper = false);
        },
        onGoToLedger: (section) => _selectShellTab(_ledgerIndex, andThen: () => _ledgerFocus = section),
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
              onDestinationSelected: _onBottomNavSelected,
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
