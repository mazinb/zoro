#!/usr/bin/env bash
# Shared prepare for Xcode Cloud / CI: install Flutter if needed, pub get, pod install.
# Expects to run with cwd = zoro_flutter (Flutter package root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FLUTTER_DIR="${FLUTTER_DIR:-$HOME/flutter}"
FLUTTER_CHANNEL="${FLUTTER_CHANNEL:-stable}"

install_flutter() {
  if [ -x "$FLUTTER_DIR/bin/flutter" ]; then
    echo "==> Using existing Flutter at $FLUTTER_DIR"
  else
    echo "==> Cloning Flutter ($FLUTTER_CHANNEL) → $FLUTTER_DIR"
    rm -rf "$FLUTTER_DIR"
    git clone https://github.com/flutter/flutter.git --depth 1 -b "$FLUTTER_CHANNEL" "$FLUTTER_DIR"
  fi
  export PATH="$FLUTTER_DIR/bin:$PATH"
  export FLUTTER_ROOT="$FLUTTER_DIR"
  # Non-interactive; avoid analytics prompt on CI.
  flutter config --no-analytics >/dev/null 2>&1 || true
  echo "==> flutter precache --ios"
  flutter precache --ios
}

if ! command -v flutter >/dev/null 2>&1; then
  install_flutter
else
  echo "==> flutter already on PATH: $(command -v flutter)"
  export FLUTTER_ROOT="$(dirname "$(dirname "$(command -v flutter)")")"
fi

echo "==> flutter --version"
flutter --version

echo "==> flutter pub get (writes ios/Flutter/Generated.xcconfig + FLUTTER_ROOT)"
flutter pub get

if ! command -v pod >/dev/null 2>&1; then
  echo "==> Installing CocoaPods via Homebrew"
  export HOMEBREW_NO_AUTO_UPDATE=1
  brew install cocoapods
fi

echo "==> pod install"
pushd ios >/dev/null
pod install --repo-update=false || pod install
popd >/dev/null

# Persist Flutter for later Xcode Cloud script phases in this build.
if [ -n "${CI_WORKSPACE:-}${CI_PRIMARY_REPOSITORY_PATH:-}" ]; then
  {
    echo "export PATH=\"$FLUTTER_DIR/bin:\$PATH\""
    echo "export FLUTTER_ROOT=\"$FLUTTER_DIR\""
  } >> "$HOME/.zoro_xcode_cloud_env"
  echo "==> Wrote $HOME/.zoro_xcode_cloud_env"
fi

echo "==> iOS tree ready for xcodebuild / Xcode Cloud."
echo "    FLUTTER_ROOT=$FLUTTER_ROOT"
