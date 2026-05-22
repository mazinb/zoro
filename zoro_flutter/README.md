# Zoro Flutter

iOS-first Flutter client for [Zoro](https://www.getzoro.com). Local-first finance on device; optional LLM calls use keys in Settings (never sent to Zoro’s server).

## Tabs

Home · Ledger · Context · Goals · Settings

## Run

```bash
cd zoro_flutter
flutter pub get
flutter run --dart-define=API_BASE_URL=https://www.getzoro.com
```

Device on LAN: use your Mac’s IP instead of `127.0.0.1`. iOS signing and TestFlight: **`TASKS.md`**.

## Layout

| Area | Entry |
|------|--------|
| State | `lib/core/state/app_model.dart` |
| Goals (retire tradeoff) | `lib/features/goals/`, `lib/core/finance/goals_calculator.dart` |
| Persistence | `lib/core/persistence/` — schema in [`../zoro-app/README.md`](../zoro-app/README.md) |

## Ship

```bash
dart analyze && flutter test
```

Checklist and backlog: **`TASKS.md`**.
