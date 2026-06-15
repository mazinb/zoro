import 'dart:async';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../state/app_model.dart';
import 'notification_payload.dart';

void _log(String message) {
  developer.log(message, name: 'ZoroNotif');
}

void _logError(String message, [Object? error, StackTrace? stack]) {
  developer.log(
    message,
    name: 'ZoroNotif',
    error: error,
    stackTrace: stack,
    level: 1000,
  );
}

/// Single channel id reused for both agent-task pings and reminder summaries.
const String _channelId = 'zoro_default_channel';
const String _channelName = 'Zoro';
const String _channelDescription = 'Stale-data reminders and check-ins';

/// Reserved notification id for rotation / check-in reminders.
const int _reminderSummaryId = 900;

/// Wraps `flutter_local_notifications` with Zoro-specific schedule helpers.
class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  bool _initSucceeded = false;
  bool _tzReady = false;
  Future<void>? _initFuture;

  bool get isReady => _initSucceeded;

  /// Last payload from a notification tap that arrived while the app wasn't
  /// listening yet (e.g. cold launch). Consumed by [consumeLaunchPayload].
  NotificationPayload? _pendingLaunchPayload;

  final StreamController<NotificationPayload> _taps =
      StreamController<NotificationPayload>.broadcast();

  /// Fires for each foreground tap. Hot stream — pre-launch taps are stored
  /// separately and exposed via [consumeLaunchPayload].
  Stream<NotificationPayload> get onTap => _taps.stream;

  /// Maps the device wall clock to a tz database [Location] without a platform
  /// channel — `zonedSchedule` needs [tz.local] aligned with [DateTime.now].
  void _ensureTimezone() {
    if (_tzReady) return;
    tzdata.initializeTimeZones();
    final offsetMs = DateTime.now().timeZoneOffset.inMilliseconds;
    tz.Location? match;
    for (final loc in tz.timeZoneDatabase.locations.values) {
      if (loc.currentTimeZone.offset == offsetMs) {
        match = loc;
        break;
      }
    }
    tz.setLocalLocation(match ?? tz.UTC);
    _tzReady = true;
  }

  /// Idempotent. Retries until the platform channel exists (UIScene engines
  /// register plugins after [main]). Unit tests get a single attempt.
  Future<void> init() async {
    if (_initSucceeded) return;
    final maxAttempts = Platform.environment.containsKey('FLUTTER_TEST') ? 1 : 12;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await (_initFuture ??= _initImpl());
        if (_initSucceeded) return;
      } catch (e, st) {
        _initFuture = null;
        if (attempt == maxAttempts - 1) {
          _logError('init failed after $maxAttempts attempts', e, st);
          rethrow;
        }
        await Future<void>.delayed(Duration(milliseconds: 80 * (attempt + 1)));
      }
    }
  }

  Future<void> _initImpl() async {
    _ensureTimezone();
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const init = InitializationSettings(android: androidInit, iOS: iosInit);
    await _plugin.initialize(
      init,
      onDidReceiveNotificationResponse: _onResponse,
      onDidReceiveBackgroundNotificationResponse: _onBackgroundResponse,
    );

    // Capture taps that launched the app from a terminated state.
    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch != null && launch.didNotificationLaunchApp) {
      final response = launch.notificationResponse;
      final payload = NotificationPayload.tryDecode(response?.payload);
      if (payload != null) {
        _pendingLaunchPayload = payload;
      }
    }

    // Create the Android channel up front (no-op on iOS).
    if (!kIsWeb && Platform.isAndroid) {
      final androidPlugin = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(
        const AndroidNotificationChannel(
          _channelId,
          _channelName,
          description: _channelDescription,
          importance: Importance.defaultImportance,
        ),
      );
    }
    _initSucceeded = true;
    _log('init done');
  }

  /// True when alerts are allowed. Does not prompt.
  Future<bool> isAuthorized() async {
    await init();
    if (kIsWeb) return false;
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      final r = await ios?.checkPermissions();
      return r?.isEnabled ?? false;
    }
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      return await android?.areNotificationsEnabled() ?? false;
    }
    return false;
  }

  /// Asks the OS for permission. Returns true when the user grants it (or it
  /// was already granted). Safe to call multiple times.
  Future<bool> requestPermission() async {
    await init();
    if (await isAuthorized()) return true;
    if (kIsWeb) return false;
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      if (ios == null) return false;
      final granted = await ios.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      return await android?.requestNotificationsPermission() ?? false;
    }
    return false;
  }

  /// Coarse OS status from [checkPermissions]. On iOS, `isEnabled` is false for
  /// both notDetermined and denied — do not use this to skip [requestPermission].
  Future<NotificationAuthStatus> currentAuthStatus() async {
    await init();
    if (kIsWeb) return NotificationAuthStatus.unsupported;
    try {
      if (Platform.isIOS) {
        final ios = _plugin.resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>();
        if (ios == null) return NotificationAuthStatus.unsupported;
        final r = await ios.checkPermissions();
        if (r == null) return NotificationAuthStatus.unknown;
        if (r.isEnabled || r.isProvisionalEnabled) {
          return NotificationAuthStatus.authorized;
        }
        // Cannot distinguish notDetermined vs denied from this API alone.
        return NotificationAuthStatus.unknown;
      }
      if (Platform.isAndroid) {
        final android = _plugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
        final enabled = await android?.areNotificationsEnabled() ?? false;
        return enabled
            ? NotificationAuthStatus.authorized
            : NotificationAuthStatus.denied;
      }
    } catch (_) {
      return NotificationAuthStatus.unsupported;
    }
    return NotificationAuthStatus.unsupported;
  }

  /// Returns and clears any payload that launched the app from a terminated
  /// state. Designed to be called once by `MainScaffold` on first frame.
  NotificationPayload? consumeLaunchPayload() {
    final p = _pendingLaunchPayload;
    _pendingLaunchPayload = null;
    return p;
  }

  /// Cancels the rotation reminder slot, if any. Safe to call when nothing
  /// is scheduled.
  Future<void> cancelReminderSlot() async {
    await init();
    await _plugin.cancel(_reminderSummaryId);
  }

  /// Android skips OS alarm scheduling (Play exact-alarm policy). Reminders fire when
  /// the app opens/resumes via [AppModel.maybePostDailyReminder]. iOS uses zonedSchedule.
  Future<void> scheduleDailyCheckInAt({required DateTime when}) async {
    await init();
    await _plugin.cancel(_reminderSummaryId);
    if (Platform.isAndroid) {
      _log('Android: deferred reminder until app open (no alarm schedule)');
      return;
    }
    final tzWhen = tz.TZDateTime.from(when, tz.local);
    const payload = '{"kind":"reminder","domain":"expenses"}';
    await _plugin.zonedSchedule(
      _reminderSummaryId,
      'Zoro',
      'Time for your regular check-in.',
      tzWhen,
      _defaultDetails(),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: payload,
    );
    _log('check-in @ $when');
  }

  /// Schedules a one-shot OS local notification at [when] (local time) with
  /// per-domain content + a reminder payload deep-linking into [domain].
  /// iOS: local notification at [when] even if the app is not running.
  /// Android: persisted slot only — notification when app next opens if overdue.
  ///
  /// Calling this with a different [domain]/[when] supersedes any previous
  /// schedule on the same id (`_reminderSummaryId`).
  Future<void> scheduleReminderForDomainAt({
    required ReminderDomain domain,
    required DateTime when,
  }) async {
    await init();
    await _plugin.cancel(_reminderSummaryId);
    if (Platform.isAndroid) {
      _log('Android: deferred $domain reminder until app open (no alarm schedule)');
      return;
    }
    final tzWhen = tz.TZDateTime.from(when, tz.local);
    final payload = NotificationPayload.reminder(domain: domain).encode();
    try {
      await _plugin.zonedSchedule(
        _reminderSummaryId,
        _reminderTitleFor(domain),
        _reminderBodyFor(domain),
        tzWhen,
        _defaultDetails(),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        payload: payload,
      );
      _log('reminder $domain @ $when');
    } catch (e, st) {
      _logError('zonedSchedule failed ($domain)', e, st);
      rethrow;
    }
  }

  /// Immediate-fire fallback used by `AppModel.maybePostDailyReminder` when
  /// the OS-scheduled slot isn't an option (e.g. scheduling failed). Re-uses
  /// `_reminderSummaryId` so a stale schedule is superseded.
  Future<void> postReminderForDomain(ReminderDomain domain) async {
    await init();
    final payload = NotificationPayload.reminder(domain: domain).encode();
    await _plugin.show(
      _reminderSummaryId,
      _reminderTitleFor(domain),
      _reminderBodyFor(domain),
      _defaultDetails(),
      payload: payload,
    );
  }

  /// Cancels every notification we've scheduled. Useful when the master
  /// switch is turned off.
  Future<void> cancelAll() async {
    await init();
    await _plugin.cancelAll();
  }

  NotificationDetails _defaultDetails() {
    return NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
      ),
      iOS: const DarwinNotificationDetails(
        // pre-iOS 14
        presentAlert: true,
        // iOS 14+: explicitly opt in to foreground banner + Notification Center
        presentBanner: true,
        presentList: true,
        presentBadge: false,
        presentSound: true,
        interruptionLevel: InterruptionLevel.active,
      ),
    );
  }

  void _onResponse(NotificationResponse response) {
    final payload = NotificationPayload.tryDecode(response.payload);
    if (payload == null) return;
    _taps.add(payload);
  }

  // Must be a top-level/static handler for background dispatch.
  static void _onBackgroundResponse(NotificationResponse response) {
    final suffix = kReleaseMode ? '' : ' payload=${response.payload}';
    _log('background tap$suffix');
  }

  static String _reminderTitleFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => 'Expenses need a refresh',
        ReminderDomain.cashflow => 'Cash flow needs a refresh',
        ReminderDomain.income => 'Income needs a refresh',
        ReminderDomain.assets => 'Assets need a refresh',
        ReminderDomain.liabilities => 'Liabilities need a refresh',
        ReminderDomain.goals => 'Goals need a check-in',
      };

  static String _reminderBodyFor(ReminderDomain d) => switch (d) {
        ReminderDomain.expenses => 'Tap to update your expense estimates.',
        ReminderDomain.cashflow => 'A new month is here — log your latest cash flow.',
        ReminderDomain.income => 'Confirm your income lines are still accurate.',
        ReminderDomain.assets => 'Take a moment to refresh your asset balances.',
        ReminderDomain.liabilities => 'Update your liability balances.',
        ReminderDomain.goals => 'Tap to open Goals helper and review your plan.',
      };

  static const int _goalMilestoneNotificationId = 901;
  static const int _homeMessageNotificationId = 902;

  /// Fires when the daily Home summary helper has a new note ready.
  Future<void> showHomeMessageReady({required String taskId}) async {
    await init();
    final payload = NotificationPayload.agentTask(taskId: taskId).encode();
    await _plugin.show(
      _homeMessageNotificationId,
      'Zoro',
      'Your Home note is ready.',
      _defaultDetails(),
      payload: payload,
    );
    _log('home message ready ($taskId)');
  }

  /// One-shot milestone (50% / 75% timeline) — separate id from rotation reminders.
  Future<void> showGoalProgressMilestone({
    required String title,
    required String body,
  }) async {
    await init();
    await _plugin.show(
      _goalMilestoneNotificationId,
      'Goal progress — $title',
      body,
      _defaultDetails(),
    );
    _log('goal milestone: $title');
  }
}

/// Top-level background response handler annotation for the plugin.
@pragma('vm:entry-point')
void zoroBackgroundNotificationResponse(NotificationResponse response) {
  // Background taps for action buttons; the foreground stream re-emits when
  // the app comes back. Body intentionally minimal.
  final suffix = kReleaseMode ? '' : ' payload=${response.payload}';
  developer.log('bg response$suffix', name: 'ZoroNotif');
}

/// Coarse status surfaced to the Settings UI.
enum NotificationAuthStatus {
  authorized,
  denied,
  unknown,
  unsupported,
}
