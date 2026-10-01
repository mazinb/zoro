#!/usr/bin/env bash
# Upload the latest local Xcode archive to App Store Connect / TestFlight.
# Uses the Apple ID signed into Xcode (no App Store Connect API key required).
# Usage:
#   ./scripts/upload_app_store_ipa.sh
#   ./scripts/upload_app_store_ipa.sh build/ios/archive/Runner.xcarchive
set -euo pipefail

cd "$(dirname "$0")/.."

ARCHIVE="${1:-}"
if [[ -z "${ARCHIVE}" ]]; then
  ARCHIVE="$(ls -1td build/ios/archive/*.xcarchive 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "${ARCHIVE}" || ! -d "${ARCHIVE}" ]]; then
  echo "No archive found. Build one first:" >&2
  echo "  ./scripts/build_app_store_ipa.sh" >&2
  exit 1
fi

EXPORT_PLIST="$(mktemp -t ExportOptions-upload).plist"
EXPORT_DIR="$(mktemp -d -t zoro-ipa-upload)"
cleanup() {
  rm -f "${EXPORT_PLIST}"
  rm -rf "${EXPORT_DIR}"
}
trap cleanup EXIT

cat > "${EXPORT_PLIST}" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>upload</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>Y4KNF8GPPR</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
EOF

echo "Uploading archive: ${ARCHIVE}"
xcodebuild -exportArchive \
  -archivePath "${ARCHIVE}" \
  -exportOptionsPlist "${EXPORT_PLIST}" \
  -exportPath "${EXPORT_DIR}" \
  -allowProvisioningUpdates

echo "Upload finished. Check App Store Connect → TestFlight for processing (often 5–30 min)."
