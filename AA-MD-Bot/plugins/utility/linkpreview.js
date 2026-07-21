// ============================================
// AA MD Bot - Link Preview
// Developer: Ahsan Ali | AA Mods
// Kisi bhi URL ka title/desc/image dikhao
// ============================================

import axios from 'axios';

// Parse meta tags from raw HTML
function getMeta(html, prop) {
  // og: and twitter: and standard meta
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']twitter:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function getTitle(html) {
  const og = getMeta(html, 'title');
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m ? decodeHtmlEntities(m[1].trim()) : null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function ensureHttps(url) {
  if (!url) return null;
  if (url.startsWith('//')) return 'https:' + url;
  if (!url.startsWith('http')) return null;
  return url;
}

export default {
  command: 'preview',
  alias: ['linkpreview', 'lp', 'site', 'linkinfo'],
  description: 'Kisi bhi link ka title, description aur image dikhao',
  category: 'utility',
  usage: '.preview <url>',

  async execute({ sock, jid, msg, reply, react, args }) {
    let url = args[0] || '';

    // Accept URL from quoted message text too
    if (!url) {
      const qText =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';
      const urlMatch = qText.match(/https?:\/\/[^\s]+/);
      if (urlMatch) url = urlMatch[0];
    }

    if (!url || !url.startsWith('http')) {
      return reply(
        `🔗 *Link Preview*\n\n` +
        `URL dena zaroori hai.\n\n` +
        `*Usage:*\n` +
        `▸ *.preview https://example.com*\n` +
        `▸ Kisi link wale message ko reply kar ke *.preview*\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');

    try {
      // Fetch page (follow redirects, timeout 15s)
      const res = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        responseType: 'text',
        maxContentLength: 500_000,  // 500KB max
      });

      const html      = res.data || '';
      const finalUrl  = res.request?.res?.responseUrl || url;
      const domain    = new URL(finalUrl).hostname.replace('www.', '');

      const title    = getTitle(html)           || '(No title)';
      const desc     = getMeta(html, 'description') || getMeta(html, 'desc') || '(No description)';
      const imageUrl = ensureHttps(getMeta(html, 'image') || getMeta(html, 'image:src'));

      const text =
        `🔗 *Link Preview*\n\n` +
        `🌐 *Site:* ${domain}\n` +
        `📌 *Title:* ${title.slice(0, 200)}\n` +
        `📝 *Description:*\n${desc.slice(0, 400)}\n\n` +
        `🔗 *URL:* ${finalUrl}\n\n` +
        `> 🤖 *AA MD Bot*`;

      // Send with image if available
      if (imageUrl) {
        try {
          const imgRes = await axios.get(imageUrl, {
            responseType: 'arraybuffer', timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          const imgBuf = Buffer.from(imgRes.data);
          await sock.sendMessage(jid, {
            image: imgBuf,
            caption: text,
          }, { quoted: msg });
          await react('✅');
          return;
        } catch {}
      }

      await react('✅');
      return reply(text);

    } catch (err) {
      await react('❌');
      return reply(`❌ *Preview load nahi hua.*\n\n${err.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
