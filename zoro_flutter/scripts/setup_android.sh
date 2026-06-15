#!/usr/bin/env bash
# Local Android dev setup for Zoro (device or emulator).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Zoro Android setup"
echo "=================="
echo ""
echo "Prerequisites:"
echo "  • Android Studio + SDK (API 31+)"
echo "  • Android SDK Command-line Tools (SDK Manager → SDK Tools → Android SDK Command-line Tools)"
echo "    Without this, flutter build appbundle may finish with a false 'strip debug symbols' error."
echo "  • Physical device recommended for Gemini Nano / AICore testing"
echo "  • Play internal testing: enroll device Google account as license tester"
echo ""
echo "On-device AI (Gemini Nano):"
echo "  • Supported Pixel / Samsung with AICore system app"
echo "  • Optional: Android AICore beta program + Developer Options → on-device GenAI"
echo "  • See docs/android-on-device-ai.md"
echo ""

flutter pub get

if [[ ! -f android/key.properties ]]; then
  echo "No android/key.properties — run ./scripts/generate_android_keystore.sh before release builds."
else
  echo "Release signing: android/key.properties found."
fi

echo ""
echo "Run dev flavor:"
echo "  flutter run -d <device_id> --flavor dev --dart-define=API_BASE_URL=https://www.getzoro.com"
echo ""
echo "Release AAB:"
echo "  ./scripts/build_play_aab.sh"
