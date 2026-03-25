# Zoro Nags (Smithery description)

Nags MCP powers reminder scheduling that actually sends email (and supports webhooks + WhatsApp channels when enabled).

## Core rule in the system

- **Orchestrator never calls Nags directly.**
- Wealth/Goals can recommend switching to Nags **only if** the user explicitly asks to schedule reminders.

## MCP server URL

`https://www.getzoro.com/api/mcp/nags`

## Detailed docs in this repo

- `zoro-app/docs/nag/mcp.md`

