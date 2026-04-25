# Zoro Flutter — task backlog

## Current direction (UI-first)

- [x] **Disable login / session wiring** — App boots directly into the 5-tab shell so we can iterate UI first.
- [ ] **UI pass** — Flesh out Home/Plan/Money/Retire/Profile screens (static + local mock data).
- [ ] **Token → DB wiring** — Add lightweight user-token flow for reads/writes once UI stabilizes.
- [ ] **Add login last** — Reintroduce onboarding/magic-link when ready.

## Done (bootstrap)

- [x] Project scaffold under `zoro_flutter/` (iOS + macOS + web targets; primary product is iOS).
- [x] Core: `AppEnv` (`API_BASE_URL` via `--dart-define`), `ZoroApi`, `SessionController` + secure token storage.
- [x] Onboarding: email magic link + token sign-in (same APIs as web).
- [x] Shell: 5-tab `NavigationBar` (Home, Plan, Money, Retire, Profile).
- [x] Money → Expenses: AI PDF import via `/api/expenses/parse-one-file` (paid/rate limits handled by server).
- [x] Zoro mark: animated painter (web timing) + static SVG asset.

## iOS device setup (do this on your Mac)

**Plug in the iPhone with USB** before the first Xcode run.

1. Install **Xcode** from the App Store (full app, ~10GB+).
2. First-time Xcode setup:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   ```
3. Install CocoaPods: `brew install cocoapods`
4. From repo root, run the helper script:
   ```bash
   cd zoro_flutter
   ./scripts/setup_ios.sh
   ```
5. **Signing:** `open ios/Runner.xcworkspace` → select **Runner** → **Signing & Capabilities** → choose your **Team** → select your **iPhone** as run destination → **Run** once.
6. On iPhone: **Trust** computer; **Settings → Privacy & Security → Developer Mode** → On.
7. Flutter CLI:
   ```bash
   flutter devices
   flutter run -d <device-id> --dart-define=API_BASE_URL=https://www.getzoro.com
   ```

**Local API from device:** use your Mac’s LAN IP, e.g. `--dart-define=API_BASE_URL=http://192.168.1.50:3000` (not `127.0.0.1`).

**Wireless debugging (optional):** Xcode → **Window → Devices and Simulators** → select iPhone → enable **Connect via network** (after one USB pairing).

## Agent-sized next tasks

1. **Plan tab forms** — Port one vertical end-to-end (e.g. Save): UI + `POST /api/user-data` with `formType` matching web.
2. **Money / Income** — Wire `GET`/`POST` patterns from web `/income` and statement parse route when product-ready.
3. **Expenses manual** — Mirror estimates/monthly routes; display bucket totals like web.
4. **Universal Links** — `applinks:www.getzoro.com` + handle `?token=` in `AppDelegate`/router.
5. **Subscriptions** — Server entitlement field + StoreKit 2; map 403/402 responses to in-app paywall.
6. **Design polish** — Typography/spacing audit vs web; dark mode using same palette tokens.

## CI note

`flutter analyze` and `flutter test` should pass without Xcode. Native iOS/macOS builds require `xcodebuild` on the runner.
