# Hermes runtime contract

Handoff between Zoro (data, UI, notifications, MCP tools) and the independent
Hermes-on-phone package. Zoro never embeds a Hermes binary in the IPA.

## Roles

| Process | Owns |
| --- | --- |
| Zoro | Ledger, `hermes_home` docs/inbox/vault index, Keychain secrets, local notifications, MCP host |
| Hermes | Task loop, skill loading, cron job *intent* files, MCP client |

Hermes must not post OS notifications. It writes job defs under `hermes_home/cron/`;
Zoro schedules the existing `NotificationService` channel.

## `HERMES_HOME`

Application Support directory (parent of `hermes_home/` is the support root;
Hermes should set `HERMES_HOME` to `{support}/hermes_home`).

```
hermes_home/
  config.yaml              # Zoro overwrites on launch
  .no-bundled-skills
  AGENTS.md                # Zoro writes once; never clobber user edits
  SOUL.md                  # Zoro writes once; never clobber user edits
  identity.json            # mailbox address, allowlist — no secrets
  vault_index.json         # file-type match rules — no passwords
  docs/  revisions/  inbox/  skills/  cron/  chat/  log/
```

Secrets live only in Keychain:

- `zoro.vault.mailbox_token`
- `zoro.vault.fileType.{id}`
- `zoro.vault.mcp_loopback_token`

## Protocol

```dart
HermesStatus { presence: missing | ready | incompatible, protocolVersion, packageVersion, capabilities }
HermesRunRequest { hermesHomePath, enabledSkillIds, prompt?, cronJobId?, inboxItemIds, grantedTools }
HermesRunResult { ok, message }
```

`protocolVersion` is `1`. Zoro shows **incompatible** when Hermes reports a
higher major version it does not understand.

Package updates are sidecar (TestFlight / friend’s URL). Skills update inside
Zoro; the runtime updates inside Hermes.

## MCP

Loopback HTTP JSON-RPC at `http://127.0.0.1:${ZORO_MCP_PORT}/mcp`.

Header: `Authorization: Bearer ${loopback_token}`.

Token is Keychain-only, rotated on each Zoro launch, injected via env for the
Hermes process. `config.yaml` may list the URL; it must not persist the token.

### Tools

| Tool | Does |
| --- | --- |
| `read_ledger_summary` | High-level counts / totals, no raw passwords |
| `list_inbox` | PDFs on device |
| `get_inbox_item` | Metadata for one inbox id |
| `unlock_attachment` | Uses file-type vault; never returns the password |
| `commit_doc` | Revisioned markdown write (human confirm before living MD) |
| `read_doc` | HEAD markdown |
| `list_revs` | Revision metadata |
| `diff_rev` | Unified diff vs HEAD |
| `compute_corpus` | Calculator from retirement frontmatter + ledger |
| `update_context_sidecar` | Ledger/Context markdown sidecars |
| `notifications.upsert_cron` | Write job def + reschedule OS slot |
| `notifications.cancel_cron` | Remove job + cancel OS id |
| `notifications.list_cron` | Jobs Zoro currently has |

## Notifications

- Master toggle still `cancelAll()`.
- Settings **Agent jobs** Off silences Hermes crons without deleting defs.
- Notification ids **1000–1999** hashed from job id. Do not reuse 900 / 901 / 902.
- Payload: `NotificationKind.agentTask` with `taskId: hermes:{jobId}`.
- Tap opens Agent tab. Non-`hermes:` `agentTask` ids still go to Home.
- `ReminderDomain.goals` remains a plan check-in (open Agent / `retirement.md`).
- iOS: `zonedSchedule`. Android: fire on app open (no exact alarm).
- Human confirm is required before a cron run **commits** a living MD.

## Chat

Until Hermes `presence == ready`, Agent chat uses on-device Apple Intelligence,
then Cloud AI / BYO key. When ready, Zoro calls `HermesAdapter.run` with at most
2–3 matched skill ids (Phase 3 matcher). Phase 2 runs with **zero** skill ids.

## Privacy

- PDFs are never OCR’d or sent to Cloud AI on the server.
- Mailbox relay holds opaque bytes + metadata, short TTL, delete on ack.
- Mailbox token and PDF passwords never enter JSON / export / logs.
- Email body is untrusted (prompt injection). Applying a skill to a living MD
  is human-confirmed until the user taps Apply.
