#!/usr/bin/env bash
# Verify prod AAB has no exact-alarm permissions before Play upload.
set -euo pipefail

cd "$(dirname "$0")/.."
AAB="${1:-$(ls -1t build/app/outputs/bundle/prodRelease/*.aab 2>/dev/null | head -n 1)}"

if [[ -z "${AAB}" || ! -f "${AAB}" ]]; then
  echo "Usage: $0 [path/to/app-prod-release.aab]"
  echo "Build first: ./scripts/build_play_aab.sh"
  exit 1
fi

BT="/tmp/bundletool.jar"
if [[ ! -f "${BT}" ]]; then
  curl -sL -o "${BT}" "https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar"
fi

MANIFEST="$(java -jar "${BT}" dump manifest --bundle="${AAB}" 2>&1)"
echo "Bundle: ${AAB}"
echo "${MANIFEST}" | grep -E 'versionCode|versionName' | head -2

if echo "${MANIFEST}" | grep -qE 'USE_EXACT_ALARM|SCHEDULE_EXACT_ALARM'; then
  echo ""
  echo "FAIL: exact-alarm permission found in shipped manifest:"
  echo "${MANIFEST}" | grep -E 'USE_EXACT_ALARM|SCHEDULE_EXACT_ALARM'
  exit 1
fi

if echo "${MANIFEST}" | grep -q 'ScheduledNotificationBootReceiver\|ScheduledNotificationReceiver'; then
  echo ""
  echo "WARN: flutter_local_notifications alarm receivers still in manifest"
  echo "${MANIFEST}" | grep 'flutterlocalnotifications'
fi

echo ""
echo "OK: no USE_EXACT_ALARM / SCHEDULE_EXACT_ALARM in this AAB."
