---
name: home-briefing
description: Short Home briefing from on-device ledger facts. Not a cloud note.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, home]
  zoro:
    triggers: [app.open, cron.daily]
    file_types: []
    allowed_docs: [retirement]
    allowed_tools: [read_ledger_summary, read_doc]
---

Write 3–5 short bullets: what changed, what is overdue, one next action.

Do not auto-run on every app open unless the user enabled a cron via notify-schedule.
Never include passwords or mailbox tokens.
