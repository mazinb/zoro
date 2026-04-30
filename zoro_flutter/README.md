# Zoro Flutter (v0, iOS-first)

Flutter client for Zoro. This app is currently **UI-first**: it boots directly into a 5‑tab shell so we can iterate on product UX before re‑enabling auth/DB wiring.

## What it is (today)

- **Tabs**:
  - **Home (Command Center)**: net worth card, privacy toggle, interactive Sankey (quick edits), reminders.
  - **Ledger**: edit income, expenses (bucketed), allocations, assets/liabilities, monthly cashflow entries.
  - **Context**: Markdown notes on assets/liabilities/buckets/months (used by chat/agents).
  - **Chat**: threads tied to an “agent” (prompt + permissions); attach context bundles; send messages.
  - **Settings**: reminders, agents, and API keys.

## v0 scope (what “works”)

- **Local-first financial model** (no DB wiring required for v0): income, expenses (bucketed), assets, liabilities, and monthly cashflow entries.
- **Monthly cash flow entry**:
  - Inputs: Opening, Closing, Saved, Invested, Note
  - Derived: Spending \(Closing − Opening − Saved − Invested\)
  - Rules: Closing required; Saved/Invested can be 0; opening prefills from last month’s closing and must match it.
- **Chat + Agents**: local API keys; chat runs directly from device; internal helpers configurable in Settings.

## AI / Chat (local keys)

- **Key storage**: provider keys are stored locally with `flutter_secure_storage` (Keychain/Keystore). They never go to Zoro’s server.
- **Runtime**: chat calls the selected provider **directly from the device** (no proxy).
- **Providers**: OpenAI / Anthropic / Gemini.

## Run

### API base URL

The app uses `API_BASE_URL` (compile-time) for Zoro’s Next.js API endpoints used by auth + imports.

```bash
cd zoro_flutter
flutter run --dart-define=API_BASE_URL=https://www.getzoro.com
```

For local API on a device, use your Mac’s LAN IP (not `127.0.0.1`):

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:3000
```

### iOS

See `TASKS.md` for iOS device setup and signing notes.

#### Apple Silicon note (physical iPhone)

If `flutter run -d <iphone>` fails with an `iproxy` architecture error, install Rosetta:

```bash
sudo softwareupdate --install-rosetta --agree-to-license
```

### macOS (dev)

```bash
cd zoro_flutter
flutter run -d macos --dart-define=API_BASE_URL=https://www.getzoro.com
```

## Code map (high level)

- **App + state**: `lib/app.dart`, `lib/core/state/app_model.dart`
- **Shell**: `lib/features/shell/main_scaffold.dart`
- **Home**: `lib/features/command_center/command_center_tab.dart`
- **Context editor**: `lib/features/context/context_editor_page.dart`
- **Chat**: `lib/features/chat/chat_tab.dart`, `lib/core/llm/llm_client.dart`, `lib/core/llm/llm_key_store.dart`
- **Settings**: `lib/features/settings/settings_tab.dart`

## Currency + FX (UI mock)

Display currency supports **USD / THB / INR** with hard-coded spot rates in `lib/core/finance/currency.dart` (`usdPerUnit`).

## Deploy mindset (pre–TestFlight)

- Keep `flutter analyze` clean.
- Treat iOS signing + build as the release gate.
- Next step after v0 cleanup: TestFlight distribution (handled separately).
