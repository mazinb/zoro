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

1. Cashflow PDF import — keep refining **Import monthly cashflow** prompts; iteration context: `docs/cashflow_import_prompt_context.md`.
2. Plan tab — one form vertical: UI + `POST /api/user-data` with `formType` aligned to web.  
3. Money / Income — wire web `/income` when product-ready.  
4. Expenses — mirror web estimates/monthly routes.  
5. Universal Links — `applinks:www.getzoro.com` + token routing in iOS.  
6. Subscriptions — entitlements + StoreKit 2; map 403/402 to paywall.

## Native push notifications

### Shipped

- Local-only (`flutter_local_notifications` + `workmanager`); no APNs/FCM.
- One master "Allow notifications" toggle (`AppModel.notificationsEnabled`) covers briefings + reminder summaries; defaults off. Per-scheduled-task `notify` flag. Per-domain silencing is done by setting that row's cadence to **Off** in the Reminders card.
- `AppModel.isReminderNotifiable(domain)` is the only predicate the push path consults — requires master on, cadence ≠ Off, real user content (`userTouched*` / imported cashflow months), an overdue cadence anchor, and not-already-notified-this-period. Onboarding-spam regression test asserts a fresh `AppModel` with every cadence set produces zero notifications.
- iOS: deployment target 14.0; `UIBackgroundModes` (`fetch`, `processing`) + `BGTaskSchedulerPermittedIdentifiers` (`com.getzoro.zoroFlutter.refresh`); `AppDelegate.swift` registers `WorkmanagerPlugin.registerPeriodicTask` before `super.application(...)` (mandatory or iOS crashes with `NSInternalInconsistencyException`). `DarwinNotificationDetails` sets `presentBanner` + `presentList` so iOS 14+ shows banners while the app is foreground.
- Android: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `WAKE_LOCK`; `ScheduledNotificationBootReceiver` so absolute-time alarms survive reboot.
- iOS verified end-to-end on device: permission flow + foreground/lock-screen test fire works.

### TODO — v2 content + routing polish

- **Notification body content.** Right now the agent-task placeholder is the generic string `"Briefing ready — tap to open Zoro"` and `postReminderSummary` produces a flat `"X is due for an update."` sentence. Replace with:
  - Agent task: the workmanager background dispatcher already runs the LLM and calls `postAgentBriefing`, but if Workmanager misses the slot the user sees the placeholder. Decide on a fallback — either run the agent on next foreground resume and replace, or include a smarter one-liner derived from `AppModel` (e.g. "Cash flow is down 12% vs last month").
  - Reminder summary: surface the actual staleness ("Cash flow hasn't been updated in 67 days") and the cadence anchor that's due, not just the domain name. Pull from `*ReviewOverdueAt` siblings already on `AppModel`.
- **Deep-link destinations (not Settings).** Today `_handleNotificationPayload` routes agent taps to Home and reminder taps to Ledger + section. Improve to land on the precise editing surface:
  - Reminders → open the domain's edit sheet (Assets sheet / Liabilities sheet / Income editor / Expense bucket / Cashflow import) instead of just scrolling the Ledger to that section.
  - Agent briefings → land on the briefing detail (or scroll Home to the "Updates" card), and mark the briefing read in `AppModel` so the tap doesn't keep nagging.
  - Add a tiny `NotificationRoute` enum on `notification_payload.dart` so the payload carries the intended landing surface rather than re-deriving it in `MainScaffold`.
- **Stale-data dismiss UX.** Tapping a reminder should call `AppModel.markDomainNotified(...)` immediately so we don't re-buzz the same period even if the user closes the destination without editing.
- **Android device smoke test.** Pixel still pending: verify briefing fires, reminder summary fires only when the user has populated the domain, tap deep-links land correctly, fresh install during onboarding never buzzes, reboot keeps schedules.

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
