import 'dart:convert';

/// How often a scheduled agent run fires (local time: [hour] / [minute]).
enum ScheduleRecurrenceKind {
  daily,
  weekly,
  monthly,
  yearly,
}

/// Persisted scheduled run for a user [AppAgent].
class ScheduledAgentTask {
  ScheduledAgentTask({
    required this.id,
    required this.name,
    required this.enabled,
    required this.agentId,
    required this.runUserMessage,
    required this.recurrence,
    required this.hour,
    required this.minute,
    required this.weeklyWeekdays,
    required this.monthlyDay,
    required this.yearlyMonth,
    required this.yearlyDay,
    this.lastRunAt,
    this.lastError,
  });

  String id;
  String name;
  bool enabled;
  String agentId;
  String runUserMessage;
  ScheduleRecurrenceKind recurrence;
  /// Local hour 0–23
  int hour;
  /// Local minute 0–59
  int minute;
  /// Weekdays when [recurrence] is weekly: `DateTime.monday` … `DateTime.sunday` (1–7).
  List<int> weeklyWeekdays;
  /// Day of month for monthly (1–28) and yearly templates.
  int monthlyDay;
  int yearlyMonth;
  int yearlyDay;
  DateTime? lastRunAt;
  String? lastError;

  ScheduledAgentTask clone() => ScheduledAgentTask(
        id: id,
        name: name,
        enabled: enabled,
        agentId: agentId,
        runUserMessage: runUserMessage,
        recurrence: recurrence,
        hour: hour,
        minute: minute,
        weeklyWeekdays: [...weeklyWeekdays],
        monthlyDay: monthlyDay,
        yearlyMonth: yearlyMonth,
        yearlyDay: yearlyDay,
        lastRunAt: lastRunAt,
        lastError: lastError,
      );

  static ScheduledAgentTask? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final m = Map<String, dynamic>.from(raw);
    final id = m['id']?.toString();
    final agentId = m['agentId']?.toString();
    if (id == null || agentId == null) return null;
    final recStr = m['recurrence']?.toString();
    var recurrence = ScheduleRecurrenceKind.daily;
    for (final v in ScheduleRecurrenceKind.values) {
      if (v.name == recStr) {
        recurrence = v;
        break;
      }
    }
    final wd = m['weeklyWeekdays'];
    final weekdays = <int>[];
    if (wd is List) {
      for (final x in wd) {
        if (x is int) weekdays.add(x.clamp(1, 7));
        if (x is num) weekdays.add(x.round().clamp(1, 7));
      }
    }
    if (weekdays.isEmpty) weekdays.addAll([1, 2, 3, 4, 5, 6, 7]);
    DateTime? lastRun;
    final lr = m['lastRunAtMs'];
    if (lr is int) {
      lastRun = DateTime.fromMillisecondsSinceEpoch(lr, isUtc: true);
    } else if (lr is num) {
      lastRun = DateTime.fromMillisecondsSinceEpoch(lr.round(), isUtc: true);
    }
    return ScheduledAgentTask(
      id: id,
      name: m['name']?.toString() ?? 'Scheduled agent',
      enabled: m['enabled'] == true,
      agentId: agentId,
      runUserMessage: m['runUserMessage']?.toString() ?? '',
      recurrence: recurrence,
      hour: (m['hour'] is int ? m['hour'] as int : (m['hour'] is num ? (m['hour'] as num).round() : 7)).clamp(0, 23),
      minute: (m['minute'] is int ? m['minute'] as int : (m['minute'] is num ? (m['minute'] as num).round() : 30)).clamp(0, 59),
      weeklyWeekdays: weekdays,
      monthlyDay: (m['monthlyDay'] is int ? m['monthlyDay'] as int : 1).clamp(1, 28),
      yearlyMonth: (m['yearlyMonth'] is int ? m['yearlyMonth'] as int : 1).clamp(1, 12),
      yearlyDay: (m['yearlyDay'] is int ? m['yearlyDay'] as int : 1).clamp(1, 28),
      lastRunAt: lastRun,
      lastError: m['lastError']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'enabled': enabled,
        'agentId': agentId,
        'runUserMessage': runUserMessage,
        'recurrence': recurrence.name,
        'hour': hour,
        'minute': minute,
        'weeklyWeekdays': weeklyWeekdays,
        'monthlyDay': monthlyDay,
        'yearlyMonth': yearlyMonth,
        'yearlyDay': yearlyDay,
        if (lastRunAt != null) 'lastRunAtMs': lastRunAt!.toUtc().millisecondsSinceEpoch,
        if (lastError != null && lastError!.trim().isNotEmpty) 'lastError': lastError,
      };

