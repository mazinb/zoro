# Zoro monorepo

| Package | Role |
|---------|------|
| **`zoro-app/`** (this folder) | Next.js site — [getzoro.com](https://www.getzoro.com): marketing, forms, API routes, Supabase, email, server jobs |
| **`zoro_flutter/`** | iOS/Android app — privacy-first finance on device; uses the web API in production |

**Mobile app version** (release): `1.0.0+3` — see `zoro_flutter/pubspec.yaml`.

Operational checklists, iOS signing notes, and notification internals live in **`zoro_flutter/TASKS.md`**. This README is the canonical place for **on-device data layout** and how it relates to the web app.

---

## Web app (`zoro-app`)

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Forms and saves use shared hooks (e.g. `src/hooks/useFormSave.ts`) and `/api/user-data`.

### Deploy (e.g. Vercel)

1. Set environment variables on the host (table below).
2. `npm run build`, then start with the platform default (`npm start` or equivalent).
3. Set **`NEXT_PUBLIC_BASE_URL`** (or production origin) so magic links use **https://www.getzoro.com** (or your host).
4. Supabase cron / nags: service role **server only** — see `docs/nag/supabase-cron.md`.

Do not commit `.env` or service-role keys.

### Environment variables

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — nags, admin |
| `NAG_DISPATCH_KEY` | **Server only** — Bearer for cron nags |
| `RESEND_API_KEY` / `RESEND_FROM` | Transactional email |
| `SUBMISSION_NOTIFY_EMAIL` | Lead/form notification inbox |
| `NEXT_PUBLIC_BASE_URL` | Public site URL |
| `GEMINI_API_KEY` | Server: PDF / savings flows |
| `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` | Magic-link URL resolution |
| `NEXT_PUBLIC_IOS_APP_URL` | App Store link on download page |
| `NEXT_PUBLIC_ANDROID_APP_URL` | Play Store link on download page |
| `NEXT_PUBLIC_APP_DEMO_VIDEO` | Optional demo video (default `/videos/demo.mp4`) |

Schema and migrations: Supabase / repo migrations are source of truth.

### Related docs

- **Nags cron:** `docs/nag/supabase-cron.md`

---

## Mobile app (`zoro_flutter`)

Privacy-first: ledger, goals, context, and chat stay **on the phone**. No bank sync. Optional LLM calls use **your** API keys (secure storage — never written into the JSON files below).

### App UI (tabs)

1. **Home** — Command center: Sankey, net-worth projection  
2. **Ledger** — Assets, liabilities, income, expenses, cashflow  
3. **Context** — Notes and orchestrator  
4. **Goals** — Retirement / target goals  
5. **Settings** — API keys, reminders, agents, **ledger export/import**

Ship checklist, bundle IDs, CI, and iOS troubleshooting: **`zoro_flutter/TASKS.md`**.

### Notifications (summary)

- **Local only** (`flutter_local_notifications`) — no push/APNs/FCM.
- **No background Dart runner** — OS fires scheduled reminders; catch-up runs when the app is open.
- Master toggle and per-domain reminder cadences in Settings.

Details: `zoro_flutter/TASKS.md` → Notifications.

---

## On-device data layout

> **When you change this layout**, bump **`kAppStateSplitLayoutVersion`** in  
> `zoro_flutter/lib/core/persistence/app_state_split_store.dart`  
> **and update the layout version row below.**

| Constant | Current value | Meaning |
|----------|---------------|---------|
| **Data layout version** | **`2`** | `app_state.json` is a manifest of file paths (`formatVersion` in manifest). Bump when files/paths/split rules change. Code: `kAppStateSplitLayoutVersion`. |
| **Snapshot schema version** | **`2`** | JSON shape inside each linked file (ledger fields, settings keys, etc.). Bump when field semantics change. Code: `kAppStateFormatVersion` in `app_state_codec.dart`. |
| **Agents index version** | **`1`** | `agents/_index.json` → `{ "version": 1, "ids": [...] }`. |
| **Chats file version** | **`2`** | Inside `data/chats.json`. |

Legacy **layout v1**: one large `app_state.json` with everything inline. On first launch after upgrade, the app **migrates v1 → layout v2** automatically.

### Directory tree (Application Support)

All paths are relative to the app’s application support directory (iOS/Android).

```
app_state.json              # manifest only (layout version 2)
data/
  ledger.json               # assets, liabilities, income, expenses, cashflow, FX, projections
  goals.json                # { "goals": [ ... ] }
  settings.json             # UI, reminders, LLM model names (no agents list)
  context.json              # context note timestamps (references only)
  internal_agents.json      # built-in agent prompts / last runs
  chats.json                # threads + messages
agents/
  _index.json               # agent id list
  {agent-id}.json           # one file per user-defined agent
context_markdown/
  *.md                      # long markdown for ledger rows (sidecar refs in ledger.json)
```

### Manifest example (`app_state.json`)

```json
{
  "formatVersion": 2,
  "savedAtMs": 1710000000000,
  "files": {
    "ledger": "data/ledger.json",
    "goals": "data/goals.json",
    "settings": "data/settings.json",
    "context": "data/context.json",
    "internalAgents": "data/internal_agents.json",
    "chats": "data/chats.json",
    "agents": "agents"
  }
}
```

### What lives where

| File | Contents |
|------|----------|
| `data/ledger.json` | Portfolio numbers, expense buckets, monthly cashflow, allocation sliders, projection maps. Large per-row markdown stored under `context_markdown/` as `contextMarkdownRef`, not inline on disk. |
| `data/goals.json` | Financial goals (retirement + targets). |
| `data/settings.json` | Theme, currencies, notification prefs, reminder cadences, home summary text, active LLM provider. |
| `data/context.json` | `noteSavedAtUtc` map (keys like `asset:id`, `month:yyyy-mm`). |
| `data/internal_agents.json` | Overrides and last-run metadata for built-in agents (ledger orchestrator, goals guide, etc.). |
| `data/chats.json` | Chat threads and messages. |
| `agents/*.json` | User-defined agents (permissions, prompts, tools). |

**Not on disk in JSON:** API keys (Flutter secure storage).

### Ledger export (portable file)

**Settings → Agents → Data → Export ledger JSON**

Single file for backup or transfer — **not** the same as the on-device split layout:

```json
{
  "formatVersion": 1,
  "exportKind": "ledger",
  "savedAtMs": 1710000000000,
  "ledger": { }
}
```

- **`exportKind`:** `"ledger"` — import updates `data/ledger.json` only.  
- **Inline markdown** in export (no sidecar `.md` refs) so the file is self-contained.  
- **Import** of old full-app snapshots (if present) still replaces in-memory state and re-splits to layout v2.

Implementation: `zoro_flutter/lib/core/persistence/app_state_transfer.dart`.

### Code map

| Concern | Location |
|---------|----------|
| Path constants | `zoro_flutter/lib/core/persistence/app_state_paths.dart` |
| Split save/load/migrate | `zoro_flutter/lib/core/persistence/app_state_split_store.dart` |
| Per-agent files | `zoro_flutter/lib/core/persistence/agents_store.dart` |
| Markdown sidecars | `zoro_flutter/lib/core/persistence/context_markdown_sidecar.dart` |
| Ledger export/import UI | `zoro_flutter/lib/features/settings/data_transfer_pane.dart` |

Tests: `zoro_flutter/test/app_state_split_store_test.dart`, `zoro_flutter/test/app_state_transfer_test.dart`.

---

## Repo map

```
zoro/
├── zoro-app/          ← you are here (web)
├── zoro_flutter/      ← mobile
├── checkin/           ← separate tooling (if present)
└── …
```
