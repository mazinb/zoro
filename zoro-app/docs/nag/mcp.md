# Nag MCP (Cursor + Smithery)

This project exposes the Nag tools in two ways:

- **Local stdio MCP server** (`mcp/nag-server.mjs`) for Cursor local usage
- **Remote Streamable HTTP endpoint** (`/api/mcp/nags`) for Smithery and remote clients

## Prerequisites

1. Nag API is running (local or deployed).
2. You have a user token (`users.verification_token`) from `/nag?token=...`.

## Cursor setup (local stdio)

Add to Cursor MCP config:

```json
{
  "mcpServers": {
    "zoro-nags": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/zoro-app/mcp/nag-server.mjs"],
      "env": {
        "NAG_MCP_BASE_URL": "http://localhost:3000",
        "NAG_MCP_TOKEN": "YOUR_VERIFICATION_TOKEN"
      }
    }
  }
}
```

Notes:

- For deployed API, set `NAG_MCP_BASE_URL` to your HTTPS domain.
- If `.env.local` has `NEXT_PUBLIC_NAG_DEV_TOKEN`, `NAG_MCP_TOKEN` can be omitted locally.
- Restart MCP servers in Cursor after config edits.

## Smithery setup (remote URL publish)

Remote MCP URL:

- `https://<your-domain>/api/mcp/nags`

Publish with config schema (required to avoid "No config schema provided"):

```bash
smithery mcp publish "https://<your-domain>/api/mcp/nags" \
  -n @your-org/zoro-nags \
  --config-schema '{"type":"object","properties":{"token":{"type":"string","title":"Zoro token","description":"users.verification_token from Zoro magic link","x-from":"header","x-header-name":"token"}},"required":["token"]}'
```

Smithery docs:

- [Publish](https://smithery.ai/docs/build/publish)
- [Connect API](https://smithery.ai/docs/use/connect-api)

## Email-first auth flow

For users without token preconfigured:

1. `onboarding.email_check`
2. `onboarding.auth_email` with `confirm_send=true` (`name` only for new users)
3. User opens magic link email
4. Save token into MCP header config (`token`; legacy `x-nag-mcp-token` still accepted)

## MCP capability metadata

Runtime capabilities in `mcp/nag-server.mjs`:

- tools/list (12 tools)
- resources/list + resources/read
- prompts/list + prompts/get

Static fallback metadata:

- `/.well-known/mcp/server-card.json`

## Remote HTTP: stateless sessions (Vercel / multi-instance)

`/api/mcp/nags` runs the MCP Streamable HTTP transport in **stateless** mode (no `sessionIdGenerator`).

Earlier versions kept MCP sessions in an in-memory `Map`. On serverless hosts, the next request often hits a **different instance** (or the entry **expires after 15 minutes**). The client still sent `mcp-session-id`, but the server had no matching session, created a **new** transport, and forwarded `tools/list` **without** `initialize` on that transport → **`Bad Request: Server not initialized`**. Disabling/re-enabling MCP forced a fresh `initialize`, which is why it “fixed” itself.

Stateless mode matches how the TypeScript SDK expects serverless to work: **one new transport per HTTP request** (do not reuse). Supabase and other hosted MCPs typically avoid per-process session state the same way.

The route must **not** call `server.close()` right after `handleRequest` returns when the response is **SSE**: the handler resolves before the stream finishes, and closing early can produce flaky errors on the next client POST.

## Token resolution order

For tool calls requiring auth, token is resolved from:

1. Tool `token` argument
2. Request headers (`token` preferred, then `Authorization: Bearer`, then legacy `x-nag-mcp-token` and aliases)
3. Env (`NAG_MCP_TOKEN`, `MCP_TOKEN`, then `NEXT_PUBLIC_NAG_DEV_TOKEN`)

## Smithery: separate servers (wealth, goals, orchestrator)

Each MCP is a **different URL**. If you publish “wealth” but point Smithery at `/api/mcp/nags`, the catalog will show **Nag** tools only.

| Listing   | Streamable HTTP URL |
|-----------|---------------------|
| Nags      | `https://<domain>/api/mcp/nags` |
| Wealth    | `https://<domain>/api/mcp/wealth` |
| Goals     | `https://<domain>/api/mcp/goals` |
| Orchestrator | `https://<domain>/api/mcp/orchestrator` |

Use the same `token` header config schema as above when publishing each server.

## Security

- Never commit real tokens in repo or shared config snippets.
- Treat token as account credential.

## See also

- [api.md](./api.md) — endpoint behavior and payloads
- [README.md](./README.md) — Nag feature overview
