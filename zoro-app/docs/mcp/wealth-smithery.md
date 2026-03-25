# Zoro Wealth (Smithery description)

Wealth MCP wraps the wealth experience routes (`/expenses`, `/income`, `/assets`) and exposes a tool set for:

- Loading `user_data`
- Reading monthly expense buckets and estimate snapshots
- Saving expense estimates + monthly actuals totals
- Saving income and assets/liabilities answers
- Managing lightweight recurring reminders (same contract as the main-site reminder widget)
- FX rates and currency coverage gaps

## How it fits with Orchestrator + Goals

- Orchestrator routes user intent to Wealth when the user is working on wealth data.
- Wealth/Goals can recommend switching to Nags only when reminder scheduling is requested.

## MCP server URL

`https://www.getzoro.com/api/mcp/wealth`

