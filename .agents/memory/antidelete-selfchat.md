---
name: Antidelete → self-chat routing
description: Antidelete in groups now routes to owner's (You) chat, not back to the group
---

# Antidelete routing change

## Rule
Both group and DM deleted messages are forwarded to the bot's own self-chat ("You" tab), never re-posted to the group.

## Why
User explicitly requested this — deleted messages appearing in the group expose the bot's presence and reveal the recovery to all members. Sending to (You) is silent and private.

## How to apply
In `lib/sessionManager.js`, the antidelete block uses a single code path for both `isGroup` and DM cases. Both compute `selfJid2` and forward there. The old group branch (re-send in group with @mention) is removed.
