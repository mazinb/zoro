#!/bin/sh
# Xcode Cloud: runs after clone. Ensures Flutter + CocoaPods artifacts exist before xcodebuild.
# If your Xcode Cloud workflow uses a different app directory, adjust the `cd` path.
set -e
cd zoro_flutter
./scripts/ci_ios_prepare.sh
