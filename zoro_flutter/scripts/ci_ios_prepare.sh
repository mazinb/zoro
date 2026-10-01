#!/usr/bin/env bash
# Run before any iOS CI step that invokes xcodebuild (Xcode Cloud, GitHub Actions, etc.).
# ios/.gitignore omits Pods/ and Flutter/Generated.xcconfig — they must be created on the runner.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v flutter >/dev/null 2>&1; then
  echo "error: flutter not on PATH; install Flutter on the CI image/runner first." >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL:-https://www.getzoro.com}"

echo "==> flutter pub get (writes ios/Flutter/Generated.xcconfig)"
flutter pub get

echo "==> flutter build ios --config-only (Release, API_BASE_URL=${API_BASE_URL})"
flutter build ios --config-only --release --dart-define=API_BASE_URL="${API_BASE_URL}"

# Xcode Cloud's CI_BUILD_NUMBER must win over pubspec's +N or TestFlight rejects the upload.
if [ -n "${CI_BUILD_NUMBER:-}" ]; then
  echo "==> FLUTTER_BUILD_NUMBER=${CI_BUILD_NUMBER}"
  sed -i '' "s/^FLUTTER_BUILD_NUMBER=.*/FLUTTER_BUILD_NUMBER=${CI_BUILD_NUMBER}/" ios/Flutter/Generated.xcconfig
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "==> Installing CocoaPods"
  HOMEBREW_NO_AUTO_UPDATE=1 brew install cocoapods
fi

echo "==> pod install"
(
  cd ios
  pod install
)

echo "==> iOS tree ready for xcodebuild / Xcode Cloud."
