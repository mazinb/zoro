# Zoro Flutter — backlog

Privacy-first: sensitive finance data stays on device; the app talks to your existing **Zoro web** API (`getzoro.com`) like the Next.js site.

---

## Ship checklist (before you commit / tag)

- [ ] `cd zoro_flutter && dart analyze` — clean  
- [ ] `flutter test` — green (no Xcode required)  
- [ ] On a **device**: smoke Home → Ledger → Settings; dark + light if you use dark builds  
- [ ] **Release** builds: no `--dart-define-from-file` with secrets; App Store / TestFlight use prod signing (`com.getzoro.zoroFlutter`)  
- [ ] `API_BASE_URL` points at production when you mean production  

**iOS (first time on a Mac):** Xcode + CocoaPods, `./scripts/setup_ios.sh`, open `ios/Runner.xcworkspace`, pick Team + device, Run. Detail: see **iOS quick reference** below.

---

## After first ship — final pass

Use this when you come back from living in the app for a bit:

- Dark theme: flip remaining tabs to `colorScheme` / fix hardcoded light surfaces (see table).  
- Persist **ThemeMode** (system / light / dark) + Settings toggle + `MaterialApp.themeMode`.  
- Small UI regressions, copy, and performance only—no new big features unless listed in **Product backlog**.

---

## Dark mode (phased)

**Done in tree:** `AppTheme.dark`, `AppModel.themedDark()`, `MaterialApp` wired for dark theme (default theme mode is still **light** until you persist a preference).

**Done / strong progress:** Command center (Sankey liquid nodes, flow card, glass modals), bottom **liquid** nav (flat frost, `extendBody`, transparent slot), Home Updates / Sankey chrome panels, modal sheets via `showLiquidGlassModalBottomSheet` across Ledger / Chat / Context / Settings / Sandbox.

| Area | Status |
|------|--------|
| Chat tab shell | Open |
| Context tab lists | Open |
| Settings chrome | Open |
| Horizon / Life log | Open |
| Ledger (remaining rows/sheets) | Mostly OK; polish when dark on |
| Onboarding / Sandbox | Open |
| **Enable dark for users** | Persist `ThemeMode` + toggle (Settings) |

Prefer `Theme.of(context).colorScheme` / `textTheme` over `AppTheme.slate*` and raw `Colors.white`.

---

## Product backlog (later)

0. **Apple on-device LLM** — Settings → API keys: Apple on-device toggle; requires iOS 26+ + Apple Intelligence + Xcode with Foundation Models SDK. Android unchanged. Smoke: chat + scheduled agent with Apple when available; `dart analyze` / `flutter test` green without Xcode.
1. Cashflow PDF import — keep refining **Import monthly cashflow** prompts; iteration context: `docs/cashflow_import_prompt_context.md`.
2. Plan tab — one form vertical: UI + `POST /api/user-data` with `formType` aligned to web.  
3. Money / Income — wire web `/income` when product-ready.  
4. Expenses — mirror web estimates/monthly routes.  
5. Universal Links — `applinks:www.getzoro.com` + token routing in iOS.  
6. Subscriptions — entitlements + StoreKit 2; map 403/402 to paywall.

## Native push notifications

### Shipped

- Local-only (`flutter_local_notifications` + `workmanager`); no APNs/FCM.
- One master "Allow notifications" toggle (`AppModel.notificationsEnabled`) covers briefings + reminder pushes; defaults off. Per-scheduled-task `notify` flag. Per-domain silencing is done by setting that row's cadence to **Off** in the Reminders card.
- `AppModel.isReminderNotifiable(domain)` checks eligibility (master on, cadence ≠ Off, user content, overdue anchor). Onboarding-spam regression test asserts a fresh `AppModel` with every cadence set produces zero notifications.
- **v2 daily rotation gate (reminders).** At most one reminder push per local day, fired at or after `reminderNotifyHour:reminderNotifyMinute`. `AppModel.maybePostDailyReminder()` is the single entry point: it consults `canFireDailyReminderNow()` (gate) + `nextRotationDomain()` (rotation through eligible domains in `ReminderDomain.values` order, wrapping around `remindersLastFiredDomain`), posts `NotificationService.postReminderForDomain(d)`, stamps `remindersLastFiredOn/Domain`, and **awaits** `persistAppStateToDisk()` so the BG isolate can't lose the "fired today" flag. Both Workmanager (`background_dispatcher._runRefresh`) and the app's foreground/resume hooks (`MainScaffold`) call this method, so a missed BG slot is caught up on next app open.
- **v2 agent-task push.** Pre-scheduled OS alarm and post-LLM background `postAgentBriefing` both render the same notification: title = task name (e.g. "Morning briefing"), body = "Is ready for you to review". `_runDueAgentTasks` in the background dispatcher persists state after each run so `lastRunAt` survives the isolate.
- iOS: deployment target 14.0; `UIBackgroundModes` (`fetch`, `processing`) + `BGTaskSchedulerPermittedIdentifiers` (`com.getzoro.zoroFlutter.refresh`); `AppDelegate.swift` registers `WorkmanagerPlugin.registerPeriodicTask` before `super.application(...)`. `DarwinNotificationDetails` sets `presentBanner` + `presentList` for foreground banners on iOS 14+.
- Android: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `WAKE_LOCK`; `ScheduledNotificationBootReceiver` so absolute-time alarms survive reboot.
- iOS verified end-to-end on device: permission flow + foreground/lock-screen test fire works.

