#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Builds an Android APK and uploads to Firebase App Distribution.
# Requires Firebase CLI auth on this machine.

APP_ID="1:637864665773:android:83b22723e7965ca27e9c24" # com.getzoro.zoroFlutter.dev

flutter build apk --flavor dev -t lib/main.dart --release

npx -y firebase-tools@latest appdistribution:distribute \
  "build/app/outputs/flutter-apk/app-dev-release.apk" \
  --app "${APP_ID}"
