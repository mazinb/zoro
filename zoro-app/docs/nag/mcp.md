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
