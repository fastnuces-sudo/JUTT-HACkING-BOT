// ============================================
// AA MD Bot - Logo Generator
// Generates stylized text images via ephoto360
// with multiple fallback APIs
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 35000 });

// ── Style definitions ─────────────────────────────────────────────────────────
const STYLES = {
  hacker:      { id: '677', url: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html',           desc: 'Cyan neon hacker' },
  dragonball:  { id: '809', url: 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html',        desc: 'Dragon Ball Z' },
  naruto:      { id: '808', url: 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html',      desc: 'Naruto Shippuden' },
  sand:        { id: '582', url: 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html',         desc: 'Text on sand' },
  sunset:      { id: '807', url: 'https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html',             desc: 'Sunset light' },
  chocolate:   { id: '353', url: 'https://en.ephoto360.com/chocolate-text-effect-353.html',                               desc: 'Chocolate text' },
  mechanical:  { id: '306', url: 'https://en.ephoto360.com/create-your-name-in-a-mechanical-style-306.html',              desc: 'Mechanical steel' },
  rain:        { id: '75',  url: 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html',                              desc: 'Foggy rain' },
  graffiti:    { id: '721', url: 'https://en.ephoto360.com/graffiti-creator-online-721.html',                             desc: 'Graffiti street' },
  gold:        { id: '568', url: 'https://en.ephoto360.com/luxury-golden-3d-text-effect-568.html',                        desc: 'Luxury gold 3D' },
  steel:       { id: '347', url: 'https://en.ephoto360.com/dragon-steel-text-effect-online-347.html',                     desc: 'Dragon steel' },
  frozen:      { id: '792', url: 'https://en.ephoto360.com/create-a-frozen-christmas-text-effect-online-792.html',        desc: 'Frozen ice' },
  night:       { id: '85',  url: 'https://en.ephoto360.com/stars-night-online-1-85.html',                                 desc: 'Stars at night' },
  fire:        { id: '60',  url: 'https://en.ephoto360.com/fire-text-effect-online-60.html',                              desc: 'Fire burning' },
  neon:        { id: '197', url: 'https://en.ephoto360.com/neon-sign-generator-online-197.html',                          desc: 'Neon sign glow' },
  wood:        { id: '192', url: 'https://en.ephoto360.com/wood-burning-text-effect-online-192.html',                     desc: 'Wood burning' },
  water:       { id: '192w',url: 'https://en.ephoto360.com/write-name-on-water-192.html',                                 desc: 'Water ripple' },
  leaves:      { id: '153', url: 'https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html',     desc: 'Green brush' },
  sunlight:    { id: '204', url: 'https://en.ephoto360.com/sunlight-shadow-text-204.html',                                desc: 'Sunlight shadow' },
};

const STYLE_LIST = Object.entries(STYLES)
  .map(([k, v]) => `▸ *${k}* — ${v.desc}`)
  .join('\n');

// ── Method 1: ephoto360 via bochilapi public proxy ────────────────────────────
async function tryBochilProxy(styleUrl, text) {
  const { data } = await api.get(
    `https://bochilapi.up.railway.app/api/ephoto360?link=${encodeURIComponent(styleUrl)}&text=${encodeURIComponent(text)}`,
    { responseType: 'arraybuffer', timeout: 30000 }
  );
  const buf = Buffer.from(data);
  if (buf.length > 5000 && !buf.slice(0, 20).toString().includes('<')) return buf;
  throw new Error('bochil proxy returned non-image');
}

// ── Method 2: lolhuman ephoto360 wrapper ──────────────────────────────────────
async function tryLolhumanProxy(styleUrl, text) {
  const { data } = await api.get(
    `https://api.lolhuman.xyz/api/ephoto360?link=${encodeURIComponent(styleUrl)}&text=${encodeURIComponent(text)}`,
    { responseType: 'arraybuffer', timeout: 30000 }
  );
  const buf = Buffer.from(data);
  if (buf.length > 5000 && !buf.slice(0, 20).toString().includes('<')) return buf;
  throw new Error('lolhuman proxy returned non-image');
}

// ── Method 3: ephoto360 direct form submission ────────────────────────────────
async function tryEphoto360Direct(styleUrl, text) {
  // Step 1: GET the page to extract form token
  const pageResp = await api.get(styleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 20000,
  });
  const html = pageResp.data;

  // Extract token from _token input field
  const tokenMatch = html.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error('Could not find form token on ephoto360');
  const token = tokenMatch[1];

  // Extract action URL
  const actionMatch = html.match(/action="([^"]+)"/);
  if (!actionMatch) throw new Error('Could not find form action on ephoto360');
  const actionUrl = actionMatch[1];

  // Extract input field name(s) for text
  const inputMatches = [...html.matchAll(/name="(text[\w]*|txt[\w]*|input[\w]*)"/gi)];
  const textFieldName = inputMatches[0]?.[1] || 'text[0]';

  // Step 2: POST form
  const formData = new URLSearchParams();
  formData.append('_token', token);
  formData.append(textFieldName, text);

  const submitResp = await api.post(actionUrl, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': styleUrl,
      'Origin': 'https://en.ephoto360.com',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    },
    timeout: 25000,
  });

  // Extract image URL from response
  const resultHtml = submitResp.data;
  const imgMatch = resultHtml.match(/https:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/i);
  if (!imgMatch) throw new Error('Could not extract image from ephoto360 result');

  const imgUrl = imgMatch[0];
  const { data: imgBuf } = await api.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });
  const buf = Buffer.from(imgBuf);
  if (buf.length > 5000) return buf;
  throw new Error('ephoto360 direct: image too small');
}

