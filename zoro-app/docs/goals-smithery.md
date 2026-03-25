# Zoro Goals (Smithery description)

Goals MCP provides tooling for the six goal flows (`/save`, `/home`, `/invest`, `/insurance`, `/tax`, `/retire`):

- `goals.overview`: boolean flags per goal + tokenized deep-link paths
- `goals.detail`: full `user_data` slices per goal (optionally limited to selected fields)
- Prompts for “save-only onboarding” JSON payload generation (client LLM parses)

## How it fits with Orchestrator + Wealth

- Orchestrator routes to Goals when the user wants goal progress or goal-form payloads.
- Wealth/Goals can recommend switching to Nags only when reminder scheduling is requested.

## MCP server URL

`https://www.getzoro.com/api/mcp/goals`

