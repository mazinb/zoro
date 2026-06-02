part of 'app_model.dart';

// Notification / reminder scheduling is intentionally isolated here to make
// `AppModel` less monolithic while preserving existing behavior.

extension AppModelNotifications on AppModel {
  /// When the gate is open and there's an eligible domain, posts one rotation
  /// push and persists state synchronously.
  ///
  /// Returns the domain that fired, or `null` when nothing was posted.
  Future<ReminderDomain?> maybePostDailyReminder({DateTime? now}) async {
    final n = now ?? DateTime.now();
    if (!canFireDailyReminderNow(now: n)) return null;
    final pending = remindersPendingDomain;
    final domain = (pending != null && isReminderNotifiable(pending, now: n))
        ? pending
        : nextRotationDomain(now: n);
    if (domain == null) return null;
    try {
      await NotificationService.instance.postReminderForDomain(domain);
    } catch (_) {
      return null;
    }
    recordDailyReminderFired(domain, at: n);
    await persistAppStateToDisk();
    try {
      await _scheduleNextReminderSlot();
    } catch (_) {}
    notifyUi();
    return domain;
  }

  /// Pushes the current notification configuration to the OS.
  ///
  /// Best-effort; failures are swallowed so UI flows stay responsive.
  Future<void> syncNotifications() async {
    try {
      final svc = NotificationService.instance;
      if (!notificationsEnabled) {
        await svc.cancelAll();
        remindersScheduledFireOn = null;
        remindersPendingDomain = null;
        return;
      }
      await _scheduleNextReminderSlot();
    } catch (e, st) {
      developer.log(
        'sync failed',
        name: 'ZoroNotif',
        error: e,
        stackTrace: st,
        level: 1000,
      );
    }
  }

  /// Re-syncs OS alarms from persisted prefs, then runs the Dart fallback when
  /// today's slot has passed. Call after bootstrap and on resume — never before
  /// disk state is loaded (doing so cancels all alarms with defaults).
  Future<void> reconcileNotifications() async {
    try {
      await NotificationService.instance.init();
    } catch (e, st) {
      developer.log(
        'reconcile init failed',
        name: 'ZoroNotif',
        error: e,
        stackTrace: st,
        level: 1000,
      );
      return;
    }
    await syncNotifications();
    await maybePostDailyReminder();
    _maybeFireGoalTimeMilestones();
  }

  /// Cancels any current reminder schedule, commits past pending fires into the
  /// rotation cursor, and schedules a new OS one-shot for the upcoming notify
  /// slot with the next rotation domain's content.
  ///
  /// Persists to disk before returning.
  Future<void> _scheduleNextReminderSlot() async {
    final svc = NotificationService.instance;
    final now = DateTime.now();

    // A past OS slot with no "fired today" record means delivery may have failed.
    // Clear the schedule marker so Dart fallback can post, but keep
    // [remindersPendingDomain] so catch-up targets the right domain.
    final pending = remindersScheduledFireOn;
    if (pending != null) {
      final fireMoment = DateTime(
        pending.year,
        pending.month,
        pending.day,
        reminderNotifyHour,
        reminderNotifyMinute,
      );
      if (!now.isBefore(fireMoment)) {
        final alreadyFiredToday =
            remindersLastFiredOn != null && AppModel._isSameLocalDay(remindersLastFiredOn!, now);
        remindersScheduledFireOn = null;
        if (alreadyFiredToday) {
          remindersPendingDomain = null;
        }
        // else: keep [remindersPendingDomain] for [maybePostDailyReminder] catch-up
        // and fall through to schedule the next OS slot (do not return early).
      }
    }

    final todaySlot = DateTime(
      now.year,
      now.month,
      now.day,
      reminderNotifyHour,
      reminderNotifyMinute,
    );
    final nextSlot = now.isBefore(todaySlot) ? todaySlot : todaySlot.add(const Duration(days: 1));

    // Prefer overdue domains for copy + rotation; fall back to any schedulable
    // domain so the user's notify time always registers an OS alarm.
    final overdueDomain = nextRotationDomain(now: nextSlot);
    final schedulableDomain = nextSchedulableRotationDomain();
    final domain = overdueDomain ?? schedulableDomain;

    await svc.cancelReminderSlot();

    if (domain == null) {
      // New users (onboarding false) and caught-up users still get an OS alarm.
      await svc.scheduleDailyCheckInAt(when: nextSlot);
      remindersScheduledFireOn = DateTime(nextSlot.year, nextSlot.month, nextSlot.day);
      remindersPendingDomain = null;
      await persistAppStateToDisk();
      return;
    }

    await svc.scheduleReminderForDomainAt(domain: domain, when: nextSlot);
    remindersScheduledFireOn = DateTime(nextSlot.year, nextSlot.month, nextSlot.day);
    remindersPendingDomain = domain;
    await persistAppStateToDisk();
  }
}

