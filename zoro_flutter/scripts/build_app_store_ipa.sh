#!/usr/bin/env bash
# One-shot release IPA for App Store Connect (Transporter, Xcode Organizer, or upload script).
# Requires: Xcode, Apple Developer Program, Runner signed for Release with Distribution cert.
#
# Optional env:
#   API_BASE_URL   default https://www.getzoro.com
#   BUILD_NAME     override CFBundleShortVersionString (else pubspec marketing version)
#   BUILD_NUMBER   override CFBundleVersion (else pubspec +N)
set -euo pipefail

cd "$(dirname "$0")/.."

API_BASE_URL="${API_BASE_URL:-https://www.getzoro.com}"
VERSION_LINE="$(grep '^version:' pubspec.yaml)"
PUB_VERSION="${VERSION_LINE#version: }"
PUB_VERSION="${PUB_VERSION// /}"
PUB_NAME="${PUB_VERSION%%+*}"
PUB_NUMBER="${PUB_VERSION##*+}"
BUILD_NAME="${BUILD_NAME:-$PUB_NAME}"
BUILD_NUMBER="${BUILD_NUMBER:-$PUB_NUMBER}"

echo "Building ${BUILD_NAME} (${BUILD_NUMBER}) with API_BASE_URL=${API_BASE_URL}"
echo "  pubspec: ${VERSION_LINE}"

flutter pub get
(
  cd ios
  pod install
)

flutter build ipa --release \
  --build-name="${BUILD_NAME}" \
  --build-number="${BUILD_NUMBER}" \
  --export-options-plist=ios/ExportOptions-appstore.plist \
  --dart-define=API_BASE_URL="${API_BASE_URL}"

IPA="$(ls -1t build/ios/ipa/*.ipa 2>/dev/null | head -n 1 || true)"
if [[ -n "${IPA}" ]]; then
  echo "IPA ready: ${IPA}"
  echo "Upload: ./scripts/upload_app_store_ipa.sh"
  echo "   or: ./scripts/open_ipa_in_transporter.sh \"${IPA}\""
else
  echo "Build finished but no IPA found under build/ios/ipa/"
  exit 1
fi
