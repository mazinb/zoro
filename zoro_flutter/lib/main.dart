import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:workmanager/workmanager.dart';

import 'app.dart';
import 'core/notifications/background_dispatcher.dart';
import 'core/notifications/notification_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Initialize the notification plugin so foreground reschedules + tap routing
  // work the moment the app launches. Permission is requested lazily when the
  // user enables the master switch in Settings.
  unawaited(NotificationService.instance.init());
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