  static ScheduledAgentTask defaultMorningBriefing({required String agentId}) {
    return ScheduledAgentTask(
      id: 'sched-default-morning',
      name: 'Morning briefing',
      enabled: false,
      agentId: agentId,
      runUserMessage:
          'Generate today\'s briefing: a short portfolio snapshot from attached context, 2–4 lines on general market themes '
          '(no fabricated headlines), and a calm tone. When done, update the Home summary with the result using the home_summary action.',
      recurrence: ScheduleRecurrenceKind.daily,
      hour: 7,
      minute: 30,
      weeklyWeekdays: [1, 2, 3, 4, 5, 6, 7],
      monthlyDay: 1,
      yearlyMonth: 1,
      yearlyDay: 1,
    );
  }
}

/// Next local DateTime at [hour]:[minute] on or after [notBefore] that satisfies recurrence.
DateTime computeNextRunLocal(
  ScheduledAgentTask t, {
  required DateTime notBefore,
}) {
  final start = notBefore.toLocal();
  var day = DateTime(start.year, start.month, start.day);
  for (var i = 0; i < 800; i++) {
    final dim = DateTime(day.year, day.month + 1, 0).day;
    final candidate = DateTime(day.year, day.month, day.day, t.hour, t.minute);
    if (!candidate.isBefore(start) && _dateMatchesRecurrence(t, day, dim)) {
      return candidate;
    }
    day = day.add(const Duration(days: 1));
  }
  return start.add(const Duration(days: 365));
}

bool _dateMatchesRecurrence(ScheduledAgentTask t, DateTime day, int daysInMonth) {
  switch (t.recurrence) {
    case ScheduleRecurrenceKind.daily:
      return true;
    case ScheduleRecurrenceKind.weekly:
      final days = t.weeklyWeekdays.isEmpty ? [1, 2, 3, 4, 5, 6, 7] : t.weeklyWeekdays;
      return days.contains(day.weekday);
    case ScheduleRecurrenceKind.monthly:
      final dom = t.monthlyDay.clamp(1, 28).clamp(1, daysInMonth);
      return day.day == dom;
    case ScheduleRecurrenceKind.yearly:
      final maxD = DateTime(day.year, t.yearlyMonth + 1, 0).day;
      final wantDay = t.yearlyDay.clamp(1, maxD);
      return day.month == t.yearlyMonth && day.day == wantDay;
  }
}

/// Whether [t] should run now (enabled and a scheduled slot is due, including same-day catch-up).
bool scheduledTaskIsDue(ScheduledAgentTask t) {
  if (!t.enabled) return false;
  final now = DateTime.now().toLocal();
  final startToday = DateTime(now.year, now.month, now.day);
  final anchor = t.lastRunAt?.toLocal().add(const Duration(seconds: 2)) ?? startToday;
  final next = computeNextRunLocal(t, notBefore: anchor);
  return !next.isAfter(now);
}

String scheduleRecurrenceLabel(ScheduleRecurrenceKind k) => switch (k) {
      ScheduleRecurrenceKind.daily => 'Daily',
      ScheduleRecurrenceKind.weekly => 'Weekly',
      ScheduleRecurrenceKind.monthly => 'Monthly',
      ScheduleRecurrenceKind.yearly => 'Yearly',
    };

String scheduleTaskSummaryLine(ScheduledAgentTask t) {
  final h = t.hour.toString().padLeft(2, '0');
  final m = t.minute.toString().padLeft(2, '0');
  final time = '$h:$m';
  return switch (t.recurrence) {
    ScheduleRecurrenceKind.daily => 'Daily at $time',
    ScheduleRecurrenceKind.weekly => 'Weekly (${t.weeklyWeekdays.length} days) at $time',
    ScheduleRecurrenceKind.monthly => 'Monthly (day ${t.monthlyDay}) at $time',
    ScheduleRecurrenceKind.yearly => 'Yearly (${t.yearlyMonth}/${t.yearlyDay}) at $time',
  };
}

String encodeScheduledAgentTasksJson(List<ScheduledAgentTask> tasks) {
  return const JsonEncoder.withIndent('  ').convert({
    'version': 1,
    'tasks': tasks.map((e) => e.toJson()).toList(),
  });
}

List<ScheduledAgentTask> decodeScheduledAgentTasksJson(String text) {
  final decoded = jsonDecode(text);
  if (decoded is! Map) return [];
  final root = Map<String, dynamic>.from(decoded);
  if (root['version'] != 1) return [];
  final list = root['tasks'];
  if (list is! List) return [];
  final out = <ScheduledAgentTask>[];
  for (final e in list) {
    final t = ScheduledAgentTask.fromJson(e);
    if (t != null) out.add(t);
  }
  return out;
}
