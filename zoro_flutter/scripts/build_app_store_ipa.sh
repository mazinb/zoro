#!/usr/bin/env bash
# One-shot release IPA for App Store Connect (manual upload via Transporter or Xcode Organizer).
# Requires: Xcode, Apple Developer Program, Runner signed for Release with Distribution cert.
set -euo pipefail

cd "$(dirname "$0")/.."

API_BASE_URL="${API_BASE_URL:-https://www.getzoro.com}"

flutter pub get
(
  cd ios
  pod install
)

flutter build ipa --release \
  --export-options-plist=ios/ExportOptions-appstore.plist \
  --dart-define=API_BASE_URL="${API_BASE_URL}"

IPA="$(ls -1t build/ios/ipa/*.ipa 2>/dev/null | head -n 1 || true)"
if [[ -n "${IPA}" ]]; then
  echo "IPA ready: ${IPA}"
  echo "Upload: ./scripts/open_ipa_in_transporter.sh \"${IPA}\""
  open -R "${IPA}" 2>/dev/null || true
else
  echo "Build finished but no IPA found under build/ios/ipa/"
  exit 1
fi
