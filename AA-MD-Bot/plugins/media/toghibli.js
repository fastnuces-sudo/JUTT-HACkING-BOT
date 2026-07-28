// AA MD Bot — Image to Ghibli Style
// Converts a replied image to Studio Ghibli art style via fgsi API

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { uploadImage } from '../../lib/imageUpload.js';

export default {
  command: 'toghibli',
  alias: ['ghibli', 'ghiblistyle', 'ghibliart'],
  description: 'Convert a replied image to Studio Ghibli art style',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO GHIBLI ≪━━━\n├ \n` +
        `├ Reply to an image to convert\n├ it to Ghibli art style.\n` +
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
        'https://fgsi.koyeb.app/api/ai/image/toGhibli',
        { params: { apikey: 'fgsiapi-2dcdfa06-6d', url: imageUrl }, responseType: 'arraybuffer', timeout: 120000 }
      );
      const result = Buffer.from(apiResp.data);
      await sock.sendMessage(jid, {
        image: result,
        caption:
          `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ GHIBLI STYLE ≪━━━\n├ \n` +
          `├ Your image has been reimagined in\n├ *Studio Ghibli* style!\n` +
          `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ GHIBLI ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
