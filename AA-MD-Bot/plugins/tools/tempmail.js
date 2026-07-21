// AA MD Bot - Temporary Email
// Free: GuerrillaMail API — no key needed
import axios from 'axios';

const BASE = 'https://api.guerrillamail.com/ajax.php';
const api  = axios.create({ timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });

// In-memory sessions per JID: { email, sid_token, alias, createdAt }
const sessions = new Map();

async function createEmail() {
  const { data } = await api.get(`${BASE}?f=get_email_address`);
  if (!data?.email_addr) throw new Error('Email create nahi hua');
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
          `_Ye email 1 ghante tak active rahega_\n\n` +
          `*Commands:*\n` +
          `• *${prefix}tempmail inbox* — inbox check karo\n` +
          `• *${prefix}tempmail read <id>* — email parho\n` +
          `• *${prefix}tempmail new* — naya email banao\n\n` +
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
        const emails = await checkInbox(sess.token);
        if (!emails.length) {
          await react('✅');
          return reply(
            `📭 *Inbox Khaali Hai*\n\n📬 Email: \`${sess.email}\`\n\n_Abhi koi email nahi aya. Dobara try karo._\n\n> 🤖 *AA MD Bot*`
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
      if (!sess) return reply(`❌ Pehle email banao.\n*${prefix}tempmail*\n\n> 🤖 *AA MD Bot*`);
      if (!id)   return reply(`❌ ID batao.\n*Misaal:* _${prefix}tempmail read 12345_\n\n> 🤖 *AA MD Bot*`);
      await react('⏳');
      try {
        const mail = await fetchEmail(id, sess.token);
        if (!mail?.mail_id) throw new Error('Email nahi mila');

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
