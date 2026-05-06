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

echo "==> flutter pub get (writes ios/Flutter/Generated.xcconfig)"
flutter pub get

if ! command -v pod >/dev/null 2>&1; then
  echo "error: pod (CocoaPods) not on PATH." >&2
  exit 1
fi

echo "==> pod install"
pushd ios >/dev/null
pod install
popd >/dev/null

echo "==> iOS tree ready for xcodebuild / Xcode Cloud."
