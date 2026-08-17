import 'dart:convert';
import 'dart:io';

import '../notifications/notification_payload.dart';
import '../notifications/notification_service.dart';
import 'hermes_home_paths.dart';

/// Hermes cron job ids map onto [NotificationKind.agentTask] payloads.
abstract final class HermesNotificationIds {
  static const taskPrefix = 'hermes:';
  static const minId = 1000;
  static const maxId = 1999;

  static bool isHermesTask(String? taskId) => (taskId ?? '').startsWith(taskPrefix);

  static String taskIdForJob(String jobId) => '$taskPrefix$jobId';

  static String? jobIdFromTask(String? taskId) {
    if (!isHermesTask(taskId)) return null;
    return taskId!.substring(taskPrefix.length);
  }

  static int notificationIdFor(String jobId) {
    final h = jobId.hashCode.abs() % (maxId - minId + 1);
    return minId + h;
  }
}

class CronJobDef {
  const CronJobDef({
    required this.id,
    required this.title,
    this.schedule = '',
    this.skillId = '',
    this.prompt = '',
  });

  final String id;
  final String title;
  final String schedule;
  final String skillId;
  final String prompt;

  static CronJobDef? tryParse(File file) {
    try {
      final raw = jsonDecode(file.readAsStringSync());
      if (raw is! Map) return null;
      final id = raw['id']?.toString() ?? '';
      if (id.isEmpty) return null;
      return CronJobDef(
        id: id,
        title: raw['title']?.toString() ?? id,
        schedule: raw['schedule']?.toString() ?? '',
        skillId: raw['skillId']?.toString() ?? '',
        prompt: raw['prompt']?.toString() ?? '',
      );
    } catch (_) {
      return null;
    }
  }
}

/// Phase 1: reads `hermes_home/cron/` and stays idle when empty.
/// Does not post banners itself when there are no jobs.
class CronBridge {
  CronBridge(this.home);

  final Directory home;

  Directory get _dir => Directory('${home.path}/${HermesHomePaths.cronDir}');

  Future<List<CronJobDef>> listJobs() async {
    if (!await _dir.exists()) return [];
    final out = <CronJobDef>[];
    await for (final e in _dir.list()) {
      if (e is! File || !e.path.endsWith('.json')) continue;
      final job = CronJobDef.tryParse(e);
      if (job != null) out.add(job);
    }
    return out;
  }

  /// Cancels Hermes notification ids when the master toggle or Agent jobs are off.
  Future<void> sync({
    required bool notificationsEnabled,
    required bool agentJobsEnabled,
  }) async {
    await _dir.create(recursive: true);
    final jobs = await listJobs();
    if (!notificationsEnabled || !agentJobsEnabled) {
      for (final job in jobs) {
        await NotificationService.instance.cancelId(
          HermesNotificationIds.notificationIdFor(job.id),
        );
      }
      return;
    }
    if (jobs.isEmpty) return;
    // Phase 2 schedules OS slots from job defs.
  }

  static NotificationPayload payloadForJob(String jobId) =>
      NotificationPayload.agentTask(taskId: HermesNotificationIds.taskIdForJob(jobId));
}

/// Shared channel helper so tests can assert we never steal reminder id 900.
int get kReminderSummaryNotificationId => 900;
