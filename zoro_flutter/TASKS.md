# Zoro Flutter — tasks

Privacy-first finance on device. Production API: **getzoro.com**. On-device storage: [`../zoro-app/README.md` → On-device data layout](../zoro-app/README.md#on-device-data-layout).

---

## Next

- [x] **Home summary helper** — daily on-app-open rotation (assets / liabilities / cashflow / context / goals); Apple on-device prompt budget; Home (i) sheet for focus toggles + last run.
- [x] **Onboarding (v1)** — 3-step first-run: USD + 2 FX picks, income (salary/bonus/RSU/tax), 4× expense MCQ + optional Apple on-device note. Tab ? how-it-works + Reddit footer.
- [x] **Onboarding demo ledger** — optional demo assets/liabilities (condo, US brokerage, India fund, cash, mortgage, car loan) via Apple on-device customization from onboarding currencies; clear untouched rows from header bolt. Expense estimate currency picker (USD + FX picks); `expenseEstimateCurrency` on export/import.
- [ ] **Onboarding (v2)** — split slider, retirement date vs invest /mo (Goals editor retire panel).

---

## Shipped (Corpus backtest)

- **Corpus backtest** replaces Goals helper “Withdrawal & corpus” MCQ: year-by-year table (expense, corpus start/end, blended returns, monthly draw) against historical equity/debt datasets.
- Default **S&P 500** + **US 1Y CD/FD** (1995–2024); also **UAE FD proxy** and **India 1Y FD** builtins. Bond index kept optional. Cash/FD leg uses coupon-style rates, not bond total return. Debt/equity split slider; withdrawal rate tap + slider (same 1–10% ladder as retirement editor).
- **Settings → Data → Historical returns** export/import for custom return series (merge or replace).

---

## Ship checklist

- [x] `cd zoro_flutter && dart analyze` — no warnings you care about
- [x] `flutter test` — green
- [ ] Device smoke: Home → Ledger → Context → Goals → Settings → Usage (subscription + consent flows)
- [ ] Release: prod bundle `com.getzoro.zoroFlutter`, `API_BASE_URL` = production, no secrets in `--dart-define-from-file`
- [ ] App Store Connect: Privacy Policy URL + Terms link in description; Notes for reviewer (consent + SubscriptionStoreView)

**Apple resubmission (Guidelines 5.1.1/5.1.2 + 3.1.2):**
- In-app consent sheet before Cloud AI / on-device AI first use; recorded in `mobile_ai_consents`
- Settings → Usage: `SubscriptionStoreView` (title, term, price, Terms, Privacy) + legal links
- Legal pages at https://www.getzoro.com/legal?tab=terms and ?tab=privacy updated June 9, 2026 (Terms: Apple App Store additional terms)

**iOS:** `./scripts/setup_ios.sh` → open `ios/Runner.xcworkspace` → Team → device. CLI: `flutter run -d <id> --dart-define=API_BASE_URL=https://www.getzoro.com`. Signing / `objective_c` pin: see **iOS notes** below.

---

## Shipped (Goals retire tradeoff)

- **Corpus** (base) + **surplus** (separate): agent buffer % seeds surplus; year chips add contribution FV to surplus; holdings above corpus raise surplus.
- **Invest /mo** vs **Need /mo** vs retire date; progress bar shows surplus tail.
- Allocation notes sheet; savings % of salary; cashflow savings lines link to assets/liabilities.

Helper hub: `goals_helper_hub_page.dart` + `goals_structured_sections.dart`. Tests: `test/goals_calculator_test.dart`, `test/goals_allocation_test.dart`.

---

## App surface

`MainScaffold`: Home, Ledger, Context, Goals, Settings.

---

## Notifications (summary)

Local only (`flutter_local_notifications`). Init after engine in `AppDelegate`, not `main()`. Master toggle in Settings; per-domain cadence **Off** to silence. Daily slot + rotation id `900`. Logs: `[ZoroNotif]` in Xcode console. Tests: `test/notifications_test.dart`.

---

## Data export / import

Settings → Helpers → Data. Tests: `test/app_state_transfer_test.dart`, `test/app_state_split_store_test.dart`.

---

## iOS notes

1. Xcode + CocoaPods → `./scripts/setup_ios.sh`
2. `open ios/Runner.xcworkspace` — Signing → Team
3. `flutter run -d <id> --dart-define=API_BASE_URL=...`
4. **objective_c / device install:** `path_provider_foundation: 2.5.1` in `dependency_overrides`; `ios/scripts/resign_embedded_frameworks.sh` after embed Pods
5. **CI / Xcode Cloud:** `./scripts/ci_ios_prepare.sh` from `zoro_flutter`

| Flavor | Bundle / applicationId |
|--------|-------------------------|
| Prod | `com.getzoro.zoroFlutter` |
| Dev | `com.getzoro.zoroFlutter.dev` |
