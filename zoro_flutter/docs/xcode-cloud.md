# Main → TestFlight (Zoro iOS)

Ship **`com.getzoro.zoroFlutter`** (team `Y4KNF8GPPR`) to TestFlight when `main` changes, then install/update on your iPhone via the TestFlight app.

Updated **2026-10-01**.

## Preferred path: GitHub Actions on Mac mini

Self-hosted runner **`zoro-mac-mini`** (LaunchAgent on this Mac) runs [`.github/workflows/ios-testflight.yml`](../../.github/workflows/ios-testflight.yml):

1. Cloud agent (or anyone) merges/pushes to **`main`** touching `zoro_flutter/`
2. Workflow builds an App Store IPA (`BUILD_NUMBER = 2000 + run_number`)
3. Uploads with the Apple ID signed into Xcode (`scripts/upload_app_store_ipa.sh`)
4. App Store Connect processes the build (often 5–30 min)
5. TestFlight Internal Testing with **Automatic Distribution** delivers it to your device

### One-time device / Internal Testing checklist

In [App Store Connect → Zoro → TestFlight → Internal Testing](https://appstoreconnect.apple.com/apps/6767001446/testflight/ios):

1. Your Apple ID is in an **Internal** group (App Store Connect Users)
2. That group has **Automatic Distribution** enabled
3. On iPhone: TestFlight installed, signed into the same Apple ID, Zoro accepted

Manual trigger: GitHub → Actions → **iOS TestFlight** → Run workflow.

Runner status: `gh api repos/mazinb/zoro/actions/runners --jq '.runners[] | {name,status}'`

The Mac mini keeps the runner alive via LaunchAgent `com.getzoro.gh-actions-runner` (no `SessionCreate`; `KeepAlive`). If archive fails with `errSecInternalComponent`, add GitHub secret `MAC_KEYCHAIN_PASSWORD` (login keychain password) or ensure a user GUI session is logged in.

## Secondary path: Xcode Cloud

Product **zoro_flutter** already exists (app `6767001446`). Enabled workflow **Untitled Workflow** (`17342224-F160-4B4B-8D18-5E70BFD73ED7`) already starts on **`main`** branch changes (build #6 failed on a covered-call import bug; fixed in PR).

### Finish Xcode Cloud → TestFlight Internal

In Xcode or App Store Connect → Xcode Cloud → edit the enabled workflow:

| Setting | Value |
|--------|--------|
| Start condition | Branch Changes → `main` (already) |
| Files filter (optional) | `zoro_flutter/` |
| Action | Archive – iOS, scheme **Runner**, workspace `zoro_flutter/ios/Runner.xcworkspace` |
| Post-action | **TestFlight Internal Testing** → your Internal group |
| Next Build Number | Above last TestFlight CFBundleVersion |

CLI (needs Apple web session once):

```bash
asc web auth login --apple-id 'YOUR_APPLE_ID'
asc web xcode-cloud workflows describe \
  --product-id 31F72565-0711-4B7E-B67A-C02DB0BAE5CC \
  --workflow-id 17342224-F160-4B4B-8D18-5E70BFD73ED7 \
  --apple-id 'YOUR_APPLE_ID'
```

See also [`xcode-cloud-workflow.patch.json`](xcode-cloud-workflow.patch.json).

### CI hooks (Xcode Cloud)

| Script | When | Role |
|--------|------|------|
| [`ios/ci_scripts/ci_post_clone.sh`](../ios/ci_scripts/ci_post_clone.sh) | After git clone | Install Flutter stable, `pub get`, `pod install` |
| [`ios/ci_scripts/ci_pre_xcodebuild.sh`](../ios/ci_scripts/ci_pre_xcodebuild.sh) | Before `xcodebuild` | Restore Flutter `PATH` / `FLUTTER_ROOT` |
| [`scripts/ci_ios_prepare.sh`](../scripts/ci_ios_prepare.sh) | Shared | Actual Flutter + CocoaPods work |
| [`../../ci_scripts/ci_post_clone.sh`](../../ci_scripts/ci_post_clone.sh) | Fallback | Monorepo Git-root entry |

`API_BASE_URL` defaults to **https://www.getzoro.com** in [`lib/core/app_env.dart`](../lib/core/app_env.dart).

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
| Actions job queued forever | Runner offline — `cd ~/actions-runner && ./svc.sh status` / `./svc.sh start` |
| Upload auth failed | Sign into Xcode with the team Apple ID (Accounts) |
| Build number rejected | Bump override or wait; Actions uses `2000 + run_number` |
| TestFlight has no new build | Wait for ASC processing; confirm Internal **Automatic Distribution** |
| Xcode Cloud `flutter: command not found` | Confirm `ios/ci_scripts/ci_post_clone.sh` is executable and committed |
| Scheme “may only exist locally” | Shared scheme under `Runner.xcworkspace/xcshareddata/xcschemes/` |

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
