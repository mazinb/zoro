import 'dart:async';

import 'package:flutter/material.dart';

import 'core/state/app_model.dart';
import 'features/shell/app_shell.dart';

class ZoroApp extends StatefulWidget {
  const ZoroApp({super.key});

  @override
  State<ZoroApp> createState() => _ZoroAppState();
}

class _ZoroAppState extends State<ZoroApp> {
  final _model = AppModel();

  @override
  void initState() {
    super.initState();
    // Run after the first frame so the shell paints and stays responsive while
    // disk + hydration work runs (large app_state.json was freezing taps on device).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_model.bootstrap());
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _model,
      builder: (context, _) {
        return MaterialApp(
          title: 'Zoro',
          theme: _model.themedLight(),
          darkTheme: _model.themedDark(),
          themeMode: _model.themeModePreference,
          home: AppShell(model: _model),
        );
      },
    );
  }
}
