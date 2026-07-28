// AA MD Bot — Negro/Blacken Image Filter
// Applies black filter to a replied image via negro.consulting API

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'negro',
  alias: ['blackfilter', 'darkfilter', 'hitam'],
  description: 'Apply black/dark filter to a replied image',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ NEGRO ≪━━━\n├ \n` +
        `├ Reply to an image to apply\n├ the black filter.\n` +
        `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const base64Image = buffer.toString('base64');
      const response = await axios.post(
        'https://negro.consulting/api/process-image',
        { filter: 'hitam', imageData: 'data:image/png;base64,' + base64Image },
        { timeout: 30000 }
      );
      const resultBuffer = Buffer.from(
        response.data.processedImageUrl.replace('data:image/png;base64,', ''),
        'base64'
      );
      await sock.sendMessage(jid, {
        image: resultBuffer,
        caption:
          `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ NEGRO FILTER ≪━━━\n├ \n` +
          `├ Black filter applied!\n` +
          `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ NEGRO ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
