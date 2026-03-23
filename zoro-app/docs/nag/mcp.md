# Nag MCP server (Cursor & other MCP clients)

A **stdio** MCP server in this repo calls your **already-running** Zoro Next.js app over HTTP. It does not replace the web server; it exposes Nag tools to the assistant.

## Prerequisites

1. **Next app running** (local or deployed), with Nag API working (`SUPABASE_SERVICE_ROLE_KEY`, etc.).
2. A **user link token** — the same `users.verification_token` you get from a magic link (`/nag?token=…`). For local dev you can use `NEXT_PUBLIC_NAG_DEV_TOKEN` from `.env.local` instead of putting the token in MCP config.

## Install dependencies

From `zoro-app/` (already done if you pulled latest):

```bash
npm install
```

## Run a quick sanity check

With `npm run dev` on port 3000 and token in env:

```bash
cd zoro-app
NAG_MCP_BASE_URL=http://localhost:3000 NAG_MCP_TOKEN=your_token_here node mcp/nag-server.mjs
```

It will wait on stdin (normal for MCP). **Ctrl+C** to exit.

## Connect from Cursor

### 1. Open MCP settings

- **Cursor** → **Settings** → **MCP** → **Add new global MCP**  
  or edit the JSON config file directly (path varies by version):

  - Global: `~/.cursor/mcp.json`  
  - Sometimes: **Cursor Settings → Features → MCP** shows the file path.

### 2. Add this server (use your real paths and token)

Replace `/ABSOLUTE/PATH/TO/zoro-app` with the full path to this repo’s `zoro-app` folder (on your machine).

```json
{
  "mcpServers": {
    "zoro-nags": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/zoro-app/mcp/nag-server.mjs"],
      "env": {
        "NAG_MCP_BASE_URL": "http://localhost:3000",
        "NAG_MCP_TOKEN": "paste_your_verification_token_here"
      }
    }
  }
}
```

### 3. Local dev without pasting the token

If `.env.local` already has `NEXT_PUBLIC_NAG_DEV_TOKEN`, you can omit `NAG_MCP_TOKEN` and rely on the server loading `.env.local`:

```json
{
  "mcpServers": {
    "zoro-nags": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/zoro-app/mcp/nag-server.mjs"],
      "env": {
        "NAG_MCP_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 4. Production / staging

Point the base URL at your deployed site (HTTPS):

```json
"NAG_MCP_BASE_URL": "https://your-production-domain.com"
```

Use a real user token in `NAG_MCP_TOKEN` (treat it like a password).

### 5. Reload MCP in Cursor

Save the config, then restart Cursor or use **MCP: Restart servers** (Command Palette) so `zoro-nags` appears. You should see tools such as `nags_list`, `nag_parse`, `nags_create`, etc.

## npm script

```bash
npm run mcp:nag
```

Same as `node mcp/nag-server.mjs` — still stdio-only; Cursor (or another client) spawns this process.

## Tools exposed

| Tool | Purpose |
|------|--------|
| `nag_email_check` | `POST /api/auth/nag-email-check` |
| `nag_request_link` | `POST /api/auth/nag-request-link` |
| `nag_parse` | `POST /api/nag-parse` |
| `nags_list` | `GET /api/nags` |
| `nags_create` | `POST /api/nags` |
| `nags_update` | `PATCH /api/nags/:id` |
| `nags_delete` | `DELETE /api/nags/:id` |
| `nag_profile_set_timezone` | `PATCH /api/nag-profile` |

Most tools accept an optional `token` argument; if omitted, `NAG_MCP_TOKEN` or `NEXT_PUBLIC_NAG_DEV_TOKEN` is used.

## Security

- Do **not** commit real tokens into the repo or into shared `mcp.json` snippets.
- `NEXT_PUBLIC_*` is for browser exposure; using it only on your laptop for MCP is a convenience, not a pattern for production secrets.

## See also

- [api.md](./api.md) — HTTP payloads and behavior

## Smithery publish format (URL-hosted MCP)

Use the MCP HTTP endpoint from this app:

- `https://<your-domain>/api/mcp/nags`

Smithery URL publishing docs:

- [Publish](https://smithery.ai/docs/build/publish)
- [Connect API](https://smithery.ai/docs/use/connect-api)

### Minimal publish command

```bash
smithery mcp publish "https://<your-domain>/api/mcp/nags" -n @your-org/zoro-nags
```

### Recommended config schema (token as header)

For Smithery session configuration, provide a schema so users can set auth once:

```bash
smithery mcp publish "https://<your-domain>/api/mcp/nags" \
  -n @your-org/zoro-nags \
  --config-schema '{"type":"object","properties":{"nagMcpToken":{"type":"string","title":"Nag MCP token","description":"users.verification_token from Zoro magic link","x-from":"header","x-header-name":"x-nag-mcp-token"}}}'
```

Notes:

- MCP tool calls will accept token via `x-nag-mcp-token`, `Authorization: Bearer <token>`, and aliases (`x-nag-token`, `nagMcpToken`).
- If users do not have a token yet, use onboarding tools first:
  - `nag_email_check` (check registration)
  - `nag_request_link` / `nag_auth_email` (sign up if needed + send magic link email)
  - `nag_reset_token` (rotate token after sign-in)

### Signup + email auth flow (recommended UX)

1. Ask for email.
2. Call `nag_email_check`.
3. Call `nag_auth_email` with `confirm_send=true` (and `name` only for new users).
4. User opens email link and receives their tokened session in Zoro.
5. Save token as MCP header config (`x-nag-mcp-token`) for future tool calls.

### Server metadata for Smithery scans

This app now serves a static server card at:

- `/.well-known/mcp/server-card.json`

Use it as fallback metadata when automated scan cannot fully introspect auth-gated flows. It includes:

- `serverInfo`, auth scheme, and tool list
- a `resources` section
- a `prompts` section for capability scoring
