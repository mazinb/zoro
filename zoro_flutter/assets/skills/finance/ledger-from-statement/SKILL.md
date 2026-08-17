---
name: ledger-from-statement
description: Propose ledger asset, liability, or expense updates from a classified statement PDF.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, ledger]
  zoro:
    triggers: [inbox.pdf, user.ledger]
    file_types: [brokerage, bank]
    allowed_docs: []
    allowed_tools: [list_inbox, get_inbox_item, unlock_attachment, read_ledger_summary]
---

Statements change numbers. You propose; the human applies in Ledger.

1. Unlock the PDF via the vault. Do not send bytes to Cloud AI.
2. Compare to `read_ledger_summary`.
3. List concrete row updates (name, amount, currency). Do not write the ledger yourself.
4. Point the user at Ledger → the matching section to Apply.
