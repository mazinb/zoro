#!/usr/bin/env bash
# Shared prepare for Xcode Cloud / CI: install Flutter if needed, pub get, pod install.
# Expects to run with cwd = zoro_flutter (Flutter package root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FLUTTER_DIR="${FLUTTER_DIR:-$HOME/flutter}"
# Pin the SDK: Xcode Cloud's Flutter stable tip (3.47+) rejects pdfrx_engine 0.3.9
# nullability that builds cleanly on 3.41.6 (matches this Mac / TestFlight CI).
FLUTTER_VERSION="${FLUTTER_VERSION:-3.41.6}"

install_flutter() {
  local need_clone=1
  if [ -x "$FLUTTER_DIR/bin/flutter" ]; then
    local existing
    existing="$("$FLUTTER_DIR/bin/flutter" --version 2>/dev/null | head -1 || true)"
    if echo "$existing" | grep -q "Flutter $FLUTTER_VERSION"; then
      echo "==> Using existing Flutter $FLUTTER_VERSION at $FLUTTER_DIR"
      need_clone=0
    else
      echo "==> Existing Flutter is not $FLUTTER_VERSION ($existing) — recloning"
    fi
  fi
  if [ "$need_clone" -eq 1 ]; then
    echo "==> Cloning Flutter $FLUTTER_VERSION → $FLUTTER_DIR"
    rm -rf "$FLUTTER_DIR"
    git clone https://github.com/flutter/flutter.git --depth 1 -b "$FLUTTER_VERSION" "$FLUTTER_DIR"
  fi
  export PATH="$FLUTTER_DIR/bin:$PATH"
  export FLUTTER_ROOT="$FLUTTER_DIR"
  # Non-interactive; avoid analytics prompt on CI.
  flutter config --no-analytics >/dev/null 2>&1 || true
  echo "==> flutter precache --ios"
  flutter precache --ios
}

# Xcode Cloud / clean CI: always install the pinned SDK into FLUTTER_DIR.
# Local Mac with flutter already on PATH can still use that install unless
# FORCE_FLUTTER_PIN=1 (Xcode Cloud sets CI_* vars).
if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}${CI_WORKSPACE:-}${FORCE_FLUTTER_PIN:-}" ]; then
  install_flutter
elif ! command -v flutter >/dev/null 2>&1; then
  install_flutter
else
  echo "==> flutter already on PATH: $(command -v flutter)"
  export FLUTTER_ROOT="$(dirname "$(dirname "$(command -v flutter)")")"
fi

echo "==> flutter --version"
flutter --version
# Fail closed on Xcode Cloud if the pin did not stick.
if [ -n "${CI_PRIMARY_REPOSITORY_PATH:-}${CI_WORKSPACE:-}" ]; then
  flutter --version | head -1 | grep -q "Flutter $FLUTTER_VERSION" || {
    echo "error: expected Flutter $FLUTTER_VERSION on Xcode Cloud, got:" >&2
    flutter --version >&2
    exit 1
  }
fi

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
