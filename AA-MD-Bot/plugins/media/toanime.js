// AA MD Bot — Image to Anime Style
// Converts a replied image to anime style via fgsi API

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { uploadImage } from '../../lib/imageUpload.js';

export default {
  command: 'toanime',
  alias: ['animefilter', 'animestyle'],
  description: 'Convert a replied image to anime/cartoon style',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO ANIME ≪━━━\n├ \n` +
        `├ Reply to an image to convert\n├ it to anime style.\n` +
        `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 10 * 1024 * 1024) {
        await react('❌');
        return reply('❌ Image too large (max 10MB).');
      }
      const imageUrl = await uploadImage(buffer, 'image.jpg');
      const apiResp = await axios.get(
        'https://fgsi.koyeb.app/api/ai/image/toAnime',
        { params: { apikey: 'fgsiapi-2dcdfa06-6d', url: imageUrl }, responseType: 'arraybuffer', timeout: 90000 }
      );
      const result = Buffer.from(apiResp.data);
      await sock.sendMessage(jid, {
        image: result,
        caption:
          `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ ANIME STYLE ≪━━━\n├ \n` +
          `├ Anime transformation complete!\n` +
          `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TOANIME ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
