---
name: Channel auto-follow
description: Every WhatsApp number connected to the bot auto-follows configured channel(s); superOwner-managed list
---

## What it does
When any WhatsApp number connects (session `connection === 'open'`), the bot auto-follows every channel link in a superOwner-managed list, using Baileys' `newsletterFollow(jid)` API.

**Why:** User wanted every connected number to automatically follow the brand's channel(s), with the ability for the super owner (only) to add, remove, replace, or run 2+ channels — without requiring the bot's own number to be pre-subscribed.

## Architecture
- `lib/channelFollow.js` — storage (`db.settings.followChannels`, array of `{ link, jid? }`) + `followAllChannels(sock)` fire-and-forget call.
- Channel links are resolved to newsletter JIDs lazily via `sock.newsletterMetadata('invite', inviteCode)` (invite code = last path segment of `whatsapp.com/channel/<code>`), then cached in the same record so repeat connects skip the metadata lookup.
- Wired into `lib/sessionManager.js` connection-open handler as `followAllChannels(sock).catch(() => {})` — never blocks or breaks the connection flow if a follow fails.
- `plugins/owner/followchannel.js` — superOwnerOnly command (`list`/`add`/`remove`/`set`/`clear`) to manage the channel list. Distinct from the pre-existing `.setnewsletter` command, which only controls the "View Channel" forwarded-button branding on outgoing messages, not actual following.

## How to apply
If asked to add/remove default channels or change follow behavior, edit `lib/channelFollow.js`'s `DEFAULT_CHANNEL_LINK` or use the `.followchannel` command flow — don't hardcode channel JIDs elsewhere.
