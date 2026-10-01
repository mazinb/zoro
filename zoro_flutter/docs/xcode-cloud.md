# Xcode Cloud → TestFlight (Zoro iOS)

Ship builds of **`com.getzoro.zoroFlutter`** (team `Y4KNF8GPPR`) from the monorepo without a local Mac archive.

Updated **2026-09-30**.

## What the hooks do

| Script | When | Role |
|--------|------|------|
| [`ios/ci_scripts/ci_post_clone.sh`](../ios/ci_scripts/ci_post_clone.sh) | After git clone | Install Flutter stable, `pub get`, `pod install` |
| [`ios/ci_scripts/ci_pre_xcodebuild.sh`](../ios/ci_scripts/ci_pre_xcodebuild.sh) | Before `xcodebuild` | Restore Flutter `PATH` / `FLUTTER_ROOT` |
| [`scripts/ci_ios_prepare.sh`](../scripts/ci_ios_prepare.sh) | Shared | Actual Flutter + CocoaPods work |
| [`../../ci_scripts/ci_post_clone.sh`](../../ci_scripts/ci_post_clone.sh) | Fallback | Monorepo Git-root entry that delegates to `ios/ci_scripts` |

`API_BASE_URL` defaults to **https://www.getzoro.com** in [`lib/core/app_env.dart`](../lib/core/app_env.dart) — no dart-define required for Archive.

Current marketing/build in `pubspec.yaml`: see `version:` (build number `+N`). In the Xcode Cloud workflow set **Next Build Number** ≥ `N + 1` so TestFlight accepts the upload.

## One-time: create the workflow (Mac + Xcode)

1. Clone `https://github.com/mazinb/zoro.git`, open:
   ```bash
   open zoro_flutter/ios/Runner.xcworkspace
   ```
2. **Product → Xcode Cloud → Create Workflow…**
3. Product: **Zoro** / `com.getzoro.zoroFlutter`
4. **Edit Workflow**:
   - **Environment**: Latest release Xcode; macOS recommended by Xcode
   - **Start condition**: Branch Changes on `main` (or Manual only while testing)
   - **Files and Folders** (optional filter): `zoro_flutter/`
   - **Actions**: Archive → iOS → **TestFlight Internal Testing** (or Archive only, then distribute)
   - **Next Build Number**: at least one higher than the last TestFlight build (see App Store Connect → TestFlight → iOS builds)
5. Grant Xcode Cloud access to the GitHub repo `mazinb/zoro` when prompted
6. Save → **Start Build**

App Store Connect alternative: [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → your app → **Xcode Cloud** → Create Workflow → choose the same workspace/scheme **Runner**.

## After a green build

1. App Store Connect → **TestFlight** → the new build processes (often 5–30 min)
2. Add yourself (Internal Testing) if not already
3. On iPhone: install **TestFlight** → **Zoro** → update

## Local Mac equivalent (without Cloud)

```bash
cd zoro_flutter
./scripts/setup_ios.sh
./scripts/build_app_store_ipa.sh
./scripts/upload_app_store_ipa.sh   # uses Apple ID signed into Xcode
# or: ./scripts/open_ipa_in_transporter.sh
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `flutter: command not found` in post-clone | Hooks install Flutter to `$HOME/flutter`; confirm `ios/ci_scripts/ci_post_clone.sh` is executable and committed |
| `Generated.xcconfig` missing | post-clone must finish `flutter pub get` before Archive |
| Pod / Flutter engine mismatch | Re-run workflow; `ci_ios_prepare.sh` runs `pod install` after pub get |
| Wrong API host | Set env `API_BASE_URL` in the workflow (only if not using the default production URL) |
| Build number rejected | Raise **Next Build Number** in the workflow above the last uploaded CFBundleVersion |

Scripts must be executable in git:

```bash
git update-index --chmod=+x \
  zoro_flutter/ios/ci_scripts/ci_post_clone.sh \
  zoro_flutter/ios/ci_scripts/ci_pre_xcodebuild.sh \
  zoro_flutter/scripts/ci_ios_prepare.sh \
  ci_scripts/ci_post_clone.sh \
  zoro_flutter/ci_scripts/ci_post_clone.sh
```
