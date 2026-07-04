// ============================================
// AA MD Bot - Image Search
// Uses Bing Images (no API key needed)
// ============================================
import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.bing.com/',
};

function htmlDecode(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function searchBingImages(query, count = 5) {
  const { data } = await axios.get(
    `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&count=${count + 5}&mmasync=1&adlt=off`,
    { headers: HEADERS, timeout: 12000 }
  );

  const urls = [];

  // Pattern 1: murl in JSON-like structure (HTML-encoded quotes)
  // Capture everything up to the closing &quot; — must handle URLs with & query params
  const re1 = /murl&quot;:&quot;(https(?:(?!&quot;).)+)&quot;/g;
  for (const m of data.matchAll(re1)) {
    const url = htmlDecode(m[1]);
    if (url.startsWith('http') && !urls.includes(url)) urls.push(url);
    if (urls.length >= count) break;
  }

  // Pattern 2: raw JSON fallback (unescaped)
  if (urls.length < count) {
    const re2 = /"murl":"(https[^"]+)"/g;
    for (const m of data.matchAll(re2)) {
      const url = m[1];
      if (url.startsWith('http') && !urls.includes(url)) urls.push(url);
      if (urls.length >= count) break;
    }
  }

  return urls.slice(0, count);
}

export default {
  command: 'img',
  alias: ['image', 'gimage', 'googleimage', 'imgsearch'],
  description: 'Search and send images',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(
        `🖼️ *Image Search*\n\n` +
        `Example: *${prefix}img cats*\n` +
        `Example: *${prefix}img sunset mountains*`
      );
    }

    await react('🖼️');

    try {
      const urls = await searchBingImages(text, 5);

      if (!urls.length) {
        await react('❌');
        return reply(`❌ No images found for: *${text}*`);
      }

      let sent = 0;
      for (const imgUrl of urls) {
        try {
          await sock.sendMessage(jid, {
            image: { url: imgUrl },
            caption: sent === 0
              ? `🖼️ *Image Search:* ${text}\n\n> 🤖 *Powered by AA MD Bot*`
              : '',
          }, { quoted: sent === 0 ? msg : undefined });
          sent++;
          if (sent >= 5) break;
        } catch {
          // Skip broken image URLs
        }
      }

      if (sent === 0) {
        await react('❌');
        return reply(`❌ Could not load any images for: *${text}*`);
      }

      await react('✅');

    } catch (err) {
      console.error('Img search error:', err.message);
      await react('❌');
      return reply('❌ Image search failed. Please try again in a few seconds.');
    }
  },
};
