// AA MD Bot - Temporary Email
// API: mail.tm — free, no key, proper REST, works from cloud IPs
import axios from 'axios';

const BASE = 'https://api.mail.tm';
const api  = axios.create({ baseURL: BASE, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

// In-memory sessions per JID: { email, password, token, accountId, createdAt }
const sessions = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getDomain() {
  const { data } = await api.get('/domains');
  const domain = data?.['hydra:member']?.[0]?.domain;
  if (!domain) throw new Error('Koi domain available nahi');
  return domain;
}

function randStr(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}

async function createAccount() {
  const domain   = await getDomain();
  const address  = `${randStr(10)}@${domain}`;
  const password = randStr(14);

  const { data: acc } = await api.post('/accounts', { address, password });
  if (!acc?.id) throw new Error('Account create nahi hua');

  const { data: tok } = await api.post('/token', { address, password });
  if (!tok?.token) throw new Error('Token nahi mila');

  return { email: address, password, token: tok.token, accountId: acc.id, createdAt: Date.now() };
}

async function getToken(sess) {
  // Refresh token if older than 55 minutes (JWT expires ~60 min)
  if (Date.now() - sess.createdAt > 55 * 60 * 1000) {
    const { data } = await api.post('/token', { address: sess.email, password: sess.password });
    sess.token = data.token;
    sess.createdAt = Date.now();
  }
  return sess.token;
}

async function getInbox(sess) {
  const token = await getToken(sess);
  const { data } = await api.get('/messages', { headers: { Authorization: `Bearer ${token}` } });
  return data?.['hydra:member'] || [];
}

async function readMessage(sess, id) {
  const token = await getToken(sess);
  const { data } = await api.get(`/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

async function deleteAccount(sess) {
  const token = await getToken(sess);
  await api.delete(`/accounts/${sess.accountId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function stripHtml(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2500);
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: 'tempmail',
  alias: ['tm', 'disposable', 'fakemail', 'tmpmail'],
  description: 'Temporary disposable email — inbox check + email read',
  category: 'tools',

  async execute({ reply, react, text, jid, prefix }) {
    const args = (text || '').trim();
    const sub  = args.toLowerCase().split(/\s+/)[0];

    // ── .tempmail new ────────────────────────────────────────────────────────
    if (sub === 'new' || sub === 'create') {
      await react('⏳');
      try {
        // Delete old account to avoid orphaned accounts
        const old = sessions.get(jid);
        if (old) deleteAccount(old).catch(() => {});

        const sess = await createAccount();
        sessions.set(jid, sess);
        await react('✅');
        return reply(
          `📧 *Naya Temporary Email*\n\n` +
          `📬 *Email:* \`${sess.email}\`\n\n` +
          `_Kisi bhi site pe ye email use karo — emails yahan ayenge_\n\n` +
          `*Commands:*\n` +
          `• *${prefix}tempmail inbox* — inbox check\n` +
          `• *${prefix}tempmail read <id>* — email parho\n` +
          `• *${prefix}tempmail new* — naya email\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      } catch (e) {
        await react('❌');
        return reply(`❌ Email create fail: ${e.message}\n\n> 🤖 *AA MD Bot*`);
      }
    }

    // ── .tempmail inbox ──────────────────────────────────────────────────────
    if (sub === 'inbox' || sub === 'check') {
      const sess = sessions.get(jid);
      if (!sess) return reply(
        `❌ Pehle email banao.\n*${prefix}tempmail* — naya email\n\n> 🤖 *AA MD Bot*`
      );
      await react('⏳');
      try {
        const emails = await getInbox(sess);
        if (!emails.length) {
          await react('✅');
          return reply(
            `📭 *Inbox Khaali Hai*\n\n` +
            `📬 *Email:* \`${sess.email}\`\n\n` +
            `_Abhi koi email nahi aya. Thodi der baad dobara check karo._\n\n` +
            `> 🤖 *AA MD Bot*`
          );
        }
        const list = emails.slice(0, 10).map((m, i) =>
          `*${i + 1}.* 📩 *From:* ${m.from?.address || m.from?.name || 'unknown'}\n` +
          `   *Subject:* ${m.subject || '(no subject)'}\n` +
          `   *Time:* ${timeAgo(m.createdAt)}\n` +
          `   _ID: \`${m.id}\`_\n` +
          `   👉 ${prefix}tempmail read ${m.id}`
        ).join('\n\n');
        await react('✅');
        return reply(
          `📬 *Inbox (${emails.length})*\n` +
          `📬 ${sess.email}\n` +
          `${'─'.repeat(28)}\n\n` +
          `${list}\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      } catch (e) {
        await react('❌');
        return reply(`❌ Inbox fetch fail: ${e.message}\n\n> 🤖 *AA MD Bot*`);
      }
    }

    // ── .tempmail read <id> ──────────────────────────────────────────────────
    if (sub === 'read') {
      const id   = args.split(/\s+/)[1];
      const sess = sessions.get(jid);
      if (!sess) return reply(`❌ Pehle email banao.\n*${prefix}tempmail*\n\n> 🤖 *AA MD Bot*`);
      if (!id)   return reply(`❌ ID batao.\n*Misaal:* _${prefix}tempmail read <id>_\n\n> 🤖 *AA MD Bot*`);
      await react('⏳');
      try {
        const mail = await readMessage(sess, id);
        if (!mail?.id) throw new Error('Email nahi mila');

        const body = mail.text
          ? mail.text.trim().slice(0, 2500)
          : stripHtml(mail.html);

        await react('✅');
        return reply(
          `📩 *Email*\n` +
          `${'─'.repeat(28)}\n` +
          `*From:* ${mail.from?.address || mail.from?.name || 'unknown'}\n` +
          `*To:* ${sess.email}\n` +
          `*Subject:* ${mail.subject || '(no subject)'}\n` +
          `*Time:* ${timeAgo(mail.createdAt)}\n` +
          `${'─'.repeat(28)}\n\n` +
          `${body || '(body khaali hai)'}\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      } catch (e) {
        await react('❌');
        return reply(`❌ Email read fail: ${e.message}\n\n> 🤖 *AA MD Bot*`);
      }
    }

    // ── .tempmail — create or show existing ─────────────────────────────────
    await react('⏳');
    try {
      let sess = sessions.get(jid);
      // Create new if no session exists or older than 55 min (JWT limit)
      if (!sess || Date.now() - sess.createdAt > 55 * 60 * 1000) {
        if (sess) deleteAccount(sess).catch(() => {});
        sess = await createAccount();
        sessions.set(jid, sess);
      }
      await react('✅');
      reply(
        `📧 *Temporary Email*\n\n` +
        `📬 *Email:* \`${sess.email}\`\n\n` +
        `_Kisi bhi site pe ye email use karo — emails yahan ayenge_\n\n` +
        `*Commands:*\n` +
        `• *${prefix}tempmail inbox* — inbox check karo\n` +
        `• *${prefix}tempmail read <id>* — email parho\n` +
        `• *${prefix}tempmail new* — naya email banao\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch (e) {
      await react('❌');
      reply(`❌ *Error:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
