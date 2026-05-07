# Source this from the Xcode "Run Script" phase (do not execute as a standalone command).
#
# We only want local keys compiled in for **on-device runs** (Xcode ▶ Run),
# and never for Archive/App Store builds.
#
# Heuristics:
# - Always allow Debug.
# - Allow Release only when building for running on a physical device:
#   - ACTION=build (Archive uses ACTION=install / archive)
#   - SDK_NAME starts with iphoneos (device, not simulator)
_cfg="${CONFIGURATION:-}"
_action="${ACTION:-}"
_sdk="${SDK_NAME:-}"

if [ "${_cfg}" = "Debug" ]; then
  :
elif [ "${_cfg}" = "Release" ] && [ "${_action}" = "build" ] && echo "${_sdk}" | grep -q '^iphoneos'; then
  :
else
  return 0
fi

# SRCROOT is ios/; zoro-app is sibling of zoro_flutter (repo root).
ENV_FILE="${SRCROOT}/../../zoro-app/.env.local"
if [ ! -f "${ENV_FILE}" ]; then
  return 0
fi

_append_dart_define_from_env() {
  _key="$1"
  _line=$(grep -E "^${_key}=" "${ENV_FILE}" 2>/dev/null | tail -n 1 || true)
  [ -z "${_line}" ] && return 0
  _val=${_line#*=}
  _val=$(printf '%s' "${_val}" | tr -d '\r')
  case ${_val} in
  \"*)
    _val=${_val#\"}
    _val=${_val%\"}
    ;;
  \'*)
    _val=${_val#\'}
    _val=${_val%\'}
    ;;
  esac
  [ -z "${_val}" ] && return 0
  _b64=$(printf '%s' "${_key}=${_val}" | base64 | tr -d '\n')
  if [ -n "${DART_DEFINES:-}" ]; then
    DART_DEFINES="${DART_DEFINES},${_b64}"
  else
    DART_DEFINES="${_b64}"
  fi
  export DART_DEFINES
}

_append_dart_define_literal() {
  _kv="$1"
  _b64=$(printf '%s' "${_kv}" | base64 | tr -d '\n')
  if [ -n "${DART_DEFINES:-}" ]; then
    DART_DEFINES="${DART_DEFINES},${_b64}"
  else
    DART_DEFINES="${_b64}"
  fi
  export DART_DEFINES
}

_append_dart_define_from_env "OPENAI_API_KEY"
_append_dart_define_from_env "GEMINI_API_KEY"

# Let the app know it's safe to autofill/persist compile-time keys (e.g. Release-on-device runs).
_append_dart_define_literal "ZORO_LOCAL_KEYS=true"
