---
name: ledger-review
description: Review an asset or liability row after a ledger write.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, review]
  zoro:
    triggers: [user.review, after.ledger]
    file_types: []
    allowed_docs: []
    allowed_tools: [read_ledger_summary, update_context_sidecar]
---

After numbers change, sanity-check the row.

1. Read the ledger summary.
2. Flag stale names, zero balances, or missing context notes.
3. Offer a context sidecar update with human confirm.
