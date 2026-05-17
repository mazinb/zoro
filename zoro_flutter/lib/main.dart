import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Do NOT init notifications here — with UIScene / FlutterImplicitEngineDelegate,
  // plugins register in didInitializeImplicitFlutterEngine *after* main() returns.
  runApp(const ZoroApp());
}