// ── Method 4: mumaker (if installed) ─────────────────────────────────────────
async function tryMumaker(styleUrl, text) {
  const mumaker = await import('mumaker').catch(() => null);
  if (!mumaker) throw new Error('mumaker not available');
  const m = mumaker.default || mumaker;
  if (!m?.ephoto) throw new Error('mumaker.ephoto not found');
  const result = await m.ephoto(styleUrl, text);
  if (!result) throw new Error('mumaker returned no result');
  const { data: imgBuf } = await axios.get(result, { responseType: 'arraybuffer', timeout: 25000 });
  const buf = Buffer.from(imgBuf);
  if (buf.length > 5000) return buf;
  throw new Error('mumaker: image too small');
}

export default {
  command: 'logo',
  alias: ['textlogo', 'makelogo'],
  description: 'Generate a stylized text logo (20+ styles)',
  category: 'media',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `🎨 *Logo Generator*\n\n` +
      `*Usage:* ${prefix}logo <style> | <text>\n` +
      `*Example:* ${prefix}logo neon | AA MD Bot\n\n` +
      `*Available styles:*\n${STYLE_LIST}\n\n` +
      `> 🎨 *AA MD Bot*`
    );

    // Parse: "logo fire | my text" OR "logo fire my text"
    let style, logoText;
    if (text.includes('|')) {
      const [left, ...right] = text.split('|');
      style = left.trim().toLowerCase();
      logoText = right.join('|').trim();
    } else {
      const words = text.trim().split(/\s+/);
      style = words[0].toLowerCase();
      logoText = words.slice(1).join(' ').trim();
    }

    // If style not found, treat whole thing as text with default style
    if (!STYLES[style]) {
      logoText = text.trim();
      style = 'neon';
    }

    if (!logoText) return reply(`❌ Please provide text after the style.\n*Example:* ${prefix}logo ${style} | Your Text`);
    if (logoText.length > 30) return reply('❌ Text too long — max 30 characters.');

    const chosen = STYLES[style];
    await react('🎨');

    let imgBuf = null;
    const errors = [];

    // Try each method in order until one works
    // ephoto360-direct is FIRST — confirmed working from Replit (200)
    // Proxy services (bochil/lolhuman) are 404/400 from Replit IP
    for (const [name, fn] of [
      ['ephoto360-direct', () => tryEphoto360Direct(chosen.url, logoText)],
      ['mumaker', () => tryMumaker(chosen.url, logoText)],
      ['bochil-proxy', () => tryBochilProxy(chosen.url, logoText)],
      ['lolhuman-proxy', () => tryLolhumanProxy(chosen.url, logoText)],
    ]) {
      try {
        imgBuf = await fn();
        if (imgBuf?.length > 5000) break;
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }

    if (!imgBuf?.length) {
      await react('❌');
      console.error('[logo] All methods failed:', errors);
      return reply(
        `❌ *Logo generation failed*\n\n` +
        `All style servers are currently down.\n` +
        `Please try again in a minute.\n\n` +
        `> 🎨 *AA MD Bot*`
      );
    }

    await sock.sendMessage(jid, {
      image: imgBuf,
      caption: `🎨 *${style.toUpperCase()} Logo*\n📝 "${logoText}"\n\n> 🎨 *AA MD Bot*`,
    }, { quoted: msg });

    await react('✅');
  },
};
