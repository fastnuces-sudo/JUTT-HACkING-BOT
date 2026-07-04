import axios from 'axios';

const API = 'https://api.mail.tm';
const UA  = { 'User-Agent': 'AA-MD-Bot/3.0', 'Content-Type': 'application/json' };

// In-memory store: senderJid → { address, password, token, created, _messages }
const sessions = new Map();

function randStr(len = 10) {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

async function getDomain() {
  const { data } = await axios.get(`${API}/domains?page=1`, { headers: UA, timeout: 10000 });
  const items = data?.['hydra:member'] || [];
  if (!items.length) throw new Error('No domains available');
  return items[0].domain;
}

async function createAccount(jid) {
  const domain   = await getDomain();
  const username = `aabot${randStr(7)}`;
  const password = randStr(12);
  const address  = `${username}@${domain}`;
  await axios.post(`${API}/accounts`, { address, password }, { headers: UA, timeout: 12000 });
  const { data } = await axios.post(`${API}/token`, { address, password }, { headers: UA, timeout: 12000 });
  if (!data?.token) throw new Error('Failed to get auth token');
  const s = { address, password, token: data.token, created: Date.now(), _messages: [] };
  sessions.set(jid, s);
  return s;
}

async function refreshToken(s) {
  try {
    const { data } = await axios.post(`${API}/token`, { address: s.address, password: s.password }, { headers: UA, timeout: 10000 });
    if (data?.token) s.token = data.token;
  } catch {}
  return s.token;
}

async function getInbox(s) {
  const token = await refreshToken(s);
  const { data } = await axios.get(`${API}/messages?page=1`, { headers: { ...UA, Authorization: `Bearer ${token}` }, timeout: 12000 });
  return data?.['hydra:member'] || [];
}

async function readMsg(s, id) {
  const token = await refreshToken(s);
  const { data } = await axios.get(`${API}/messages/${id}`, { headers: { ...UA, Authorization: `Bearer ${token}` }, timeout: 12000 });
  return data;
}

export default {
  command: 'tempmail',
  alias: ['tmail', 'tmpmail', 'fakemail'],
  description: 'Create & check a temporary email address',
  category: 'utility',
  usage: '.tempmail | .tempmail new | .tempmail check | .tempmail read 1',

  async execute({ reply, senderJid, args }) {
    const sub  = (args[0] || '').toLowerCase();
    const sess = sessions.get(senderJid);

    // ── CREATE (new or first time) ──────────────────────────
    if (sub === 'new' || (!sub && !sess)) {
      await reply('📧 _Creating temporary email..._');
      try {
        const s = await createAccount(senderJid);
        return reply(
          `╔══════════════════════════╗\n` +
          `║  📧 *TEMP EMAIL CREATED* ║\n` +
          `╚══════════════════════════╝\n\n` +
          `📬 *Email:*\n\`${s.address}\`\n\n` +
          `🔑 *Password:* \`${s.password}\`\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📥 Use *.tempmail check* to see inbox\n` +
          `📖 Use *.tempmail read 1* to read email\n\n` +
          `⚠️ _Expires when bot restarts_`
        );
      } catch (err) {
        return reply('❌ Failed to create temp email. Please try again in a few seconds.');
      }
    }

    // ── SHOW CURRENT ────────────────────────────────────────
    if (!sub && sess) {
      return reply(
        `📧 *Your Temp Email*\n\n` +
        `📬 \`${sess.address}\`\n` +
        `⏰ Created: ${new Date(sess.created).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}\n\n` +
        `• *.tempmail check* — Check inbox\n` +
        `• *.tempmail read 1* — Read first email\n` +
        `• *.tempmail new* — Create new`
      );
    }

    // ── CHECK INBOX ─────────────────────────────────────────
    if (sub === 'check' || sub === 'inbox') {
      if (!sess) return reply('❌ No temp email. Create one with *.tempmail*');
      await reply(`📥 _Checking inbox for_ \`${sess.address}\`_..._`);
      try {
        const msgs = await getInbox(sess);
        sess._messages = msgs.map(m => m.id);
        if (!msgs.length) {
          return reply(`📭 *Inbox Empty*\n\nNo emails yet for:\n\`${sess.address}\`\n\n_Emails may take 1-2 min to arrive._`);
        }
        let text = `📬 *Inbox — ${sess.address}*\n📩 ${msgs.length} email(s):\n\n`;
        msgs.slice(0, 10).forEach((m, i) => {
          text += `*${i + 1}.* 📧 ${m.subject || '(No Subject)'}\n`;
          text += `   👤 ${m.from?.address || 'Unknown'}\n\n`;
        });
        text += `📖 Read: *.tempmail read 1*`;
        return reply(text);
      } catch (err) {
        return reply('❌ Inbox check failed. Please try again in a few seconds.');
      }
    }

    // ── READ EMAIL ──────────────────────────────────────────
    if (sub === 'read') {
      if (!sess) return reply('❌ No temp email. Create one with *.tempmail*');
      const idx = parseInt(args[1] || '1', 10) - 1;
      if (!sess._messages?.length) return reply('❌ No emails yet. Use *.tempmail check* first.');
      if (!sess._messages[idx]) return reply(`❌ No email at #${idx + 1}. Try *.tempmail check* first.`);
      await reply('📖 _Loading email..._');
      try {
        const m    = await readMsg(sess, sess._messages[idx]);
        const body = (m.text || m.html?.replace(/<[^>]+>/g, ' ') || '(Empty body)').trim().slice(0, 2500);
        return reply(
          `📧 *Email #${idx + 1}*\n\n` +
          `📋 *Subject:* ${m.subject || '(No Subject)'}\n` +
          `👤 *From:* ${m.from?.address || 'Unknown'}\n\n` +
          `━━━━━━━━━━━━━━━━\n\n${body}`
        );
      } catch (err) {
        return reply('❌ Failed to read email. Please try again in a few seconds.');
      }
    }

    // ── FALLBACK HELP ───────────────────────────────────────
    return reply(
      `📧 *Temp Mail Commands*\n\n` +
      `• *.tempmail* — Create or show your email\n` +
      `• *.tempmail new* — New temp email address\n` +
      `• *.tempmail check* — Check inbox\n` +
      `• *.tempmail read 1* — Read first email`
    );
  },
};
