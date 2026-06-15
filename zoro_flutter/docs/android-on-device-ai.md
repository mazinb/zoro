# Android on-device AI (Gemini Nano)

**Status:** Implemented via AICore (`GeminiNanoPlugin.kt` + `zoro/android_gemini_nano` method channel).

Dart uses the same path as iOS: `LlmProvider.appleFoundation` → [`apple_foundation_channel.dart`](../lib/core/llm/apple_foundation_channel.dart) routes to Android on Android.

## Requirements (device)

1. **Supported hardware** — Pixel 8 Pro+, Pixel 9 series, select Samsung flagships (AICore must be installed)
2. **Android 12+** (API 31) — enforced in `android/app/build.gradle.kts`
3. **AICore system app** — Settings → Apps → “Android AICore”
4. **Optional beta:** [AICore experimental access](https://developer.android.com/ai/gemini-nano/experimental) for early devices
5. **Developer Options** → “Enable on-device GenAI Features” (when available)
6. **~4 GB storage** for model download (managed by AICore, not bundled in APK)

## Architecture

```mermaid
flowchart LR
  Dart[AppleFoundationChannel] --> AndroidCH[zoro/android_gemini_nano]
  AndroidCH --> Plugin[GeminiNanoPlugin.kt]
  Plugin --> AICore[AICore system service]
  AICore --> Nano[Gemini Nano]
```

| Method | Purpose |
|--------|---------|
| `getCapabilities` | Device / AICore availability |
| `getContextBudget` | 12k context, 2k reserved output (Gemini Nano limit) |
| `countTokens` | Character estimate (4 chars/token) |
| `complete` | System + user prompt → text |

## Fallback chain (same as iOS)

1. **Cloud AI** (if user consented) — preferred for photos
2. **On-device Gemini Nano** — PDF/text import, helpers
3. **User API keys** — OpenAI / Anthropic / Gemini cloud
4. Clear error → Settings → Usage

## Local dev

```bash
./scripts/setup_android.sh
flutter run -d <device> --flavor dev --dart-define=API_BASE_URL=https://www.getzoro.com
```

Verify in **Settings → Usage**: On-device row shows request count (not “unavailable”) after first helper run.

## Play Store note

On-device AI does not require extra Play permissions. Data safety form: on-device inference stays on device; Cloud AI row unchanged.
