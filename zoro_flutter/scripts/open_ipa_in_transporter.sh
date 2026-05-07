#!/usr/bin/env bash
# Opens the latest App Store IPA in Apple Transporter (sign in with Apple ID in the app; 2FA as usual).
# Does not rebuild. Usage:
#   ./scripts/open_ipa_in_transporter.sh
#   ./scripts/open_ipa_in_transporter.sh /path/to/Runner.ipa
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

IPA="${1:-}"
if [[ -z "${IPA}" ]]; then
  IPA="$(ls -1t build/ios/ipa/*.ipa 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "${IPA}" || ! -f "${IPA}" ]]; then
  echo "No IPA found. Build one first, or pass the file path:" >&2
  echo "  $0 /path/to/your.ipa" >&2
  exit 1
fi

IPA="$(cd "$(dirname "${IPA}")" && pwd)/$(basename "${IPA}")"
echo "IPA: ${IPA}"

if [[ -d "/Applications/Transporter.app" ]]; then
  open -a Transporter "${IPA}"
  echo "Transporter should open with this package. Click Deliver and sign in with your Apple ID if asked."
else
  echo "Transporter is not in /Applications. Install from:" >&2
  echo "  https://apps.apple.com/app/transporter/id1450874784" >&2
  open -R "${IPA}"
  exit 1
fi