### TODO — v3 content + routing polish

- **Smarter notification copy.** Per-domain reminder copy still says "Cash flow needs a refresh / Tap to update your … balances." Surface concrete staleness ("Cash flow hasn't been updated in 67 days") and the cadence anchor that's due, pulled from `*ReviewOverdueAt` siblings on `AppModel`. For agent briefings, decide between the static "Is ready for you to review" and a one-liner derived from `homeSummaryText` (currently the static copy wins; revisit once we have a stable BG run rate).
- **Deep-link destinations (not Settings).** `_handleNotificationPayload` routes agent taps to Home and reminder taps to Ledger + section. Land on the precise editing surface:
  - Reminders → open the domain's edit sheet (Assets sheet / Liabilities sheet / Income editor / Expense bucket / Cashflow import) instead of just scrolling the Ledger to that section.
  - Agent briefings → land on the briefing detail (or scroll Home to the "Updates" card), and mark the briefing read in `AppModel` so the tap doesn't keep nagging.
  - Add a tiny `NotificationRoute` enum on `notification_payload.dart` so the payload carries the intended landing surface rather than re-deriving it in `MainScaffold`.
- **Stale-data dismiss UX.** Tapping a reminder should call `AppModel.recordDailyReminderFired(...)` immediately so we don't re-buzz today even if the user closes the destination without editing (Workmanager + foreground hook already enforce the daily gate, so this is belt-and-braces).
- **Exact-time delivery.** Workmanager runs every ~15 min on iOS and may slip the user's notify slot by a non-trivial amount. If users complain about timing drift, schedule a per-day OS-level local notification with pre-computed rotation content at `syncNotifications()` time (and re-schedule the next day's push on each fire / resume).
- **Android device smoke test.** Pixel still pending: verify briefing fires, rotation reminder fires only once per day on the chosen slot, tap deep-links land correctly, fresh install during onboarding never buzzes, reboot keeps schedules.

---

## iOS quick reference

1. Xcode from App Store; `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` and `sudo xcodebuild -runFirstLaunch` if needed.  
2. `brew install cocoapods`  
3. `cd zoro_flutter && ./scripts/setup_ios.sh`  
4. `open ios/Runner.xcworkspace` → **Runner** → Signing → **Team** → run on device.  
5. Device: Trust Mac; **Developer Mode** on.  
6. CLI: `flutter devices` then  
   `flutter run -d <id> --dart-define=API_BASE_URL=https://www.getzoro.com`  
   Optional local keys for dev: `./scripts/flutter_with_zoro_env.sh run -d <id> --dart-define=API_BASE_URL=...` (see script; never commit keys).

**Wireless debugging:** Xcode → Devices and Simulators → Connect via network (after USB pairing).

**LAN API from phone:** `--dart-define=API_BASE_URL=http://<Mac-LAN-IP>:3000` (not `127.0.0.1`).

---

## Bundle IDs

| Flavor | iOS bundle | Android applicationId |
|--------|--------------|------------------------|
| Prod | `com.getzoro.zoroFlutter` | `com.getzoro.zoroFlutter` |
| Dev | `com.getzoro.zoroFlutter.dev` | `…zoroFlutter.dev` (suffix) |

---

## CI

`flutter analyze` + `flutter test` must pass without Xcode.

**Native iOS build:** run `cd zoro_flutter && ./scripts/ci_ios_prepare.sh` before `xcodebuild` on `ios/Runner.xcworkspace` so `Generated.xcconfig` and Pods exist (`flutter pub get` then `pod install`—order matters).

**Xcode Cloud:** repo-root `ci_scripts/ci_post_clone.sh` should `cd` into `zoro_flutter` and run that prepare script; image needs Flutter + CocoaPods on `PATH`.
