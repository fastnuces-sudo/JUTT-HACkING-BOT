// ============================================
// AA MD Bot - Auto Translate (Group Feature)
// Developer: Ahsan Ali | AA Mods
// .autotranslate on [lang]   — group mein auto-translate on karo
// .autotranslate off         — band karo
// Passive handler: checkAutoTranslate (imported by sessionManager)
// ============================================

import axios from 'axios';
import { db } from '../../lib/database.js';

const LANG_NAMES = {
  en:'English', ur:'Urdu', ar:'Arabic', hi:'Hindi', fr:'French',
  es:'Spanish', de:'German', tr:'Turkish', ru:'Russian', zh:'Chinese',
  ja:'Japanese', ko:'Korean', pt:'Portuguese', it:'Italian', fa:'Persian',
};

async function mymemoryTranslate(text, toLang) {
  const res = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=autodetect|${toLang}`,
    { timeout: 8000 }
  );
  const t = res.data?.responseData?.translatedText;
  // Ignore if same as input (already in target lang)
  if (!t || t.toLowerCase().trim() === text.toLowerCase().trim()) return null;
  return t;
}

// ── Passive handler — called from sessionManager for every group message ──────
export async function checkAutoTranslate(msg, sock, sessionId) {
  if (!msg?.message || !msg?.key?.remoteJid?.endsWith('@g.us')) return;
  if (msg.key.fromMe) return;

  const chatJid = msg.key.remoteJid;
  const grp     = db.groups.get(sessionId, chatJid) || {};
  if (!grp.autoTranslate) return;

  const toLang = grp.autoTranslateLang || 'en';

  const text = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''
  ).trim();

  if (!text || text.length < 4) return;
  // Skip if message starts with a command prefix
  if (/^[.!#\/]/.test(text)) return;

  try {
    const translated = await mymemoryTranslate(text, toLang);
    if (!translated) return;

    const senderJid = msg.key.participant || msg.key.remoteJid;
    await sock.sendMessage(chatJid, {
      text:
        `🌐 *Auto Translate (→ ${LANG_NAMES[toLang] || toLang})*\n\n` +
        `@${senderJid.split('@')[0]}:\n_${translated}_\n\n> 🤖 *AA MD Bot*`,
      mentions: [senderJid],
    });
  } catch {}
}

// ── Command plugin ────────────────────────────────────────────────────────────
export default {
  command: 'autotranslate',
  alias: ['autotrans', 'grouptranslate', 'at'],
  description: 'Group mein sab messages auto-translate karo',
  category: 'group',
  groupOnly: true,
  adminOnly: true,

  async execute({ jid, args, reply, react, db: scopedDb }) {
    const sub    = (args[0] || '').toLowerCase();
    const grp    = scopedDb.groups.get(jid) || {};
    const status = grp.autoTranslate ? '✅ ON' : '❌ OFF';
    const curLang = grp.autoTranslateLang || 'en';

    if (!sub || sub === 'status') {
      return reply(
        `🌐 *Auto Translate*\n\n` +
        `Status: *${status}*\n` +
        `Target language: *${LANG_NAMES[curLang] || curLang}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ *.autotranslate on* — English mein translate\n` +
        `▸ *.autotranslate on ur* — Urdu mein\n` +
        `▸ *.autotranslate on ar* — Arabic mein\n` +
        `▸ *.autotranslate on hi* — Hindi mein\n` +
        `▸ *.autotranslate off* — band karo\n\n` +
        `*Available langs:* ${Object.entries(LANG_NAMES).map(([k,v]) => `${k}(${v})`).join(', ')}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'on') {
      const lang = (args[1] || 'en').toLowerCase().slice(0, 5);
      scopedDb.groups.set(jid, { autoTranslate: true, autoTranslateLang: lang });
      await react('✅');
      return reply(
        `✅ *Auto Translate ON!*\n\n` +
        `Target: *${LANG_NAMES[lang] || lang}*\n` +
        `Ab har message automatically translate hoga.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'off') {
      scopedDb.groups.set(jid, { autoTranslate: false });
      await react('❌');
      return reply(`❌ *Auto Translate OFF.*\n\n> 🤖 *AA MD Bot*`);
    }

    return reply(`❌ Usage: *.autotranslate on/off [lang]*\n\n> 🤖 *AA MD Bot*`);
  },
};
