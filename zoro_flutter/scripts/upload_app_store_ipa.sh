#!/usr/bin/env bash
# Upload the latest IPA/archive to App Store Connect / TestFlight.
#
# Auth preference:
#   1) App Store Connect API key via env (ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH or
#      APP_STORE_CONNECT_API_KEY_ID / APP_STORE_CONNECT_ISSUER_ID / APP_STORE_CONNECT_API_KEY_P8)
#   2) Apple ID signed into Xcode (xcodebuild -exportArchive destination=upload)
#   3) Open Transporter as a last resort
#
# Usage:
#   ./scripts/upload_app_store_ipa.sh
#   ./scripts/upload_app_store_ipa.sh build/ios/archive/Runner.xcarchive
#   ./scripts/upload_app_store_ipa.sh build/ios/ipa/zoro_flutter.ipa
set -euo pipefail

cd "$(dirname "$0")/.."

INPUT="${1:-}"
IPA=""
ARCHIVE=""

if [[ -n "${INPUT}" ]]; then
  if [[ "${INPUT}" == *.ipa ]]; then
    IPA="${INPUT}"
  elif [[ -d "${INPUT}" ]]; then
    ARCHIVE="${INPUT}"
  fi
fi

if [[ -z "${IPA}" ]]; then
  IPA="$(ls -1t build/ios/ipa/*.ipa 2>/dev/null | head -n 1 || true)"
fi
if [[ -z "${ARCHIVE}" ]]; then
  ARCHIVE="$(ls -1td build/ios/archive/*.xcarchive 2>/dev/null | head -n 1 || true)"
fi

KEY_ID="${ASC_KEY_ID:-${APP_STORE_CONNECT_API_KEY_ID:-}}"
ISSUER_ID="${ASC_ISSUER_ID:-${APP_STORE_CONNECT_ISSUER_ID:-}}"
KEY_PATH="${ASC_KEY_PATH:-}"
KEY_P8_CONTENT="${APP_STORE_CONNECT_API_KEY_P8:-${ASC_KEY_P8:-}}"

cleanup_key=""
cleanup() {
  if [[ -n "${cleanup_key}" && -f "${cleanup_key}" ]]; then
    rm -f "${cleanup_key}"
  fi
}
trap cleanup EXIT

resolve_api_key_path() {
  if [[ -n "${KEY_PATH}" && -f "${KEY_PATH}" ]]; then
    echo "${KEY_PATH}"
    return 0
  fi
  if [[ -n "${KEY_ID}" && -f "${HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8" ]]; then
    echo "${HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
    return 0
  fi
  if [[ -n "${KEY_ID}" && -f "/tmp/AuthKey_${KEY_ID}.p8" ]]; then
    echo "/tmp/AuthKey_${KEY_ID}.p8"
    return 0
  fi
  if [[ -n "${KEY_ID}" && -n "${KEY_P8_CONTENT}" ]]; then
    mkdir -p "${HOME}/.appstoreconnect/private_keys"
    cleanup_key="${HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8"
    printf '%s\n' "${KEY_P8_CONTENT}" > "${cleanup_key}"
    chmod 600 "${cleanup_key}"
    echo "${cleanup_key}"
    return 0
  fi
  return 1
}

upload_ipa_with_api_key() {
  local ipa_path="$1"
  local key_file
  key_file="$(resolve_api_key_path)" || return 1
  echo "Uploading IPA via App Store Connect API key ${KEY_ID}: ${ipa_path}"
  # altool looks for AuthKey_<id>.p8 in ~/.appstoreconnect/private_keys or ./private_keys
  xcrun altool --upload-app \
    --type ios \
    -f "${ipa_path}" \
    --apiKey "${KEY_ID}" \
    --apiIssuer "${ISSUER_ID}"
}

upload_archive_with_xcode_account() {
  local archive_path="$1"
  local export_plist export_dir
  export_plist="$(mktemp -t ExportOptions-upload).plist"
  export_dir="$(mktemp -d -t zoro-ipa-upload)"
  cat > "${export_plist}" <<'EOF'
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
  echo "Uploading archive via Xcode account: ${archive_path}"
  if xcodebuild -exportArchive \
    -archivePath "${archive_path}" \
    -exportOptionsPlist "${export_plist}" \
    -exportPath "${export_dir}" \
    -allowProvisioningUpdates; then
    rm -f "${export_plist}"
    rm -rf "${export_dir}"
    return 0
  fi
  rm -f "${export_plist}"
  rm -rf "${export_dir}"
  return 1
}

if [[ -n "${KEY_ID}" && -n "${ISSUER_ID}" && -n "${IPA}" && -f "${IPA}" ]]; then
  if upload_ipa_with_api_key "${IPA}"; then
    echo "Upload finished (API key). Check TestFlight processing (often 5–30 min)."
    exit 0
  fi
  echo "API key upload failed; trying Xcode account…" >&2
fi

if [[ -n "${ARCHIVE}" && -d "${ARCHIVE}" ]]; then
  if upload_archive_with_xcode_account "${ARCHIVE}"; then
    echo "Upload finished (Xcode account). Check TestFlight processing (often 5–30 min)."
    exit 0
  fi
  echo "Xcode account upload failed (sign into Xcode → Settings → Accounts)." >&2
fi

if [[ -n "${IPA}" && -f "${IPA}" && -d "/Applications/Transporter.app" ]]; then
  echo "Opening Transporter with ${IPA}"
  open -a Transporter "${IPA}"
  echo "Click Deliver in Transporter (sign in with Apple ID if asked)."
  exit 0
fi

echo "No upload method succeeded. Need one of:" >&2
echo "  - ASC API key env (APP_STORE_CONNECT_API_KEY_ID/ISSUER_ID/API_KEY_P8)" >&2
echo "  - Apple ID signed into Xcode with App Store Connect access" >&2
echo "  - Transporter.app + a local IPA" >&2
exit 1
