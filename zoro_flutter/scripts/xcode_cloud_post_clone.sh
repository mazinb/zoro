#!/bin/sh
# Xcode Cloud post-clone for the monorepo.
# Workspace the workflow must use: zoro_flutter/ios/Runner.xcworkspace
# Git remote: https://github.com/mazinb/zoro.git
set -eu

# Pin to the Flutter revision recorded in zoro_flutter/.metadata (3.41.6 / Dart 3.11.4).
FLUTTER_VERSION="3.41.6"

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "${CI_PRIMARY_REPOSITORY_PATH:-$REPO_ROOT}"

export FLUTTER_SUPPRESS_ANALYTICS=true
export CI=true

if ! command -v flutter >/dev/null 2>&1; then
  echo "==> Installing Flutter ${FLUTTER_VERSION}"
  git clone https://github.com/flutter/flutter.git --depth 1 --branch "$FLUTTER_VERSION" "$HOME/flutter"
  export PATH="$PATH:$HOME/flutter/bin"
fi

echo "==> flutter precache --ios"
flutter precache --ios

cd zoro_flutter
exec ./scripts/ci_ios_prepare.sh
