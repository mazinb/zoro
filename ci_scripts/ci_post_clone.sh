#!/bin/sh
# Monorepo-root fallback: some Xcode Cloud workflows resolve ci_scripts from the Git root.
# Prefer zoro_flutter/ios/ci_scripts/ (next to the workspace) when ASC is pointed at that project.
set -e

REPO_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)}"
TARGET="$REPO_ROOT/zoro_flutter/ios/ci_scripts/ci_post_clone.sh"

if [ ! -x "$TARGET" ] && [ -f "$TARGET" ]; then
  chmod +x "$TARGET"
fi

if [ ! -f "$TARGET" ]; then
  echo "error: missing $TARGET" >&2
  exit 1
fi

echo "==> Delegating to $TARGET"
exec /bin/sh "$TARGET"
