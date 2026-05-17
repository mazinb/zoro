# Zoro Flutter — developer reference

Privacy-first: sensitive finance data stays on device; production API: **getzoro.com** (same as `zoro-app`).

**On-device data layout (layout version 2, schema version 1):** documented in **[`../zoro-app/README.md` → On-device data layout](../zoro-app/README.md#on-device-data-layout)**. Bump `kAppStateSplitLayoutVersion` / `kAppStateFormatVersion` in code when you change storage; update that README table in the same PR.

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

Five tabs in `MainScaffold` (`features/shell/main_scaffold.dart`):

1. **Home** — `command_center_tab.dart` — Sankey, net-worth projection
2. **Ledger** — `ledger_tab.dart` — assets, liabilities, income, expenses, cashflow + import/orchestrator
3. **Context** — `context_tab.dart` — editor, orchestrator, planner
4. **Goals** — `goals_tab.dart` — retirement / target goals
5. **Settings** — `settings_tab.dart` — API keys, reminders, agents, ledger export/import, notifications

Chat threads are persisted in `data/chats.json` (see repo README data layout).

---

## Notifications — architecture (shipped)

- **Local-only** (`flutter_local_notifications`); no APNs/FCM. No background Dart runner — reminders fire via OS schedules; in-app catch-up only when the app is open.
- **Master toggle** — Settings → Allow notifications. Turning on calls `requestPermission()` (iOS prompt in-app). `AppModel.notificationsEnabled` defaults off. Per-domain silencing = set that row's cadence to **Off** in the Reminders card.
- **Init timing (iOS UIScene)** — Do **not** init the notification plugin in `main()`. Plugins register in `AppDelegate.didInitializeImplicitFlutterEngine` after `main` returns. `NotificationService.init()` retries until the channel exists; `AppModel.reconcileNotifications()` runs after `bootstrap()` loads disk (never before — early sync used to call `cancelAll()` with defaults).
- **OS schedule id** — rotation / check-in uses notification id `900` (`_reminderSummaryId`).
- **Daily reminder slot** — user picks **Reminder check time** in Settings. `_scheduleNextReminderSlot()` always registers a **one-shot OS alarm** at the next occurrence of that time (today if still in the future, else tomorrow). Pick order:
  1. **Overdue domain** — `nextRotationDomain()` + per-domain title/body (`isReminderNotifiable`: cadence on, onboarding done, review overdue).
  2. **Schedulable domain** — same rotation but only requires cadence on + onboarding + `userHasContentFor` (not yet overdue).
  3. **Generic check-in** — title "Zoro", body **"Time for your regular check-in."** Used for new users (`remindersOnboardingComplete == false`) and caught-up users. Spam guard for *immediate* in-app posts stays overdue-only (`maybePostDailyReminder`).
- **Onboarding** — `remindersOnboardingComplete` when any of: `userTouchedExpenses`, `userTouchedIncome`, `userTouchedAssets`, `userTouchedLiabilities`, or a cashflow month imported. Fastest unlock: edit one expense or add one asset in Ledger. Until then, user still gets the generic check-in at their chosen time if notifications are on.
- **In-app fallback** — `maybePostDailyReminder()` after resume / bootstrap: posts at most one overdue reminder per day after the notify slot (does not double-fire with a pending OS schedule). `canFireDailyReminderNow` gates this.
- **Reconcile entry points** — `bootstrap()` end, app resume (`MainScaffold`), `setNotificationsEnabled`, `setReminderNotifyTime`, reminder cadence changes.
- **Timezone** — device offset matched to a `timezone` DB location (no `flutter_timezone` platform channel).
- **iOS** — deployment target 14.0; `UNUserNotificationCenter.current().delegate = self` in `didInitializeImplicitFlutterEngine`. `DarwinNotificationDetails`: `presentBanner` + `presentList`.
- **Android** — `POST_NOTIFICATIONS`, boot receivers for rescheduled alarms.
- **Logs** — `[ZoroNotif]` via `print` (visible in Xcode device console for Debug and Release); init/schedule failures included.
- **Regression tests** — `test/notifications_test.dart` (payload, gates, rotation). Fresh install + cadences set → zero *immediate* overdue fires; OS check-in still schedules when master switch on.

## Data export / import

See **[`../zoro-app/README.md` → On-device data layout](../zoro-app/README.md#on-device-data-layout)**. UI: Settings → Agents → Data. Tests: `test/app_state_transfer_test.dart`, `test/app_state_split_store_test.dart`.

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
