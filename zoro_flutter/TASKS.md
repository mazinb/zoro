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

1. Plan tab — one form vertical: UI + `POST /api/user-data` with `formType` aligned to web.  
2. Money / Income — wire web `/income` when product-ready.  
3. Expenses — mirror web estimates/monthly routes.  
4. Universal Links — `applinks:www.getzoro.com` + token routing in iOS.  
5. Subscriptions — entitlements + StoreKit 2; map 403/402 to paywall.

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
