// AA MD Bot — AI Logo Generator
// Generates logos via sologo.ai API

import axios from 'axios';

export default {
  command: 'logogen',
  alias: ['ailogo', 'generatelogo', 'makelogo2'],
  description: 'AI logo generator — .logogen Title|Idea|Slogan',
  category: 'media',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├≪━━━ LOGO GEN ≪━━━\n├ \n` +
        `├ Format: ${prefix}logogen Title|Idea|Slogan\n├ \n` +
        `├ Example:\n├ ${prefix}logogen ToxicTech|AI Services|Innovation First\n` +
        `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
    const [title, idea, slogan] = text.split('|').map(s => s?.trim());
    if (!title || !idea || !slogan) {
      await react('❌');
      return reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├≪━━━ LOGO GEN ≪━━━\n├ \n` +
        `├ Use: ${prefix}logogen Title|Idea|Slogan\n` +
        `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
    await react('⌛');
    try {
      const payload = {
        ai_icon: [333276, 333279],
        height: 300, idea,
        industry_index: 'N', industry_index_id: '',
        pagesize: 4, session_id: '',
        slogan, title,
        whiteEdge: 80, width: 400,
      };
      const { data } = await axios.post('https://www.sologo.ai/v1/api/logo/logo_generate', payload, { timeout: 30000 });
      const logos = data?.data?.logoList;
      if (!logos?.length) throw new Error('No logos generated');
      for (const logo of logos) {
        await sock.sendMessage(jid, {
          image: { url: logo.logo_thumb },
          caption:
            `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├≪━━━ LOGO ≪━━━\n├ \n` +
            `├ Generated logo for *"${title}"*\n` +
            `╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`,
        }, { quoted: msg });
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(
        `╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├≪━━━ LOGO ERROR ≪━━━\n├ \n` +
        `├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`
      );
    }
  },
};
