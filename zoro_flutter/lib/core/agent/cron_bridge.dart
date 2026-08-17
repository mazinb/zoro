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

  static bool isHermesTask(String? taskId) =>
      (taskId ?? '').startsWith(taskPrefix);

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
    this.nextAt,
  });

  final String id;
  final String title;
  final String schedule;
  final String skillId;
  final String prompt;
  final DateTime? nextAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'schedule': schedule,
    'skillId': skillId,
    'prompt': prompt,
    if (nextAt != null) 'nextAt': nextAt!.toUtc().toIso8601String(),
  };

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
        nextAt: DateTime.tryParse(raw['nextAt']?.toString() ?? ''),
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

  File _jobFile(String id) {
    final safe = id.replaceAll(RegExp(r'[^a-zA-Z0-9_.\-]'), '_');
    return File('${_dir.path}/$safe.json');
  }

  Future<void> upsert(CronJobDef job) async {
    await _dir.create(recursive: true);
    await _jobFile(job.id).writeAsString(
      const JsonEncoder.withIndent('  ').convert(job.toJson()),
      flush: true,
    );
  }

  Future<void> remove(String id) async {
    final f = _jobFile(id);
    if (await f.exists()) await f.delete();
    await NotificationService.instance.cancelId(
      HermesNotificationIds.notificationIdFor(id),
    );
  }

  /// Cancels or schedules Hermes notification ids from job defs.
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
    final now = DateTime.now();
    for (final job in jobs) {
      final when = job.nextAt?.toLocal();
      if (when == null) continue;
      if (!when.isAfter(now)) {
        await NotificationService.instance.showAgentJob(
          id: HermesNotificationIds.notificationIdFor(job.id),
          title: job.title,
          body: job.prompt.isEmpty ? 'Agent job is due.' : job.prompt,
          taskId: HermesNotificationIds.taskIdForJob(job.id),
        );
      } else {
        await NotificationService.instance.scheduleAgentJob(
          id: HermesNotificationIds.notificationIdFor(job.id),
          title: job.title,
          body: job.prompt.isEmpty ? 'Agent job is due.' : job.prompt,
          when: when,
          taskId: HermesNotificationIds.taskIdForJob(job.id),
        );
      }
    }
  }

  Future<List<CronJobDef>> dueJobs({DateTime? now}) async {
    final n = now ?? DateTime.now();
    return [
      for (final j in await listJobs())
        if (j.nextAt != null && !j.nextAt!.toLocal().isAfter(n)) j,
    ];
  }

  static NotificationPayload payloadForJob(String jobId) =>
      NotificationPayload.agentTask(
        taskId: HermesNotificationIds.taskIdForJob(jobId),
      );
}

/// Shared channel helper so tests can assert we never steal reminder id 900.
int get kReminderSummaryNotificationId => 900;
