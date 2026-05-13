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

    test('cashflow gates on imported months rather than userTouched', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.remindersCashflowCadence = ReminderCadence.monthly;
      final now = DateTime(2030, 6, 15);
      // No months imported yet → never overdue for notifications.
      expect(m.isReminderNotifiable(ReminderDomain.cashflow, now: now), isFalse);
    });
  });

  group('AppModel daily rotation gate', () {
    AppModel modelWithEligible({required Iterable<ReminderDomain> domains}) {
      final m = AppModel();
      m.notificationsEnabled = true;
      m.reminderNotifyHour = 9;
      m.reminderNotifyMinute = 0;
      for (final d in domains) {
        switch (d) {
          case ReminderDomain.expenses:
            m.remindersExpensesCadence = ReminderCadence.monthly;
            m.userTouchedExpenses = true;
            m.expenseEstimatesLastUpdated = DateTime(2030, 1, 1);
          case ReminderDomain.cashflow:
            // Cashflow eligibility relies on imported months, which require
            // populating MonthlyCashflowEntry. Skip for the rotation tests.
            throw UnsupportedError('cashflow not used in rotation tests');
          case ReminderDomain.income:
            m.remindersIncomeCadence = ReminderCadence.monthly;
            m.userTouchedIncome = true;
            m.incomeLastUpdated = DateTime(2030, 1, 1);
          case ReminderDomain.assets:
            m.remindersAssetsCadence = ReminderCadence.monthly;
            m.userTouchedAssets = true;
            m.assetsLastReviewed = DateTime(2030, 1, 1);
          case ReminderDomain.liabilities:
            m.remindersLiabilitiesCadence = ReminderCadence.monthly;
            m.userTouchedLiabilities = true;
            m.liabilitiesLastReviewed = DateTime(2030, 1, 1);
        }
      }
      return m;
    }

    test('canFireDailyReminderNow honors the notify hour and master switch', () {
      final m = modelWithEligible(domains: {ReminderDomain.expenses});
      final today = DateTime(2030, 6, 15);
      // Before 09:00 → gate closed.
      expect(m.canFireDailyReminderNow(now: DateTime(2030, 6, 15, 8, 59)), isFalse);
      // 09:00 sharp → gate opens.
      expect(m.canFireDailyReminderNow(now: DateTime(2030, 6, 15, 9, 0)), isTrue);
      // Master switch closes the gate.
      m.notificationsEnabled = false;
      expect(m.canFireDailyReminderNow(now: today.add(const Duration(hours: 10))), isFalse);
    });

    test('blocks a second fire on the same day even with eligible domains', () {
      final m = modelWithEligible(domains: {ReminderDomain.expenses, ReminderDomain.assets});
      final at = DateTime(2030, 6, 15, 9, 5);
      expect(m.canFireDailyReminderNow(now: at), isTrue);
      m.recordDailyReminderFired(ReminderDomain.expenses, at: at);
      expect(m.canFireDailyReminderNow(now: DateTime(2030, 6, 15, 23, 59)), isFalse);
    });

    test('rotates to the next eligible domain after midnight', () {
      final m = modelWithEligible(
        domains: {ReminderDomain.expenses, ReminderDomain.income, ReminderDomain.assets},
      );
      final day1 = DateTime(2030, 6, 15, 9, 5);
      // First fire picks the first eligible (Expenses is first in ReminderDomain.values).
      final first = m.nextRotationDomain(now: day1);
      expect(first, ReminderDomain.expenses);
      m.recordDailyReminderFired(first!, at: day1);

      // Next day → cycles to the next eligible (Cashflow is not eligible, so Income).
      final day2 = DateTime(2030, 6, 16, 9, 5);
      expect(m.canFireDailyReminderNow(now: day2), isTrue);
      final second = m.nextRotationDomain(now: day2);
      expect(second, ReminderDomain.income);
      m.recordDailyReminderFired(second!, at: day2);

      // Day 3 → Assets.
      final day3 = DateTime(2030, 6, 17, 9, 5);
      final third = m.nextRotationDomain(now: day3);
      expect(third, ReminderDomain.assets);
      m.recordDailyReminderFired(third!, at: day3);

      // Day 4 → wraps back to Expenses (skipping ineligible Cashflow/Liabilities).
      final day4 = DateTime(2030, 6, 18, 9, 5);
      expect(m.nextRotationDomain(now: day4), ReminderDomain.expenses);
    });

    test('nextRotationDomain returns null when nothing is eligible', () {
      final m = AppModel();
      m.notificationsEnabled = true;
      expect(m.nextRotationDomain(now: DateTime(2030, 6, 15, 9, 5)), isNull);
    });

    test('gate is closed while an OS-scheduled push is pending', () {
      final m = modelWithEligible(domains: {ReminderDomain.expenses});
      final at = DateTime(2030, 6, 15, 9, 5);
      expect(m.canFireDailyReminderNow(now: at), isTrue);
      // Simulate sync having scheduled the next OS push.
      m.remindersScheduledFireOn = DateTime(2030, 6, 15);
      m.remindersPendingDomain = ReminderDomain.expenses;
      expect(m.canFireDailyReminderNow(now: at), isFalse);
    });
  });
}
