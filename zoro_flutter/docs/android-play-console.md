# Google Play Console setup

Package: **`com.getzoro.zoroFlutter`** (prod flavor).

## Current status

- **Internal / open testing** — track is set up; test link shared for an earlier build
- **Production** — not yet published; finish on a physical Android device (IAP, on-device AI, screenshots)
- **Signing** — run `./scripts/generate_android_keystore.sh` locally; back up `upload-keystore.jks`

## 1. Create / verify the app

Play Console → app **Zoro** with package `com.getzoro.zoroFlutter`.

Dev side-by-side: `com.getzoro.zoroFlutter.dev` (local builds only).

## 2. Exact-alarm / USE_EXACT_ALARM (Play policy)

If Play blocks upload with `USE_EXACT_ALARM`:

1. Run `./scripts/verify_play_aab.sh` locally — must print **OK**
2. **Deactivate old releases on every track** (Internal, Closed, Open) — an older AAB with the permission keeps the flag red under **Policy → App content**
3. Upload only the latest AAB (`versionCode` 13+)
4. Do **not** declare Alarm clock / Calendar — Zoro is finance

## 3. Upload signing

1. `./scripts/build_play_aab.sh` → `build/app/outputs/bundle/prodRelease/*.aab`
2. Upload to **Internal testing** (or promote when ready)
3. Enable **Google Play App Signing** on first upload

## 3. In-app products

| Product ID | Type |
|------------|------|
| `com.getzoro.pro_monthly_sub` | Subscription (monthly Pro) |
| `com.getzoro.credit_1` | Consumable (1 import credit) |

Must match [`lib/core/iap/iap_product_ids.dart`](../lib/core/iap/iap_product_ids.dart).

## 4. License testers

**Settings → License testing** → add Google accounts on test devices.

Test: Pro subscribe, credit buy, restore, **Manage subscription** (opens Play Store).

## 5. Device smoke (physical Android)

See Android section in [`TASKS.md`](../TASKS.md). Critical paths:

- Onboarding → Cloud AI consent (only if Gemini Nano unavailable)
- Settings → Usage: on-device row + Cloud toggle
- PDF import with Cloud AI off (on-device fallback on supported device)
- Photo import with Cloud AI on
- ✨ helper on Ledger / Context / Goals
- Notifications, export/import

## 6. Store listing (before production)

- Screenshots, descriptions, feature graphic
- Privacy policy: https://www.getzoro.com/legal?tab=privacy
- **Data safety** — see plan / legal (local ledger; Cloud AI → Google; on-device stays on device)

## 7. Go public

Set in Vercel:

```bash
NEXT_PUBLIC_ANDROID_APP_URL=https://play.google.com/store/apps/details?id=com.getzoro.zoroFlutter
```

Or use the open-testing link until production is approved.
