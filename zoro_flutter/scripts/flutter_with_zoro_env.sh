#!/usr/bin/env bash
# Runs `flutter` with zoro-app/.env.local as dart-defines when the file exists (local testing only).
# App Store / release: call `flutter` directly without this script so no keys are compiled in.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/zoro-app/.env.local"

cd "${ROOT}"

args=("$@")
if [[ -f "${ENV_FILE}" ]]; then
  have_from_file=false
  for a in "${args[@]}"; do
    if [[ "${a}" == --dart-define-from-file=* ]] || [[ "${a}" == --dart-define-from-file ]]; then
      have_from_file=true
      break
    fi
  done
  if ! ${have_from_file}; then
    args=(--dart-define-from-file="${ENV_FILE}" "${args[@]}")
  fi
fi

exec flutter "${args[@]}"
