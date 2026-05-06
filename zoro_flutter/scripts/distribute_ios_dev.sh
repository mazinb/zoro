#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Builds an iOS IPA and uploads to Firebase App Distribution.
# Requires Xcode + codesigning and Firebase CLI auth on this machine.

APP_ID="1:637864665773:ios:40fe8fe60145a8367e9c24" # com.getzoro.zoroFlutter.dev

flutter build ipa --export-method ad-hoc --debug

IPA_PATH="$(ls -1t build/ios/ipa/*.ipa | head -n 1)"

npx -y firebase-tools@latest appdistribution:distribute \
  "${IPA_PATH}" \
  --app "${APP_ID}"
