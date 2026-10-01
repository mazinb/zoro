#!/bin/sh
# Used when Xcode Cloud resolves ci_scripts from the Git repository root.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$SCRIPT_DIR/../zoro_flutter/scripts/xcode_cloud_post_clone.sh"
