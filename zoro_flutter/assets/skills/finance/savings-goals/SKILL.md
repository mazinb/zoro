---
name: savings-goals
description: Target-amount savings goals as extra living markdown docs.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, goals]
  zoro:
    triggers: [user.savings]
    file_types: []
    allowed_docs: []
    allowed_tools: [commit_doc, read_doc, read_ledger_summary]
---

Retirement stays `docs/retirement.md`. Other target-amount goals are extra docs (`docs/savings-{id}.md`).

1. Draft frontmatter: target amount, date, monthly contribution.
2. Commit only with `confirmed: true`.
3. Do not overwrite retirement.md for a savings target.
