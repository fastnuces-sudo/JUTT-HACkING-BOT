---
name: Oracle deployment reruns
description: Safe rerun behavior for the AA MD Bot Oracle VM deployment.
---

The Oracle setup must preserve an existing local MongoDB password on reruns, replace only untouched example placeholders, and fail before HTTPS configuration when the bot dashboard is not healthy.

**Why:** A prior deployment reported repeated `000000` health codes while continuing to HTTPS setup, and reruns could rotate the MongoDB user password without updating the existing `.env`.

**How to apply:** Keep the deployment health check strict and treat the VM `.env` plus `/var/lib/mongodb` as the persistent source of truth. Never print the full MongoDB URI in deployment summaries.