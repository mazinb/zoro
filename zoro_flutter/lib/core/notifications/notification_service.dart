import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../state/app_model.dart';
import '../state/scheduled_agent_task.dart';
import 'notification_payload.dart';

void _log(String message) {
  if (kDebugMode) {
    debugPrint('[ZoroNotif] $message');
  }
}

/// Single channel id reused for both agent-task pings and reminder summaries.
const String _channelId = 'zoro_default_channel';
const String _channelName = 'Zoro';
const String _channelDescription = 'Briefings and stale-data reminders';

/// Reserved notification id ranges so per-task / per-domain rescheduling
/// doesn't collide.
const int _agentTaskIdBase = 1000; // hash(taskId) mod 10000 + base
const int _reminderSummaryId = 900;

/// Wraps `flutter_local_notifications` with Zoro-specific schedule helpers.
/// Safe to call from both the main isolate and background workmanager isolate.
class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  bool _initialized = false;
  bool _tzReady = false;

  /// Last payload from a notification tap that arrived while the app wasn't
  /// listening yet (e.g. cold launch). Consumed by [consumeLaunchPayload].
  NotificationPayload? _pendingLaunchPayload;

  final StreamController<NotificationPayload> _taps =
      StreamController<NotificationPayload>.broadcast();

  /// Fires for each foreground tap. Hot stream — pre-launch taps are stored
  /// separately and exposed via [consumeLaunchPayload].
  Stream<NotificationPayload> get onTap => _taps.stream;

  void _ensureTimezone() {
    if (_tzReady) return;
    tzdata.initializeTimeZones();
    _tzReady = true;
  }

  /// Idempotent. Call from `main()` and again from the background isolate
  /// before scheduling anything. Catches plugin-platform errors so unit tests
  /// (where `flutter_local_notifications` has no registered implementation)
  /// can render widgets that touch this service without crashing.
  Future<void> init() async {
    if (_initialized) return;
    _ensureTimezone();
    try {
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
      _log('init done');
    } catch (e) {
      // Plugin missing / platform channel unwired — most commonly a unit-test
      // environment. Subsequent calls will short-circuit harmlessly.
      _log('init skipped: $e');
    } finally {
      _initialized = true;
    }
  }

  /// Asks the OS for permission. Returns true when the user grants it (or it
  /// was already granted). Safe to call multiple times.
  Future<bool> requestPermission() async {
    await init();
    if (kIsWeb) return false;
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin>();
      if (ios == null) {
        _log('iOS plugin implementation null - registration missing');
        return false;
      }
      final granted = await ios.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      _log('iOS requestPermissions returned $granted');
      return granted ?? false;
    }
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>();
      final granted = await android?.requestNotificationsPermission();
      _log('Android permission granted=$granted');
      return granted ?? false;
    }
    return false;
  }

  /// Returns the current OS-level permission status, without prompting.
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
      final r = await android?.areNotificationsEnabled();
      return r ?? false;
    }
    return false;
  }

  /// Detailed status useful for diagnostics. `notDetermined` is the only state
  /// where iOS will actually show a prompt; `denied` / `provisional` mean iOS
  /// already remembers a choice and won't re-prompt.
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
        if (r.isEnabled) return NotificationAuthStatus.authorized;
        return NotificationAuthStatus.denied;
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

  /// (Re)schedules a single agent task notification. Cancels the previous one
  /// for this task first. No-op when the task isn't eligible (disabled,
  /// notify off, or no agent target).
  Future<void> scheduleAgentTask({
    required ScheduledAgentTask task,
    required bool masterEnabled,
  }) async {
    await init();
    await cancelAgentTask(task.id);
    if (!masterEnabled || !task.enabled || !task.notify) return;
    final when = computeNextRunLocal(task, notBefore: DateTime.now());
    if (when.isBefore(DateTime.now())) return;
    final tzWhen = tz.TZDateTime.from(when, tz.local);

    final id = _idForAgentTask(task.id);
    final title = task.name.trim().isEmpty ? 'Zoro' : task.name.trim();
    final payload = NotificationPayload.agentTask(taskId: task.id).encode();

    final matchComponents = switch (task.recurrence) {
      ScheduleRecurrenceKind.daily => DateTimeComponents.time,
      ScheduleRecurrenceKind.weekly => DateTimeComponents.dayOfWeekAndTime,
      ScheduleRecurrenceKind.monthly => DateTimeComponents.dayOfMonthAndTime,
      ScheduleRecurrenceKind.yearly => DateTimeComponents.dateAndTime,
    };

    await _plugin.zonedSchedule(
      id,
      title,
      'Briefing ready — tap to open Zoro',
      tzWhen,
      _defaultDetails(),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: payload,
      matchDateTimeComponents: matchComponents,
    );
    _log('scheduled agent task id=${task.id} at $when (match=$matchComponents)');
  }

  Future<void> cancelAgentTask(String taskId) async {
    await init();
    await _plugin.cancel(_idForAgentTask(taskId));
    _log('canceled agent task id=$taskId');
  }

  /// Schedules a daily reminder-check ping at [hour]:[minute] local time. The
  /// background dispatcher reuses this firing to inspect overdue domains and
  /// post a richer "X items need attention" notification when appropriate.
  Future<void> scheduleReminderCheckDaily({
    required int hour,
    required int minute,
    required bool masterEnabled,
  }) async {
    await init();
    await _plugin.cancel(_reminderSummaryId);
    if (!masterEnabled) return;
    final now = DateTime.now();
    var when = DateTime(now.year, now.month, now.day, hour, minute);
    if (!when.isAfter(now)) {
      when = when.add(const Duration(days: 1));
    }
    final tzWhen = tz.TZDateTime.from(when, tz.local);
    await _plugin.zonedSchedule(
      _reminderSummaryId,
      'Zoro',
      'Time to check on your numbers',
      tzWhen,
      _defaultDetails(),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: null,
      matchDateTimeComponents: DateTimeComponents.time,
    );
    _log('scheduled reminder check at $when');
  }

  /// Posts an immediate (or immediately-scheduled) summary about the given
  /// overdue domains. No-op when the list is empty — no "all caught up" buzz.
  Future<void> postReminderSummary(List<ReminderDomain> domains) async {
    await init();
    if (domains.isEmpty) {
      await _plugin.cancel(_reminderSummaryId);
      return;
    }
    final body = _summarizeDomains(domains);
    // Deep-link to the first domain on tap; the body still mentions all.
    final payload = NotificationPayload.reminder(domain: domains.first).encode();
    await _plugin.show(
      _reminderSummaryId,
      'Your numbers need a refresh',
      body,
      _defaultDetails(),
      payload: payload,
    );
    _log('posted reminder summary for $domains');
  }

  /// Replaces the placeholder agent-task notification with a body containing
  /// the freshly-generated briefing preview. Called by the background
  /// dispatcher after a successful LLM run.
  Future<void> postAgentBriefing({
    required String taskId,
    required String title,
    required String body,
  }) async {
    await init();
    final preview = _previewBriefing(body);
    await _plugin.show(
      _idForAgentTask(taskId),
      title.trim().isEmpty ? 'Zoro briefing' : title.trim(),
      preview,
      _defaultDetails(bigText: body),
      payload: NotificationPayload.agentTask(taskId: taskId).encode(),
    );
    _log('posted briefing for task=$taskId len=${body.length}');
  }

  /// Cancels every notification we've scheduled. Useful when the master
  /// switch is turned off.
  Future<void> cancelAll() async {
    await init();
    await _plugin.cancelAll();
    _log('canceled all');
  }

  NotificationDetails _defaultDetails({String? bigText}) {
    return NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: _channelDescription,
        importance: Importance.defaultImportance,
        priority: Priority.defaultPriority,
        styleInformation: bigText == null
            ? null
            : BigTextStyleInformation(bigText, summaryText: 'Zoro briefing'),
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
    _log('tap response payload=${response.payload}');
    _taps.add(payload);
  }

  // Must be a top-level/static handler for background dispatch.
  static void _onBackgroundResponse(NotificationResponse response) {
    if (kDebugMode) {
      debugPrint('[ZoroNotif] background tap payload=${response.payload}');
    }
  }

  int _idForAgentTask(String taskId) =>
      _agentTaskIdBase + (taskId.hashCode.abs() % 10000);

  String _previewBriefing(String body) {
    final cleaned = body.replaceAll('\n', ' ').trim();
    if (cleaned.length <= 140) return cleaned;
    return '${cleaned.substring(0, 140)}…';
  }

  String _summarizeDomains(List<ReminderDomain> domains) {
    final labels = [for (final d in domains) reminderDomainLabel(d)];
    if (labels.length == 1) return '${labels.first} is due for an update.';
    if (labels.length == 2) return '${labels.first} and ${labels.last} are due for an update.';
    final head = labels.sublist(0, labels.length - 1).join(', ');
    return '$head and ${labels.last} are due for an update.';
  }
}

/// Top-level background response handler annotation for the plugin.
@pragma('vm:entry-point')
void zoroBackgroundNotificationResponse(NotificationResponse response) {
  // Background taps for action buttons; the foreground stream re-emits when
  // the app comes back. Body intentionally minimal.
  if (kDebugMode) {
    debugPrint('[ZoroNotif] bg response payload=${response.payload}');
  }
}

/// Coarse status surfaced to the Settings UI.
enum NotificationAuthStatus {
  authorized,
  denied,
  unknown,
  unsupported,
}
