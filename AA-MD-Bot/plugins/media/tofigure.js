// AA MD Bot — To Figure Filter
// Applies figure art filter to a replied image

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { uploadImage } from '../../lib/imageUpload.js';

export default {
  command: 'tofigure',
  alias: ['figurefilter', 'figure'],
  description: 'Apply figure art filter to a replied image',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO FIGURE ≪━━━\n├ \n` +
        `├ Reply to an image to apply\n├ the figure filter.\n` +
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
      const imageUrl = await uploadImage(buffer, 'image.png');
      const apiResp = await axios.get(
        `https://api.fikmydomainsz.xyz/imagecreator/tofigur?url=${encodeURIComponent(imageUrl)}`,
        { timeout: 30000 }
      );
      if (!apiResp.data?.status || !apiResp.data?.result) throw new Error('API returned no result');
      const imgBuf = Buffer.from(
        (await axios.get(apiResp.data.result, { responseType: 'arraybuffer', timeout: 20000 })).data
      );
      await sock.sendMessage(jid, {
        image: imgBuf,
        caption:
          `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO FIGURE ≪━━━\n├ \n` +
          `├ Figure filter applied!\n` +
          `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ FIGURE ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
