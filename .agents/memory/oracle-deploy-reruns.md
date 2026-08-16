---
name: Oracle deployment reruns
description: Safe rerun behavior for the AA MD Bot Oracle VM deployment.
---

The Oracle setup must preserve an existing `DATABASE_URL` on reruns, replace only untouched example placeholders, and fail before HTTPS configuration when the bot dashboard is not healthy.

**Why:** A prior deployment reported repeated `000000` health codes while continuing to HTTPS setup, and reruns could overwrite working database credentials in the existing `.env`.

**How to apply:** Keep the deployment health check strict and treat the VM `.env` as the persistent source of truth — the data itself now lives in Neon, not on the VM, so a rebuilt VM keeps all sessions as long as `DATABASE_URL` is reused. Never print the full connection string in deployment summaries; mask the password.