---
name: retirement-plan
description: Update the living retirement plan markdown from ledger numbers and new statements.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, retirement]
  zoro:
    triggers: [inbox.pdf, user.plan, cron.plan_review]
    file_types: [brokerage, tax]
    allowed_docs: [retirement]
    allowed_tools: [commit_doc, compute_corpus, read_ledger_summary, list_inbox, read_doc, list_revs, diff_rev]
---

The living plan is `docs/retirement.md`. Frontmatter (`retire_by`, `swr_pct`, `invest_monthly`) is the structured source of truth.

1. `read_doc` id=retirement and `read_ledger_summary`.
2. `compute_corpus` for invest / savings monthly.
3. Draft markdown. Do **not** `commit_doc` until `confirmed: true` from the user.
4. Keep the calculator honest — do not invent balances.
5. Split slider lives on Ledger Cash (`allocInvestFraction`); mention it, do not invent a second slider.
