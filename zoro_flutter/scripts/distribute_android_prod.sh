#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Builds an Android release APK and uploads to Firebase App Distribution.
# Requires Firebase CLI auth on this machine.

APP_ID="1:637864665773:android:228870fcb891b56e7e9c24" # com.getzoro.zoroFlutter

flutter build apk --flavor prod -t lib/main.dart --release

npx -y firebase-tools@latest appdistribution:distribute \
  "build/app/outputs/flutter-apk/app-prod-release.apk" \
  --app "${APP_ID}"
