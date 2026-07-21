// AA MD Bot - Temporary Email
// Free: GuerrillaMail API — no key needed
import axios from 'axios';

const BASE = 'https://api.guerrillamail.com/ajax.php';
const api  = axios.create({ timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });

// In-memory sessions per JID: { email, sid_token, alias, createdAt }
const sessions = new Map();

async function createEmail() {
  const { data } = await api.get(`${BASE}?f=get_email_address`);
  if (!data?.email_addr) throw new Error('Failed to create email address');
  return {
    email:   data.email_addr,
    token:   data.sid_token,
    alias:   data.alias,
    created: Date.now(),
  };
}

async function checkInbox(token) {
  const { data } = await api.get(`${BASE}?f=check_email&seq=0&sid_token=${encodeURIComponent(token)}`);
  return data?.list || [];
}

async function fetchEmail(id, token) {
  const { data } = await api.get(`${BASE}?f=fetch_email&email_id=${id}&sid_token=${encodeURIComponent(token)}`);
  return data;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

export default {
  command: 'tempmail',
  alias: ['tm', 'disposable', 'fakemail', 'tmpmail'],
  description: 'Temporary disposable email — inbox check + read',
  category: 'tools',

  async execute({ reply, react, text, jid, prefix }) {
    const sub = (text || '').trim().toLowerCase();

    // ── .tempmail new — force create new email ───────────────────────────────
    if (sub === 'new' || sub === 'create') {
      await react('⏳');
      try {
        const sess = await createEmail();
        sessions.set(jid, sess);
        await react('✅');
        return reply(
          `📧 *Temporary Email Created*\n\n` +
          `📬 *Email:* \`${sess.email}\`\n\n` +
          `_This email will be active for 1 hour_\n\n` +
          `*Commands:*\n` +
          `• *${prefix}tempmail inbox* — check inbox\n` +
          `• *${prefix}tempmail read <id>* — read an email\n` +
          `• *${prefix}tempmail new* — create a new email\n\n` +
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
        `❌ Please create an email first.\n*${prefix}tempmail* — create new email\n\n> 🤖 *AA MD Bot*`
      );
      await react('⏳');
      try {
        const emails = await checkInbox(sess.token);
        if (!emails.length) {
          await react('✅');
          return reply(
            `📭 *Inbox is Empty*\n\n📬 Email: \`${sess.email}\`\n\n_No emails yet. Try again in a moment._\n\n> 🤖 *AA MD Bot*`
          );
        }
        const list = emails.slice(0, 10).map((e, i) =>
          `*${i+1}.* 📩 *From:* ${e.mail_from}\n` +
          `   *Subject:* ${e.mail_subject || '(no subject)'}\n` +
          `   *Time:* ${timeAgo(e.mail_timestamp)}\n` +
          `   _ID: ${e.mail_id} → ${prefix}tempmail read ${e.mail_id}_`
        ).join('\n\n');
        await react('✅');
        return reply(
          `📬 *Inbox — ${sess.email}*\n` +
          `${'─'.repeat(28)}\n\n${list}\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      } catch (e) {
        await react('❌');
        return reply(`❌ Inbox fetch fail: ${e.message}\n\n> 🤖 *AA MD Bot*`);
      }
    }

    // ── .tempmail read <id> ──────────────────────────────────────────────────
    if (sub.startsWith('read')) {
      const id = sub.split(/\s+/)[1] || text.trim().split(/\s+/)[1];
      const sess = sessions.get(jid);
      if (!sess) return reply(`❌ Please create an email first.\n*${prefix}tempmail*\n\n> 🤖 *AA MD Bot*`);
      if (!id)   return reply(`❌ Please provide an ID.\n*Example:* _${prefix}tempmail read 12345_\n\n> 🤖 *AA MD Bot*`);
      await react('⏳');
      try {
        const mail = await fetchEmail(id, sess.token);
        if (!mail?.mail_id) throw new Error('Email not found');

        // Strip HTML tags for WhatsApp display
        const body = (mail.mail_body || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n')
          .trim()
          .slice(0, 2000);

        await react('✅');
        return reply(
          `📩 *Email*\n` +
          `${'─'.repeat(28)}\n` +
          `*From:* ${mail.mail_from}\n` +
          `*To:* ${mail.mail_recipient}\n` +
          `*Subject:* ${mail.mail_subject || '(no subject)'}\n` +
          `${'─'.repeat(28)}\n\n` +
          `${body || '(empty body)'}\n\n` +
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
      // Create new if none or older than 50 minutes
      if (!sess || Date.now() - sess.created > 50 * 60 * 1000) {
        sess = await createEmail();
        sessions.set(jid, sess);
      }
      await react('✅');
      reply(
        `📧 *Temporary Email*\n\n` +
        `📬 *Email:* \`${sess.email}\`\n\n` +
        `_Use this email on any site — emails will appear here_\n\n` +
        `*Commands:*\n` +
        `• *${prefix}tempmail inbox* — check inbox\n` +
        `• *${prefix}tempmail read <id>* — read an email\n` +
        `• *${prefix}tempmail new* — create a new email\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch (e) {
      await react('❌');
      reply(`❌ *Error:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
