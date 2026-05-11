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

/// Loads state, runs due agent tasks (posting briefings), and posts a single
/// grouped reminder summary for any domains that pass [AppModel.isReminderNotifiable].
Future<void> _runRefresh() async {
  final service = NotificationService.instance;
  await service.init();
  final model = await BackgroundStateLoader.load();

  if (!model.notificationsEnabled) {
    _log('master switch is off, nothing to do');
    return;
  }

  await _runDueAgentTasks(model, service);
  await _postReminderSummary(model, service);
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
    final preview = model.homeSummaryText.trim();
    await service.postAgentBriefing(
      taskId: task.id,
      title: task.name,
      body: preview.isEmpty ? 'Briefing ready — tap to open Zoro' : preview,
    );
  }
}

Future<void> _postReminderSummary(AppModel model, NotificationService service) async {
  final domains = model.notifiableReminderDomains();
  _log('reminder domains eligible=${domains.length}');
  if (domains.isEmpty) return;
  await service.postReminderSummary(domains);
  final now = DateTime.now();
  for (final d in domains) {
    model.markDomainNotified(d, at: now);
  }
}
