// ============================================
// AA MD Bot - Logo Generator
// Generates stylized text images via ephoto360
// ============================================

import mumaker from 'mumaker';
import axios from 'axios';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import config from '../../config.js';

const STYLES = {
  hacker:      { url: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html',           desc: 'Cyan neon hacker style' },
  dragonball:  { url: 'https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html',        desc: 'Dragon Ball Z style' },
  naruto:      { url: 'https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html',      desc: 'Naruto Shippuden style' },
  sand:        { url: 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html',         desc: 'Text on sand' },
  sunset:      { url: 'https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html',             desc: 'Sunset light effect' },
  chocolate:   { url: 'https://en.ephoto360.com/chocolate-text-effect-353.html',                               desc: 'Chocolate text' },
  mechanical:  { url: 'https://en.ephoto360.com/create-your-name-in-a-mechanical-style-306.html',              desc: 'Mechanical steel style' },
  rain:        { url: 'https://en.ephoto360.com/foggy-rainy-text-effect-75.html',                              desc: 'Foggy rainy effect' },
  cloth:       { url: 'https://en.ephoto360.com/text-on-cloth-effect-62.html',                                 desc: 'Text on cloth' },
  water:       { url: 'https://en.ephoto360.com/write-name-on-water-192.html',                                 desc: 'Water ripple effect' },
  graffiti:    { url: 'https://en.ephoto360.com/graffiti-creator-online-721.html',                             desc: 'Graffiti street style' },
  gold:        { url: 'https://en.ephoto360.com/luxury-golden-3d-text-effect-568.html',                        desc: 'Luxury gold 3D text' },
  steel:       { url: 'https://en.ephoto360.com/dragon-steel-text-effect-online-347.html',                     desc: 'Dragon steel style' },
  sunlight:    { url: 'https://en.ephoto360.com/sunlight-shadow-text-204.html',                                desc: 'Sunlight shadow' },
  frozen:      { url: 'https://en.ephoto360.com/create-a-frozen-christmas-text-effect-online-792.html',        desc: 'Frozen ice text' },
  leaves:      { url: 'https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html',     desc: 'Green brush leaves' },
  night:       { url: 'https://en.ephoto360.com/stars-night-online-1-85.html',                                 desc: 'Stars at night' },
  fire:        { url: 'https://en.ephoto360.com/fire-text-effect-online-60.html',                              desc: 'Fire burning text' },
  neon:        { url: 'https://en.ephoto360.com/neon-sign-generator-online-197.html',                          desc: 'Neon sign glow' },
  wood:        { url: 'https://en.ephoto360.com/wood-burning-text-effect-online-192.html',                     desc: 'Wood burning text' },
};

const STYLE_LIST = Object.entries(STYLES)
  .map(([k, v]) => `▸ *${k}* — ${v.desc}`)
  .join('\n');

export default {
  command: 'logo',
  alias: ['textlogo', 'makelogo'],
  description: 'Generate a stylized text logo (20+ styles)',
  category: 'media',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `🎨 *Logo Generator*\n\n` +
      `*Usage:* ${prefix}logo <style> | <text>\n` +
      `*Example:* ${prefix}logo hacker | AA MD Bot\n\n` +
      `*Available styles:*\n${STYLE_LIST}\n\n` +
      `> 🎨 *AA MD Bot*`
    );

    const [stylePart, ...rest] = text.split('|');
    const style = stylePart.trim().toLowerCase();
    const logoText = rest.join('|').trim() || stylePart.trim();

    if (!STYLES[style] && rest.length === 0) {
      // No pipe: treat first word as style, rest as text
      const words = text.trim().split(/\s+/);
      const firstWord = words[0].toLowerCase();
      if (STYLES[firstWord]) {
        return this.execute({ text: `${firstWord}|${words.slice(1).join(' ')}`, reply, react, sock, jid, msg, prefix });
      }
    }

    const chosen = STYLES[style] || STYLES['neon'];
    const finalText = logoText || text;

    if (!finalText || finalText.length < 1) return reply('❌ Please provide text for the logo.');
    if (finalText.length > 30) return reply('❌ Text too long. Max 30 characters.');

    await react('🎨');

    try {
      const result = await mumaker.ephoto(chosen.url, finalText);
      if (!result) throw new Error('No result from logo API');

      const { data: imgBuf } = await axios.get(result, { responseType: 'arraybuffer', timeout: 30000 });

      await sock.sendMessage(jid, {
        image: Buffer.from(imgBuf),
        caption: `🎨 *${style.toUpperCase()} Logo*\n📝 "${finalText}"\n\n> 🎨 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Logo generation failed: ${e.message}\n\n*Try:* ${prefix}logo neon | ${finalText}\n\n> 🎨 *AA MD Bot*`);
    }
  },
};
