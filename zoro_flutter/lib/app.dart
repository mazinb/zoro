import 'package:flutter/material.dart';

import 'core/state/app_model.dart';
import 'features/shell/main_scaffold.dart';

class ZoroApp extends StatefulWidget {
  const ZoroApp({super.key});

  @override
  State<ZoroApp> createState() => _ZoroAppState();
}

class _ZoroAppState extends State<ZoroApp> {
  final _model = AppModel();

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _model,
      builder: (context, _) {
        return MaterialApp(
          title: 'Zoro',
          theme: _model.themedLight(),
          home: MainScaffold(model: _model),
        );
      },
    );
  }
}
