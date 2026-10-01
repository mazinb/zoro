#!/bin/sh
# Legacy location. Xcode Cloud uses ios/ci_scripts (next to the workspace) or the repo root.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$SCRIPT_DIR/../scripts/xcode_cloud_post_clone.sh"
