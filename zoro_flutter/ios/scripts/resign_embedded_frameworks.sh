#!/usr/bin/env bash
# Re-sign embedded *.framework bundles under Runner.app so physical-device install succeeds.
# Newer Xcode / iOS sometimes reject pre-signed Dart native bundles (e.g. objective_c.framework)
# with MIInstallerErrorDomain 13 / 0xe8008014 until they are signed with the app’s team identity.

set -euo pipefail

case "${SDK_NAME:-}" in
iphonesimulator*) exit 0 ;;
esac

IDENT="${EXPANDED_CODE_SIGN_IDENTITY:-}"
if [[ -z "${IDENT}" || "${IDENT}" == "-" ]]; then
  echo "resign_embedded_frameworks: skip (no EXPANDED_CODE_SIGN_IDENTITY)"
  exit 0
fi

APP="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"
if [[ ! -d "${APP}" ]]; then
  echo "resign_embedded_frameworks: skip (missing app: ${APP})"
  exit 0
fi

# Deepest paths first so nested *.framework are signed before parents that embed them.
while IFS= read -r fw; do
  rel="${fw#"${APP}/"}"
  echo "resign_embedded_frameworks: ${rel}"
  /usr/bin/codesign --force --sign "${IDENT}" --timestamp=none \
    --preserve-metadata=identifier,entitlements,flags \
    "${fw}"
done < <(find "${APP}" -depth -type d -name '*.framework' 2>/dev/null)
