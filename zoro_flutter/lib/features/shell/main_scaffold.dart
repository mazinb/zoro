import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../command_center/command_center_tab.dart';
import '../agents/agents_tab.dart';
import '../ledger/ledger_tab.dart';
import '../chat/chat_tab.dart';
import '../settings/settings_tab.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key, required this.model});

  final AppModel model;

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _index = 0;
  String? _ledgerFocus;
  final ValueNotifier<int> _settingsTabIndex = ValueNotifier<int>(0);

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

  void _goToSettingsTab(int tabIndex) {
    setState(() => _index = _settingsIndex);
    _settingsTabIndex.value = tabIndex;
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

  @override
  void dispose() {
    _settingsTabIndex.dispose();
    super.dispose();
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
      AgentsTab(model: widget.model),
      ChatTab(
        model: widget.model,
        onGoToSettingsPermissions: () => _goToSettingsTab(SettingsTabIndex.permissions),
        toastGoToSettingsPermissions: () => toastGoToSettings(
          message: 'Add an API key in Settings → Permissions to enable chat.',
          settingsTabIndex: SettingsTabIndex.permissions,
        ),
      ),
      SettingsTab(model: widget.model, tabIndexListenable: _settingsTabIndex),
    ];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _index,
          children: pages,
        ),
      ),
      bottomNavigationBar: NavigationBar(
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
            icon: Icon(Icons.smart_toy_outlined),
            selectedIcon: Icon(Icons.smart_toy),
            label: 'Agents',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'Chat',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
