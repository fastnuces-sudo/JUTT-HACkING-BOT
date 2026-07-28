// AA MD Bot — Sticker to MP4 Video
// Converts a replied webp sticker to mp4 video via elrayyxml API

import axios from 'axios';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { uploadImage } from '../../lib/imageUpload.js';

export default {
  command: 'tomp4',
  alias: ['tovideo', 'stickertomp4', 'sticker2video', 'tovid'],
  description: 'Convert a replied sticker to MP4 video',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const stickerMsg = quoted?.message?.stickerMessage;
    if (!stickerMsg) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO VIDEO ≪━━━\n├ \n` +
        `├ Reply to a *sticker* to convert\n├ it to MP4 video.\n` +
        `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const stickerBuffer = Buffer.concat(chunks);
      const stickerUrl = await uploadImage(stickerBuffer, `sticker_${Date.now()}.webp`);
      const encodedUrl = encodeURIComponent(stickerUrl);
      const convertResp = await axios.get(
        `https://api.elrayyxml.web.id/api/maker/convert?url=${encodedUrl}&format=MP4`,
        { headers: { accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 }
      );
      if (!convertResp.data?.status || !convertResp.data?.result) throw new Error('Converter returned no result');
      const videoUrl = convertResp.data.result;
      const videoResp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 20000 });
      const videoBuffer = Buffer.from(videoResp.data);
      await sock.sendMessage(jid, {
        video: videoBuffer,
        mimetype: 'video/mp4',
        caption:
          `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TO VIDEO ≪━━━\n├ \n` +
          `├ Sticker converted to video!\n` +
          `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ TOVID ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
