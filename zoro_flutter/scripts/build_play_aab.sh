#!/usr/bin/env bash
# One-shot release AAB for Google Play (manual upload in Play Console).
set -euo pipefail

cd "$(dirname "$0")/.."

API_BASE_URL="${API_BASE_URL:-https://www.getzoro.com}"
KEY_PROPS="android/key.properties"

# Prefer Homebrew OpenJDK + Android SDK when not set (macOS dev machines).
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in \
    "/opt/homebrew/Cellar/openjdk@17"/*/libexec/openjdk.jdk/Contents/Home \
    "${HOME}/Library/Java/JavaVirtualMachines"/*/Contents/Home; do
    if [[ -d "${candidate}" ]]; then
      export JAVA_HOME="${candidate}"
      break
    fi
  done
fi
if [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Library/Android/sdk" ]]; then
  export ANDROID_HOME="${HOME}/Library/Android/sdk"
fi

if [[ ! -f "${KEY_PROPS}" ]]; then
  echo "Missing ${KEY_PROPS}. Run ./scripts/generate_android_keystore.sh first."
  exit 1
fi

echo "Building prod AAB with API_BASE_URL=${API_BASE_URL}"
echo "  pubspec: $(grep '^version:' pubspec.yaml)"

flutter pub get

set +e
flutter build appbundle --release --flavor prod \
  --dart-define=API_BASE_URL="${API_BASE_URL}"
BUILD_EXIT=$?
set -e

AAB="$(ls -1t build/app/outputs/bundle/prodRelease/*.aab 2>/dev/null | head -n 1 || true)"
if [[ -z "${AAB}" || ! -f "${AAB}" ]]; then
  if [[ "${BUILD_EXIT}" -ne 0 ]]; then
    echo "flutter build appbundle failed (exit ${BUILD_EXIT})."
  else
    echo "Build finished but no AAB found under build/app/outputs/bundle/prodRelease/"
  fi
  exit 1
fi

if [[ "${BUILD_EXIT}" -ne 0 ]]; then
  echo ""
  echo "WARN: flutter exited ${BUILD_EXIT} after Gradle produced an AAB."
  echo "  This usually means Android SDK Command-line Tools are missing."
  echo "  Install: Android Studio → Settings → Languages & Frameworks → Android SDK"
  echo "           → SDK Tools → Android SDK Command-line Tools (latest)"
  echo "  The AAB below is still valid for Play upload if verify passes."
  echo ""
fi
echo "AAB ready: ${AAB}"
MERGED="$(find build/app/intermediates/merged_manifests/prodRelease -name AndroidManifest.xml 2>/dev/null | head -1 || true)"
if [[ -n "${MERGED}" ]] && grep -q "USE_EXACT_ALARM\|SCHEDULE_EXACT_ALARM" "${MERGED}" 2>/dev/null; then
  echo "ERROR: merged manifest still declares exact-alarm permissions — aborting."
  grep "EXACT_ALARM" "${MERGED}" || true
  exit 1
fi
echo "Manifest check: no USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM in prod release merge."
chmod +x scripts/verify_play_aab.sh 2>/dev/null || true
./scripts/verify_play_aab.sh "${AAB}" || exit 1
open -R "${AAB}" 2>/dev/null || true
