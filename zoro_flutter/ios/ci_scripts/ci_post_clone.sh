#!/bin/sh
# Xcode Cloud looks here because it sits next to Runner.xcworkspace.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$SCRIPT_DIR/../../scripts/xcode_cloud_post_clone.sh"
