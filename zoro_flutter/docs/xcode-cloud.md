# Main → TestFlight (Zoro iOS) — Mac can be off

Ship **`com.getzoro.zoroFlutter`** (team `Y4KNF8GPPR`) to TestFlight when `main` changes, then install/update on your iPhone via the TestFlight app.

Updated **2026-10-01**.

## Preferred path (Mac off): Xcode Cloud Archive

Apple builds on their Macs. Your Mac mini does **not** need to be on.

| Setting | Value |
|--------|--------|
| Product | `zoro_flutter` (`31F72565-0711-4B7E-B67A-C02DB0BAE5CC`) |
| Workflow | **Default** (`61F658E4-4EBC-484A-B559-76D2C46875DA`) — **enabled** |
| Start condition | Branch Changes → `main` |
| Action | **Archive – iOS**, scheme **Runner**, workspace `zoro_flutter/ios/Runner.xcworkspace` |
| Audience | App Store eligible (TestFlight) |

The older **Untitled Workflow** (`17342224-…`) is **Build-only** and is **disabled** so it does not waste minutes.

### Flow

1. Cloud agent (or anyone) merges/pushes to **`main`** touching `zoro_flutter/`
2. Xcode Cloud **Default** archives on Apple’s infra
3. App Store Connect processes the build (often 5–30 min)
4. TestFlight Internal Testing with **Automatic Distribution** delivers it to your device

### One-time device / Internal Testing checklist

In [App Store Connect → Zoro → TestFlight → Internal Testing](https://appstoreconnect.apple.com/apps/6767001446/testflight/ios):

1. Your Apple ID is in an **Internal** group (App Store Connect Users)
2. That group has **Automatic Distribution** / access to all builds (or assign each build)
3. On iPhone: TestFlight installed, signed into the same Apple ID, Zoro accepted

### Trigger / diagnose from CLI (ASC API key)

```bash
# Start Default on main and wait + doctor on failure
asc xcode-cloud run --app 6767001446 --workflow Default --branch main --wait --doctor

# List recent runs
asc xcode-cloud build-runs --workflow-id 61F658E4-4EBC-484A-B559-76D2C46875DA --limit 5
```

### CI hooks (Xcode Cloud)

| Script | When | Role |
|--------|------|------|
| [`ios/ci_scripts/ci_post_clone.sh`](../ios/ci_scripts/ci_post_clone.sh) | After git clone | Install Flutter stable, `pub get`, `pod install` |
| [`ios/ci_scripts/ci_pre_xcodebuild.sh`](../ios/ci_scripts/ci_pre_xcodebuild.sh) | Before `xcodebuild` | Restore Flutter `PATH` / `FLUTTER_ROOT` |
| [`scripts/ci_ios_prepare.sh`](../scripts/ci_ios_prepare.sh) | Shared | Actual Flutter + CocoaPods work |

`API_BASE_URL` defaults to **https://www.getzoro.com** in [`lib/core/app_env.dart`](../lib/core/app_env.dart).

Xcode Cloud clones **Flutter stable tip** (e.g. 3.47.x). Local Mac may lag; see `dependency_overrides` for `pdfrx` / `pdfrx_engine` in `pubspec.yaml` (0.3.9 fails null-safety on current Dart).

## Optional path: GitHub Actions on Mac mini

Self-hosted runner **`zoro-mac-mini`** runs [`.github/workflows/ios-testflight.yml`](../../.github/workflows/ios-testflight.yml) when the Mac is awake. Useful as a backup; **not** required for Mac-off delivery.

Runner status: `gh api repos/mazinb/zoro/actions/runners --jq '.runners[] | {name,status}'`

## Local Mac one-shot

```bash
cd zoro_flutter
./scripts/setup_ios.sh
BUILD_NUMBER=15 ./scripts/build_app_store_ipa.sh
./scripts/upload_app_store_ipa.sh
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Xcode Cloud PhaseScript / `pdfrx_engine` nullability | Keep `dependency_overrides` for `pdfrx` 2.4.7 + `pdfrx_engine` 0.4.5 (or newer once Flutter meta allows) |
| Xcode Cloud `flutter: command not found` | Confirm `ios/ci_scripts/ci_post_clone.sh` is executable and committed |
| Scheme “may only exist locally” | Shared scheme under `Runner.xcworkspace/xcshareddata/xcschemes/` |
| Xcode Cloud: deployment target 14.0 / pods &lt;15 unsupported | Runner + Podfile `platform` **16.0**; `post_install` forces every pod target to **16.0** |
| TestFlight has no new build | Wait for ASC processing; confirm Internal **Automatic Distribution** |
| Actions job queued forever | Runner offline — Mac must be on for the optional GH Actions path |

Scripts must be executable in git:

```bash
git update-index --chmod=+x \
  zoro_flutter/ios/ci_scripts/ci_post_clone.sh \
  zoro_flutter/ios/ci_scripts/ci_pre_xcodebuild.sh \
  zoro_flutter/scripts/ci_ios_prepare.sh \
  zoro_flutter/scripts/build_app_store_ipa.sh \
  zoro_flutter/scripts/upload_app_store_ipa.sh \
  ci_scripts/ci_post_clone.sh \
  zoro_flutter/ci_scripts/ci_post_clone.sh
```
