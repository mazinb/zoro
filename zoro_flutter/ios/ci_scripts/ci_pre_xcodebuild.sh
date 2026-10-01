#!/bin/sh
# Runs before xcodebuild on Xcode Cloud. Restore Flutter env from post-clone.
set -e

if [ -f "$HOME/.zoro_xcode_cloud_env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.zoro_xcode_cloud_env"
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-}"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
fi

FLUTTER_APP=""
if [ -f "$REPO_ROOT/zoro_flutter/pubspec.yaml" ]; then
  FLUTTER_APP="$REPO_ROOT/zoro_flutter"
elif [ -f "$REPO_ROOT/pubspec.yaml" ] && [ -d "$REPO_ROOT/ios" ]; then
  FLUTTER_APP="$REPO_ROOT"
fi

GEN=""
if [ -n "$FLUTTER_APP" ] && [ -f "$FLUTTER_APP/ios/Flutter/Generated.xcconfig" ]; then
  GEN="$FLUTTER_APP/ios/Flutter/Generated.xcconfig"
fi

if [ -f "$GEN" ]; then
  # shellcheck disable=SC2002
  ROOT_FROM_GEN="$(cat "$GEN" | sed -n 's/^FLUTTER_ROOT=//p' | head -n 1)"
  if [ -n "$ROOT_FROM_GEN" ]; then
    export FLUTTER_ROOT="$ROOT_FROM_GEN"
    export PATH="$FLUTTER_ROOT/bin:$PATH"
  fi
fi

if [ -z "${FLUTTER_ROOT:-}" ] || [ ! -x "${FLUTTER_ROOT}/bin/flutter" ]; then
  if [ -x "$HOME/flutter/bin/flutter" ]; then
    export FLUTTER_ROOT="$HOME/flutter"
    export PATH="$FLUTTER_ROOT/bin:$PATH"
  fi
fi

echo "==> ci_pre_xcodebuild"
echo "    CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-}"
echo "    FLUTTER_APP=${FLUTTER_APP:-}"
echo "    FLUTTER_ROOT=${FLUTTER_ROOT:-}"
echo "    flutter=$(command -v flutter || echo missing)"

if [ -z "${FLUTTER_ROOT:-}" ] || [ ! -f "$FLUTTER_ROOT/packages/flutter_tools/bin/xcode_backend.sh" ]; then
  echo "error: Flutter toolchain not ready for xcodebuild (FLUTTER_ROOT/xcode_backend.sh missing)." >&2
  echo "       Ensure ci_post_clone.sh / ci_ios_prepare.sh completed flutter pub get." >&2
  exit 1
fi

if [ -n "${API_BASE_URL:-}" ]; then
  echo "==> API_BASE_URL=$API_BASE_URL"
fi

exit 0
