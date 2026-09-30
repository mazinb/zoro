#!/bin/sh
# Xcode Cloud post-clone — lives next to the Xcode project (Flutter + Apple recommended).
# Monorepo: Git root is `zoro/`; Flutter app is `zoro_flutter/`.
#
# Docs: https://docs.flutter.dev/deployment/cd#xcode-cloud
set -e

# Default cwd for this script is ios/ci_scripts/.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

# Prefer Apple's env var; fall back to walking up from this file.
REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-}"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
fi

FLUTTER_APP=""
if [ -f "$REPO_ROOT/zoro_flutter/pubspec.yaml" ]; then
  FLUTTER_APP="$REPO_ROOT/zoro_flutter"
elif [ -f "$REPO_ROOT/pubspec.yaml" ] && [ -d "$REPO_ROOT/ios" ]; then
  # Standalone flutter package as repo root
  FLUTTER_APP="$REPO_ROOT"
else
  echo "error: cannot find Flutter app (looked for zoro_flutter/ or ios/ under $REPO_ROOT)" >&2
  exit 1
fi

echo "==> CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-}"
echo "==> Flutter app: $FLUTTER_APP"

cd "$FLUTTER_APP"
bash ./scripts/ci_ios_prepare.sh

exit 0
