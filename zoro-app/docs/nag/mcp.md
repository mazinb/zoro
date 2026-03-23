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
  --config-schema '{"type":"object","properties":{"nagMcpToken":{"type":"string","title":"Nag MCP token","description":"users.verification_token from Zoro magic link","x-from":"header","x-header-name":"x-nag-mcp-token"}},"required":["nagMcpToken"]}'
```

Smithery docs:

- [Publish](https://smithery.ai/docs/build/publish)
- [Connect API](https://smithery.ai/docs/use/connect-api)

## Email-first auth flow

For users without token preconfigured:

1. `nag_email_check`
2. `nag_auth_email` with `confirm_send=true` (`name` only for new users)
3. User opens magic link email
4. Save token into MCP header config (`x-nag-mcp-token`)

## MCP capability metadata

Runtime capabilities in `mcp/nag-server.mjs`:

- tools/list (12 tools)
- resources/list + resources/read
- prompts/list + prompts/get

Static fallback metadata:

- `/.well-known/mcp/server-card.json`

## Token resolution order

For tool calls requiring auth, token is resolved from:

1. Tool `token` argument
2. Request headers (`x-nag-mcp-token`, `Authorization: Bearer`, aliases)
3. Env (`NAG_MCP_TOKEN`, then `NEXT_PUBLIC_NAG_DEV_TOKEN`)

## Security

- Never commit real tokens in repo or shared config snippets.
- Treat token as account credential.

## See also

- [api.md](./api.md) — endpoint behavior and payloads
- [README.md](./README.md) — Nag feature overview
