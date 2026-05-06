#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Builds an iOS IPA and uploads to Firebase App Distribution.
# Requires Xcode + codesigning and Firebase CLI auth on this machine.

APP_ID="1:637864665773:ios:e09c58719130eee07e9c24" # com.getzoro.zoroFlutter

flutter build ipa --export-method ad-hoc --release

IPA_PATH="$(ls -1t build/ios/ipa/*.ipa | head -n 1)"

npx -y firebase-tools@latest appdistribution:distribute \
  "${IPA_PATH}" \
  --app "${APP_ID}"
