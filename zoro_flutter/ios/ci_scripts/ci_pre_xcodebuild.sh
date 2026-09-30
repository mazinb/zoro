#!/bin/sh
# Optional: runs before xcodebuild. Ensure Flutter env from post-clone is visible.
set -e

if [ -f "$HOME/.zoro_xcode_cloud_env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.zoro_xcode_cloud_env"
fi

# Archive builds use release API default in AppEnv (https://www.getzoro.com).
# Override in App Store Connect → Xcode Cloud → Environment if needed:
#   API_BASE_URL=https://www.getzoro.com
if [ -n "${API_BASE_URL:-}" ]; then
  echo "==> API_BASE_URL=$API_BASE_URL (set in Xcode Cloud env; inject via Generated if needed)"
fi

exit 0
