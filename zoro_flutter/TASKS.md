# Zoro Flutter — tasks

Privacy-first finance on device. Production API: **getzoro.com**. On-device storage: [`../zoro-app/README.md` → On-device data layout](../zoro-app/README.md#on-device-data-layout).

---

## Next

- [ ] **Onboarding** — first-run flow: income/expenses/assets, split slider, retirement date vs invest /mo (see Goals editor retire panel). Unlock reminders per existing `remindersOnboardingComplete` gates.

---

## Ship checklist

- [ ] `cd zoro_flutter && dart analyze` — no warnings you care about
- [ ] `flutter test` — green
- [ ] Device smoke: Home → Ledger → Context → Goals → Settings
- [ ] Release: prod bundle `com.getzoro.zoroFlutter`, `API_BASE_URL` = production, no secrets in `--dart-define-from-file`

**iOS:** `./scripts/setup_ios.sh` → open `ios/Runner.xcworkspace` → Team → device. CLI: `flutter run -d <id> --dart-define=API_BASE_URL=https://www.getzoro.com`. Signing / `objective_c` pin: see **iOS notes** below.

---

## Shipped (Goals retire tradeoff)

- **Corpus fixed** (expenses × SWR or manual); year chips move **calendar only**.
- **Invest /mo** = Goals split slider (`allocInvestmentsMonthly`).
- **Need /mo** = invest required to hit corpus by retire date (settings **invest return %**).
- **Update** = retire date from current invest /mo + corpus (return-aware).
- Allocation notes sheet; savings % of salary; cashflow savings lines link to assets/liabilities.

Helper hub: `goals_helper_hub_page.dart` + `goals_structured_sections.dart`. Tests: `test/goals_calculator_test.dart`, `test/goals_allocation_test.dart`.

---

## App surface

`MainScaffold`: Home, Ledger, Context, Goals, Settings. Chat history: `data/chats.json`.

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
