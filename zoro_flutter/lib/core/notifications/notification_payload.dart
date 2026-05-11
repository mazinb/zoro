import 'dart:convert';

import '../state/app_model.dart';

/// Compact payload encoded into [NotificationResponse.payload] so taps can
/// deep-link without us having to scan the app state.
class NotificationPayload {
  const NotificationPayload.agentTask({required this.taskId})
      : kind = NotificationKind.agentTask,
        domain = null;

  const NotificationPayload.reminder({required this.domain})
      : kind = NotificationKind.reminder,
        taskId = null;

  const NotificationPayload._({
    required this.kind,
    this.taskId,
    this.domain,
  });

  final NotificationKind kind;
  final String? taskId;
  final ReminderDomain? domain;

  String encode() => jsonEncode({
        'kind': kind.name,
        if (taskId != null) 'taskId': taskId,
        if (domain != null) 'domain': domain!.name,
      });

  static NotificationPayload? tryDecode(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final m = jsonDecode(raw);
      if (m is! Map) return null;
      final kindStr = m['kind']?.toString();
      final kind = _enumByName(NotificationKind.values, kindStr);
      if (kind == null) return null;
      switch (kind) {
        case NotificationKind.agentTask:
          final id = m['taskId']?.toString();
          if (id == null || id.isEmpty) return null;
          return NotificationPayload._(kind: kind, taskId: id);
        case NotificationKind.reminder:
          final domain = _enumByName(ReminderDomain.values, m['domain']?.toString());
          if (domain == null) return null;
          return NotificationPayload._(kind: kind, domain: domain);
      }
    } catch (_) {
      return null;
    }
  }
}

T? _enumByName<T extends Enum>(List<T> values, String? name) {
  if (name == null || name.isEmpty) return null;
  for (final v in values) {
    if (v.name == name) return v;
  }
  return null;
}

enum NotificationKind { agentTask, reminder }
