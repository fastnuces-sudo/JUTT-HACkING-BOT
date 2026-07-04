// ============================================
// AA MD Bot - Auto Channel Follow
// When any WhatsApp number connects to the bot, it automatically follows
// the configured channel(s). SuperOwner can add, remove, or replace the
// list of channels (2 or more supported).
// ============================================

import { db } from './database.js';
import { logger } from './logger.js';
import config from '../config.js';

const DEFAULT_CHANNEL_LINK = config.channelLink || 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';

// ── Storage ───────────────────────────────────────────────────────────────
// Stored as an array of { link, jid?, name? } in db.settings under 'followChannels'.
// jid is resolved lazily (on first successful connect) and cached so we don't
// re-hit newsletterMetadata on every reconnect.

export function getFollowChannels() {
  const saved = db.settings.getValue('followChannels');
  if (Array.isArray(saved) && saved.length) return saved;
  return [{ link: DEFAULT_CHANNEL_LINK }];
}

export function setFollowChannels(list) {
  db.settings.setValue('followChannels', list);
}

export function extractInviteCode(link) {
  const m = link?.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/i);
  return m ? m[1] : null;
}

export function addFollowChannel(link) {
  const code = extractInviteCode(link);
  if (!code) return { ok: false, error: 'Invalid channel link format.' };
  const list = getFollowChannels();
  if (list.some(c => c.link === link)) return { ok: false, error: 'This channel is already in the list.' };
  list.push({ link });
  setFollowChannels(list);
  return { ok: true, list };
}

export function removeFollowChannel(index) {
  const list = getFollowChannels();
  if (index < 0 || index >= list.length) return { ok: false, error: 'Invalid channel number.' };
  const removed = list.splice(index, 1)[0];
  setFollowChannels(list);
  return { ok: true, removed, list };
}

export function replaceFollowChannels(link) {
  const code = extractInviteCode(link);
  if (!code) return { ok: false, error: 'Invalid channel link format.' };
  const list = [{ link }];
  setFollowChannels(list);
  return { ok: true, list };
}

export function clearFollowChannels() {
  setFollowChannels([]);
}

// ── Auto-follow on connect ───────────────────────────────────────────────
// Fire-and-forget: never blocks or breaks the connection flow.

export async function followAllChannels(sock) {
  const channels = getFollowChannels();
  if (!channels.length) return;

  let changed = false;
  for (const ch of channels) {
    try {
      let jid = ch.jid;
      if (!jid && ch.link) {
        const code = extractInviteCode(ch.link);
        if (!code) continue;
        const meta = await sock.newsletterMetadata('invite', code);
        jid = meta?.id;
        if (jid) { ch.jid = jid; changed = true; }
      }
      if (jid) {
        await sock.newsletterFollow(jid);
        logger.info({ jid, link: ch.link }, '📢 Auto-followed channel on connect');
      }
    } catch (err) {
      logger.warn({ err: err.message, link: ch.link }, '⚠️ Channel auto-follow failed');
    }
  }
  if (changed) setFollowChannels(channels);
}
