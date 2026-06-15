#!/usr/bin/env bash
# Generate Play Store upload keystore (run once; keep passwords safe).
set -euo pipefail

cd "$(dirname "$0")/.."
ANDROID_DIR="android"
KEYSTORE="${ANDROID_DIR}/upload-keystore.jks"
PROPS="${ANDROID_DIR}/key.properties"

if [[ -f "${KEYSTORE}" ]]; then
  echo "Keystore already exists: ${KEYSTORE}"
  exit 0
fi

KEYTOOL=""
for candidate in \
  "${JAVA_HOME:-}/bin/keytool" \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" \
  "$(command -v keytool 2>/dev/null || true)"; do
  if [[ -n "${candidate}" && -x "${candidate}" ]]; then
    KEYTOOL="${candidate}"
    break
  fi
done

if [[ -z "${KEYTOOL}" ]]; then
  echo "keytool not found. Install JDK or Android Studio, then re-run this script."
  exit 1
fi

read -r -s -p "Keystore password (store + key): " STORE_PASS
echo
read -r -s -p "Confirm password: " STORE_PASS2
echo
if [[ "${STORE_PASS}" != "${STORE_PASS2}" ]]; then
  echo "Passwords do not match."
  exit 1
fi

"${KEYTOOL}" -genkey -v \
  -keystore "${KEYSTORE}" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload \
  -storepass "${STORE_PASS}" -keypass "${STORE_PASS}" \
  -dname "CN=Zoro, OU=Mobile, O=GetZoro, C=US"

cat > "${PROPS}" <<EOF
storePassword=${STORE_PASS}
keyPassword=${STORE_PASS}
keyAlias=upload
storeFile=../upload-keystore.jks
EOF

echo "Created ${KEYSTORE} and ${PROPS} (both gitignored)."
echo "Back up the keystore and passwords — Play Console requires the same key for all updates."
