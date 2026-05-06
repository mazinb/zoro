#!/bin/sh
# Xcode Cloud when the Git repository root is this Flutter app (not the monorepo).
set -e
cd "$(dirname "$0")/.."
./scripts/ci_ios_prepare.sh
