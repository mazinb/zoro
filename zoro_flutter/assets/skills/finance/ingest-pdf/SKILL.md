---
name: ingest-pdf
description: File a PDF into the on-device inbox using the file-type password vault.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, pdf]
  zoro:
    triggers: [inbox.pdf, user.import]
    file_types: [brokerage, bank, tax, insurance, other]
    allowed_docs: []
    allowed_tools: [list_inbox, get_inbox_item, unlock_attachment]
---

PDFs never leave this phone for OCR.

1. Match a vault file type from filename / sender.
2. Call `unlock_attachment` with the inbox id. Do not ask the user to paste a password into chat.
3. If unlock fails, tell them to update the saved password in Settings → Agent → File passwords.
4. After unlock, suggest `ledger-from-statement` or `retirement-plan` — do not write the ledger until they confirm.
