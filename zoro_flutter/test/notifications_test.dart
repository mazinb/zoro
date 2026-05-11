import 'package:flutter_test/flutter_test.dart';
import 'package:zoro_flutter/core/notifications/notification_payload.dart';
import 'package:zoro_flutter/core/state/app_model.dart';
import 'package:zoro_flutter/core/state/scheduled_agent_task.dart';

void main() {
  group('NotificationPayload', () {
    test('encodes/decodes agent task payloads', () {
      final original = const NotificationPayload.agentTask(taskId: 'sched-abc');
      final encoded = original.encode();
      final decoded = NotificationPayload.tryDecode(encoded);
      expect(decoded, isNotNull);
      expect(decoded!.kind, NotificationKind.agentTask);
      expect(decoded.taskId, 'sched-abc');
      expect(decoded.domain, isNull);
    });

    test('encodes/decodes reminder payloads for every domain', () {
      for (final d in ReminderDomain.values) {
        final encoded = NotificationPayload.reminder(domain: d).encode();
        final decoded = NotificationPayload.tryDecode(encoded);
        expect(decoded, isNotNull, reason: 'domain $d');
        expect(decoded!.kind, NotificationKind.reminder);
        expect(decoded.domain, d);
      }
    });

    test('rejects malformed payloads', () {
      expect(NotificationPayload.tryDecode(null), isNull);
      expect(NotificationPayload.tryDecode(''), isNull);
      expect(NotificationPayload.tryDecode('not json'), isNull);
      expect(NotificationPayload.tryDecode('{"kind":"unknown"}'), isNull);
      expect(NotificationPayload.tryDecode('{"kind":"agentTask"}'), isNull); // missing taskId
      expect(NotificationPayload.tryDecode('{"kind":"reminder","domain":"nope"}'), isNull);
    });
  });

  group('ScheduledAgentTask.notify JSON round-trip', () {
    test('preserves notify across encode/decode', () {
      final t = ScheduledAgentTask(
        id: 'sched-1',
        name: 'Morning brief',
        enabled: true,
        agentId: 'agent-morning-briefing',
        runUserMessage: 'run',
        recurrence: ScheduleRecurrenceKind.daily,
        hour: 7,
        minute: 30,
        weeklyWeekdays: const [1, 2, 3, 4, 5],
        monthlyDay: 1,
        yearlyMonth: 1,
        yearlyDay: 1,
        notify: true,
      );
      final json = encodeScheduledAgentTasksJson([t]);
      final decoded = decodeScheduledAgentTasksJson(json);
      expect(decoded, hasLength(1));
      expect(decoded.first.notify, isTrue);
    });

    test('defaults notify to false when the field is missing (legacy JSON)', () {
      const legacy = '''
{"version":1,"tasks":[{"id":"sched-old","name":"Legacy","enabled":true,
"agentId":"agent-morning-briefing","runUserMessage":"","recurrence":"daily",
"hour":9,"minute":0,"weeklyWeekdays":[1,2,3,4,5,6,7],"monthlyDay":1,
"yearlyMonth":1,"yearlyDay":1}]}''';
      final decoded = decodeScheduledAgentTasksJson(legacy);
      expect(decoded, hasLength(1));
      expect(decoded.first.notify, isFalse);
    });
  });

  group('AppModel.isReminderNotifiable (onboarding spam guard)', () {
    test('fresh install yields zero notifications even with cadences set', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.remindersExpensesCadence = ReminderCadence.monthly;
      m.remindersCashflowCadence = ReminderCadence.monthly;
      m.remindersIncomeCadence = ReminderCadence.monthly;
      m.remindersAssetsCadence = ReminderCadence.monthly;
      m.remindersLiabilitiesCadence = ReminderCadence.monthly;
      // Far-future `now` so the cadence math would otherwise say "overdue".
      final now = DateTime(2030, 6, 15);
      expect(m.notifiableReminderDomains(now: now), isEmpty);
      for (final d in ReminderDomain.values) {
        expect(
          m.isReminderNotifiable(d, now: now),
          isFalse,
          reason: 'domain $d should NOT notify on a fresh install',
        );
      }
    });

    test('master switch off blocks every domain', () {
      final m = AppModel();
      m.notificationsEnabled = false;
      m.userTouchedExpenses = true;
      m.expenseEstimatesLastUpdated = DateTime(2020, 1, 1);
      m.remindersExpensesCadence = ReminderCadence.monthly;
      expect(m.isReminderNotifiable(ReminderDomain.expenses, now: DateTime(2030, 6, 15)), isFalse);
    });

    test('cadence Off silences a specific domain', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.userTouchedExpenses = true;
      m.expenseEstimatesLastUpdated = DateTime(2020, 1, 1);
      m.remindersExpensesCadence = ReminderCadence.off;
      expect(m.isReminderNotifiable(ReminderDomain.expenses, now: DateTime(2030, 6, 15)), isFalse);
    });

    test('domain becomes notifiable once the user touches it and time passes', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.remindersExpensesCadence = ReminderCadence.monthly;
      final now = DateTime(2030, 6, 15);
      // Brand-new: untouched.
      expect(m.isReminderNotifiable(ReminderDomain.expenses, now: now), isFalse);
      // User edits an expense (mutation method sets userTouchedExpenses + last).
      m.markExpenseEstimatesUpdated();
      // Same day — not yet overdue.
      expect(m.isReminderNotifiable(ReminderDomain.expenses, now: DateTime.now()), isFalse);
      // Roll the clock forward past the next monthly anchor.
      m.expenseEstimatesLastUpdated = DateTime(2030, 4, 10);
      expect(m.isReminderNotifiable(ReminderDomain.expenses, now: now), isTrue);
    });

    test('dismiss back-off prevents re-buzz within the same cadence period', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.remindersAssetsCadence = ReminderCadence.monthly;
      m.userTouchedAssets = true;
      m.assetsLastReviewed = DateTime(2030, 4, 10);
      final now = DateTime(2030, 6, 15);
      expect(m.isReminderNotifiable(ReminderDomain.assets, now: now), isTrue);
      m.markDomainNotified(ReminderDomain.assets, at: DateTime(2030, 6, 14));
      expect(m.isReminderNotifiable(ReminderDomain.assets, now: now), isFalse);
      // Next month — back to eligible.
      expect(m.isReminderNotifiable(ReminderDomain.assets, now: DateTime(2030, 7, 2)), isTrue);
    });

    test('cashflow gates on imported months rather than userTouched', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.remindersCashflowCadence = ReminderCadence.monthly;
      final now = DateTime(2030, 6, 15);
      // No months imported yet → never overdue for notifications.
      expect(m.isReminderNotifiable(ReminderDomain.cashflow, now: now), isFalse);
    });
  });
}
