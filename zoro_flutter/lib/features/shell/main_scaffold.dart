import 'package:flutter/material.dart';

import '../../core/session/session_controller.dart';
import '../../shared/widgets/animated_zoro_logo.dart';
import '../home/home_tab.dart';
import '../money/money_tab.dart';
import '../plan/plan_tab.dart';
import '../profile/profile_tab.dart';
import '../retire/retire_tab.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key, required this.session});

  final SessionController session;

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      HomeTab(session: widget.session),
      PlanTab(session: widget.session),
      MoneyTab(session: widget.session),
      RetireTab(session: widget.session),
      ProfileTab(session: widget.session),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ZoroSvgMark(size: 26),
            SizedBox(width: 10),
            Text('Zoro'),
          ],
        ),
      ),
      body: IndexedStack(
        index: _index,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            selectedIcon: Icon(Icons.fact_check),
            label: 'Plan',
          ),
          NavigationDestination(
            icon: Icon(Icons.payments_outlined),
            selectedIcon: Icon(Icons.payments),
            label: 'Money',
          ),
          NavigationDestination(
            icon: Icon(Icons.trending_up_outlined),
            selectedIcon: Icon(Icons.trending_up),
            label: 'Retire',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
