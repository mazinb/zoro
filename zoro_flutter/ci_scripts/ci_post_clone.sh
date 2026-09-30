#!/bin/sh
# Legacy location (package root). Prefer ios/ci_scripts/ for Xcode Cloud.
# Kept so older workflow notes still work.
set -e
cd "$(dirname "$0")/../ios/ci_scripts"
exec /bin/sh ./ci_post_clone.sh
