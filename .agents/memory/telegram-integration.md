---
name: Telegram integration
description: Two Telegram bots wired into index.js — one for pairing/admin, one for WhatsApp features on Telegram
---

# Telegram integration

## Architecture
- `lib/telegramAdmin.js` — pairing code + status bot (TELEGRAM_BOT_TOKEN)
- `lib/telegramFeatures.js` — WhatsApp features on Telegram (TELEGRAM_FEATURES_BOT_TOKEN)
- Both initialized in `index.js` after `initAllSessions()`, wrapped in try/catch so a bad token doesn't crash WhatsApp bot

## Admin bot commands
/start, /help, /pair <phone>, /status

## Features bot commands
/play, /video, /tiktok, /fb, /weather, /ai, /translate, /lyrics

## Pairing flow
- User sends /pair 923001234567 to admin bot
- Bot calls createSession(sessionId, phone)
- botEvents 'pairingCode' event fires → bot sends code to user
- sessionId format: `tg_<phone>`

## Why
- `node-telegram-bot-api` package used (polling mode)
- restart.js uses spawn + process.exit(0) — spawn new process first, then exit
- setprefix/mode/anticall/antispam/autoreact are ownerOnly only (NOT superOwnerOnly)
