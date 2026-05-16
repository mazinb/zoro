import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:workmanager/workmanager.dart';

import 'app.dart';
import 'core/notifications/background_dispatcher.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Do NOT init notifications here — with UIScene / FlutterImplicitEngineDelegate,
  // plugins register in didInitializeImplicitFlutterEngine *after* main() returns.
  // Early init marks the service "ready" while the platform channel is still nil.
  unawaited(_initBackgroundTasks());
  runApp(const ZoroApp());
}

Future<void> _initBackgroundTasks() async {
  if (kIsWeb) return;
  if (!(Platform.isAndroid || Platform.isIOS)) return;
  try {
    await Workmanager().initialize(zoroBackgroundDispatcher);
    await Workmanager().registerPeriodicTask(
      zoroBackgroundTaskName,
      zoroBackgroundTaskName,
      frequency: const Duration(minutes: 15),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.update,
    );
  } catch (e) {
    if (kDebugMode) {
      debugPrint('[Zoro] background task init failed: $e');
    }
  }
}
