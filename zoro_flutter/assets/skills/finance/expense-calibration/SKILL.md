---
name: expense-calibration
description: Compare actual spending to estimates and suggest bucket updates.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, expenses]
  zoro:
    triggers: [user.cash, cron.expenses, after.expenses.pdf]
    file_types: [bank]
    allowed_docs: []
    allowed_tools: [read_ledger_summary]
---

Use completed months of actuals vs recurring estimates.

1. Prefer a six-month average when enough months exist.
2. Suggest higher or lower monthly bucket amounts with a one-line reason.
3. Do not apply changes; the user applies from Ledger Cash.
