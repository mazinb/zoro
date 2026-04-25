import 'package:flutter/material.dart';

import 'features/shell/main_scaffold.dart';
import 'shared/theme/app_theme.dart';

class ZoroApp extends StatelessWidget {
  const ZoroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Zoro',
      theme: AppTheme.light,
      home: const MainScaffold(),
    );
  }
}
