#!/usr/bin/env bash
# Run on your Mac after plugging in an iPhone (USB). Requires full Xcode from App Store.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1. Checking Xcode"
if [[ ! -d "/Applications/Xcode.app" ]]; then
  echo "    Install Xcode from the App Store, then run:"
  echo " sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
  echo "      sudo xcodebuild -runFirstLaunch"
  exit 1
fi

if [[ "$(xcode-select -p)" != "/Applications/Xcode.app/Contents/Developer" ]]; then
  echo "    Warning: xcode-select may not point at Xcode.app. Fix with:"
  echo "      sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
fi

echo "==> 2. Checking CocoaPods"
if ! command -v pod >/dev/null 2>&1; then
  echo "    Install CocoaPods, e.g.: brew install cocoapods"
  exit 1
fi

echo "==> 3. Flutter dependencies"
flutter pub get

echo "==> 4. iOS pods (plugins)"
pushd ios >/dev/null
pod install
popd >/dev/null

echo ""
echo "Done. Next steps:"
echo "  1. iPhone: USB, Trust, Settings → Developer Mode ON."
echo "  2. Open:  open ios/Runner.xcworkspace   (not .xcodeproj)"
echo "  3. Xcode: Signing & Capabilities → Team → Run on device once."
echo "  4. CLI:   flutter devices"
echo "           flutter run -d <device-id> --dart-define=API_BASE_URL=https://www.getzoro.com"
