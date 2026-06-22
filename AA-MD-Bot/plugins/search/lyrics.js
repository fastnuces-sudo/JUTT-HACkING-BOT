import { getLyrics } from '@fantox01/lyrics-scraper';

export default {
  command: 'lyrics',
  alias: ['lyric'],
  description: 'Get song lyrics',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide an lyrics Search Term !\n\nExample: *${prefix}lyrics Heat waves*`);
    }
    await react('📃');
    try {
      let result = await getLyrics(text);
      if (result && result.status !== 500 && result.lyrics && result.thumbnail) {
        let resText2 = `  *『  ⚡️ Lyrics Search Engine ⚡️  』*\n\n\n_Search Term:_ *${text}*\n\n\n*📍 Lyrics:* \n\n${result.lyrics}\n\n\n_*Powered by:*_ *Lyrics Scraper - by FantoX*\n\n_*Url:*_ https://github.com/FantoX/lyrics-scraper \n`;
        await sock.sendMessage(jid, {
          image: { url: result.thumbnail },
          caption: resText2,
        }, { quoted: msg });
      } else {
        await react('❌');
        return reply(result?.message || `Unable to find lyrics for the song: *${text}*`);
      }
    } catch (err) {
      console.error('Lyrics Error:', err);
      await react('❌');
      return reply(`An error occurred while fetching lyrics for: *${text}*`);
    }
  },
};
