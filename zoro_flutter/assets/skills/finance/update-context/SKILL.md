---
name: update-context
description: Refresh ledger Context markdown sidecars after ingest or when notes go stale.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, context]
  zoro:
    triggers: [user.context, after.ingest]
    file_types: [brokerage, bank]
    allowed_docs: []
    allowed_tools: [read_ledger_summary, update_context_sidecar]
---

Context notes live in `context_markdown/*.md` sidecars, not in `hermes_home/docs`.

1. Identify the sidecar key (`asset:`, `liability:`, `bucket:`, `month:`).
2. Draft the note from on-device ledger facts only.
3. Call `update_context_sidecar` only with `confirmed: true`.
4. Never overwrite a sidecar silently.
