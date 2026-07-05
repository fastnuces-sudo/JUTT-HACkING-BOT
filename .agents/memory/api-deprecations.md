---
name: External API deprecations
description: APIs used by bot plugins that have changed or been deprecated, with working replacements.
---

## restcountries.com v3.1 — Deprecated

**Status:** All requests to `https://restcountries.com/v3.1/` return a JSON deprecation notice (not a 4xx), causing all fields to parse as 'N/A'.

**Fix:** Migrated `plugins/search/country.js` to `countriesnow.space` API:
- `GET https://countriesnow.space/api/v0.1/countries/capital/q?country={name}` → name, capital, iso2, iso3
- `GET https://countriesnow.space/api/v0.1/countries/currency/q?country={name}` → currency code (string, not object)
- `GET https://countriesnow.space/api/v0.1/countries/flag/images/q?country={name}` → flag URL
- `GET https://api.first.org/data/v1/countries?q={name}&limit=1` → region (fallback)

**Why:** The countriesnow endpoints return specific fields per call (not one unified object). Currency is a plain string (e.g. "PKR"), not an object.

## pollinations.ai — Model changes

**Status:** The `/openai` POST endpoint at `text.pollinations.ai` only supports model `openai` (aliased to openai-fast/gpt-oss-20b). Requesting `gemini`, `mistral`, or `llama` returns 404 with "Model not found".

**Fix:** Removed multi-model routing in `plugins/search/ai.js`. All aliases (gemini, mistral, llama, gpt) now use model `openai`.

**How to apply:** If re-adding multi-model support in future, check `https://text.pollinations.ai/models` first to see what's available.
