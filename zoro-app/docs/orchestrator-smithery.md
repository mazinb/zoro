# Zoro Orchestrator (Smithery description)

Orchestrator is a **prompt-first router** that selects the next MCP server based on user intent.

## Core rule

- **Orchestrator never calls Nags directly.**
- Wealth/Goals can recommend switching to Nags **only if** the user explicitly asks to schedule reminders.

## MCP servers

- Orchestrator: `https://www.getzoro.com/api/mcp/orchestrator`
- Wealth: `https://www.getzoro.com/api/mcp/wealth`
- Goals: `https://www.getzoro.com/api/mcp/goals`
- Nags: `https://www.getzoro.com/api/mcp/nags`

## How it is used (typical flow)

1. If a token is missing, start with `orchestrator.landing_routes` to discover public routes.
2. If account access is needed, ask for consent and call `orchestrator.send_magic_link` (`confirm_send=true`) to email a tokenized link.
3. For cross-domain status (what is filled vs missing), call `orchestrator.summary`.
4. Based on user intent + the summary, switch to either **zoro-wealth** or **zoro-goals** for the actual work.
5. Only if the user asks for reminder scheduling, switch to **zoro-nags** (usually suggested by Wealth/Goals).

