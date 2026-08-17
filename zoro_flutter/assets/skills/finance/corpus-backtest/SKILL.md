---
name: corpus-backtest
description: Year-by-year corpus backtest against historical equity and cash/FD series.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, retirement, backtest]
  zoro:
    triggers: [user.backtest]
    file_types: []
    allowed_docs: [retirement]
    allowed_tools: [read_doc, compute_corpus, read_ledger_summary]
---

The in-app corpus backtest remains the calculator. This skill explains results and inputs.

1. Read the living plan and compute_corpus.
2. Point the user at the Goals/Agent backtest table (S&P 500 + cash/FD defaults).
3. Do not invent historical returns.
