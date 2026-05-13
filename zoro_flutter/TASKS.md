# Zoro Flutter — reference

Privacy-first: sensitive finance data stays on device; the app talks to the existing **Zoro web** API (`getzoro.com`) like the Next.js site.

No open tasks.

---

## Ship checklist (before you commit / tag)

- [ ] `cd zoro_flutter && dart analyze` — clean
- [ ] `flutter test` — green (no Xcode required)
- [ ] On a **device**: smoke Command center → Ledger → Context → Chat → Settings; dark + light if you use dark builds
- [ ] **Release** builds: no `--dart-define-from-file` with secrets; App Store / TestFlight use prod signing (`com.getzoro.zoroFlutter`)
- [ ] `API_BASE_URL` points at production when you mean production

**iOS (first time on a Mac):** Xcode + CocoaPods, `./scripts/setup_ios.sh`, open `ios/Runner.xcworkspace`, pick Team + device, Run. Detail: see **iOS quick reference** below.

---

## App surface

Five tabs live in `MainScaffold` and are the entire UI surface:

1. **Command center** (`features/command_center/command_center_tab.dart`) — Sankey, net-worth projection
2. **Ledger** (`features/ledger/ledger_tab.dart`) — assets, liabilities, income, expenses, cashflow rows + import / orchestrator pages
3. **Context** (`features/context/context_tab.dart`) — context editor, orchestrator, planner
4. **Chat** (`features/chat/chat_tab.dart`) — per-agent threads
5. **Settings** (`features/settings/settings_tab.dart`) — API keys, scheduled tasks, internal agent prompts, notifications, reminders

---

## Notifications — architecture (shipped)

- **Local-only** (`flutter_local_notifications` + `workmanager`); no APNs/FCM.
- **Master toggle** — `AppModel.notificationsEnabled` defaults off. Per-scheduled-task `notify` flag. Per-domain silencing = set that row's cadence to **Off** in the Reminders card.
- **Eligibility** — `AppModel.isReminderNotifiable(domain)` requires master on, cadence ≠ Off, real user content (`userTouched*` flags / imported cashflow months), and an overdue review anchor. Onboarding-spam regression test asserts a fresh `AppModel` with every cadence set produces zero notifications.
- **Daily rotation** — at most one reminder push per local day, fired at the user's notify slot. Primary delivery is an **OS-scheduled one-shot** (iOS fires it on time even without Dart running). `AppModel._scheduleNextReminderSlot()` commits any past-scheduled fire into `remindersLastFiredOn/Domain`, picks the next eligible domain via `nextRotationDomain()` (wraps `ReminderDomain.values` after `remindersLastFiredDomain`), cancels the previous slot, and `NotificationService.scheduleReminderForDomainAt()` schedules the next one with per-domain content + payload. `remindersScheduledFireOn` + `remindersPendingDomain` track the pending push. Re-runs on first frame, app resume, and at the end of every Workmanager run. `maybePostDailyReminder()` is the Dart-side fallback; its gate `canFireDailyReminderNow()` defers to any pending OS schedule so the two paths never double-fire.
- **Agent-task push** — pre-scheduled OS alarm and post-LLM background `postAgentBriefing` both render: title = task name (e.g. "Morning briefing"), body = "Is ready for you to review". `_runDueAgentTasks` persists state after each run so `lastRunAt` survives the BG isolate.
- **iOS** — deployment target 14.0; `UIBackgroundModes` (`fetch`, `processing`) + `BGTaskSchedulerPermittedIdentifiers` (`com.getzoro.zoroFlutter.refresh`); `AppDelegate.swift` registers `WorkmanagerPlugin.registerPeriodicTask` before `super.application(...)`. `DarwinNotificationDetails` sets `presentBanner` + `presentList` for foreground banners.
- **Android** — `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `WAKE_LOCK`; `ScheduledNotificationBootReceiver` so absolute-time alarms survive reboot.

---

## iOS quick reference

1. Xcode from App Store; `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` and `sudo xcodebuild -runFirstLaunch` if needed.
2. `brew install cocoapods`
3. `cd zoro_flutter && ./scripts/setup_ios.sh`
4. `open ios/Runner.xcworkspace` → **Runner** → Signing → **Team** → run on device.
5. Device: Trust Mac; **Developer Mode** on.
6. CLI: `flutter devices` then `flutter run -d <id> --dart-define=API_BASE_URL=https://www.getzoro.com`.
   Optional local keys for dev: `./scripts/flutter_with_zoro_env.sh run -d <id> --dart-define=API_BASE_URL=...` (see script; never commit keys).

**Wireless debugging:** Xcode → Devices and Simulators → Connect via network (after USB pairing).

**LAN API from phone:** `--dart-define=API_BASE_URL=http://<Mac-LAN-IP>:3000` (not `127.0.0.1`).

**Device install "invalid signature" / `objective_c.framework` / `0xe8008014`:** The Runner target runs **`ios/scripts/resign_embedded_frameworks.sh`** after `[CP] Embed Pods Frameworks` so every embedded `*.framework` is re-signed with your team. If install still fails: `flutter clean`, delete the app from the device, clear Xcode DerivedData for Runner, `cd ios && pod install`, rebuild.

**Runtime `objective_c` / "incompatible platform (have 'iOS-simulator', need 'iOS')":** That framework was pulled in by **`path_provider_foundation` 2.6+**. `pubspec.yaml` pins **`path_provider_foundation: 2.5.1`** via `dependency_overrides` so the app does not ship `objective_c.framework`. Drop the override when a newer release clearly works on physical devices — watch [flutter/packages path_provider](https://github.com/flutter/packages/tree/main/packages/path_provider/path_provider_foundation) release notes before upgrading.

---

## Bundle IDs

| Flavor | iOS bundle | Android applicationId |
|--------|--------------|------------------------|
| Prod | `com.getzoro.zoroFlutter` | `com.getzoro.zoroFlutter` |
| Dev | `com.getzoro.zoroFlutter.dev` | `…zoroFlutter.dev` (suffix) |

---

## CI

`flutter analyze` + `flutter test` must pass without Xcode.

**Native iOS build:** run `cd zoro_flutter && ./scripts/ci_ios_prepare.sh` before `xcodebuild` on `ios/Runner.xcworkspace` so `Generated.xcconfig` and Pods exist (`flutter pub get` then `pod install` — order matters).

**Xcode Cloud:** repo-root `ci_scripts/ci_post_clone.sh` should `cd` into `zoro_flutter` and run that prepare script; image needs Flutter + CocoaPods on `PATH`.
