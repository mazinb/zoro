---
name: notify-schedule
description: Upsert or cancel Zoro-backed local notification jobs for the on-device agent.
version: 1.0.0
metadata:
  hermes:
    tags: [finance, notify]
  zoro:
    triggers: [user.remind, user.cron]
    file_types: []
    allowed_docs: []
    allowed_tools: [notifications.upsert_cron, notifications.cancel_cron, notifications.list_cron]
---

Zoro posts local notifications. Hermes only writes job intent.

1. `notifications.list_cron` before changing anything.
2. Upsert with id, title, prompt, and `nextAt` ISO-8601.
3. Honor the master notification toggle and Settings → Agent jobs.
4. Ids hash into notification range 1000–1999. Never use 900, 901, or 902.
5. A cron run that would commit living markdown still needs human confirm.
