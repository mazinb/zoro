import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:workmanager/workmanager.dart';

import '../schedule/scheduled_agent_runner.dart';
import '../state/app_model.dart';
import '../state/scheduled_agent_task.dart';
import 'background_state_loader.dart';
import 'notification_service.dart';

void _log(String message) {
  if (kDebugMode) {
    debugPrint('[ZoroBg] $message');
  }
}

/// Stable identifier for the periodic refresh task, registered from
/// `main.dart` and listed in iOS's `BGTaskSchedulerPermittedIdentifiers`.
const String zoroBackgroundTaskName = 'com.getzoro.zoroFlutter.refresh';

/// Workmanager entrypoint. Must be a top-level function and annotated
/// `vm:entry-point` so AOT compilation keeps it.
@pragma('vm:entry-point')
void zoroBackgroundDispatcher() {
  WidgetsFlutterBinding.ensureInitialized();
  Workmanager().executeTask((taskName, inputData) async {
    _log('dispatcher start task=$taskName');
    try {
      await _runRefresh();
      _log('dispatcher done task=$taskName');
      return true;
    } catch (e, st) {
      _log('dispatcher error: $e\n$st');
      return false;
    }
  });
}

/// Loads state, runs due agent tasks (posting briefings), and emits at most
/// one rotation reminder when the daily gate is open.
///
/// Persistence is awaited at the end of each step because the Workmanager
/// isolate is short-lived: a microtask-only persist (the foreground default)
/// can be torn down before disk is flushed, which previously caused the same
/// "fired today" flag to be lost and the same reminder to fire again on the
/// next 15-minute wake.
Future<void> _runRefresh() async {
  final service = NotificationService.instance;
  await service.init();
  final model = await BackgroundStateLoader.load();

  if (!model.notificationsEnabled) {
    _log('master switch is off, nothing to do');
    return;
  }

  await _runDueAgentTasks(model, service);
  // Commits any past-scheduled reminder fire and schedules the next OS
  // one-shot for the upcoming notify slot. Idempotent.
  await model.syncNotifications();
  // Safety net: if scheduling failed for some reason and the gate is
  // currently open (no pending OS push, today's slot reached, eligible
  // domain), post directly via show().
  final firedDomain = await model.maybePostDailyReminder();
  _log('rotation fallback fired=${firedDomain?.name ?? "none"}');
  await model.persistAppStateToDisk();
}

Future<void> _runDueAgentTasks(AppModel model, NotificationService service) async {
  final runner = ScheduledAgentRunner();
  final eligible = <ScheduledAgentTask>[];
  for (final t in model.scheduledAgentTasks) {
    if (!t.notify) continue;
    if (!scheduledTaskIsDue(t)) continue;
    eligible.add(t);
  }
  _log('agent tasks eligible=${eligible.length}');
  for (final task in eligible) {
    final outcome = await runner.runOneTask(model, task);
    if (!outcome.ok) {
      _log('agent task ${task.id} failed: ${outcome.error}');
      continue;
    }
    await service.postAgentBriefing(
      taskId: task.id,
      title: task.name,
    );
  }
}
