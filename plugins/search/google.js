import { searchit } from '@fantox01/search-it';

export default {
  command: 'google',
  alias: ['search'],
  description: 'Search Google',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide an image Search Term !\n\nExample: *${prefix}search Free Web development Course*`);
    }
    await react('🔍');
    try {
      const googleSearch = await searchit(text, 10);
      if (!googleSearch || googleSearch.length === 0) {
        await react('❌');
        return reply(`No results found for: *${text}*`);
      }
      let resText = `  *『  ⚡️ Google Search Engine ⚡️  』*\n\n\n_🔍 Search Term:_ *${text}*\n\n\n`;
      for (const result of googleSearch) {
        resText += `_📍 Result:_ *${result.index + 1}*\n\n_🎀 Title:_ *${result.page}*\n\n_🔶 Description:_ *${result.desc}*\n\n_🔷 Link:_ *${result.url}*\n\n\n`;
      }
      await sock.sendMessage(jid, {
        video: { url: 'https://media.tenor.com/3aaAzbTrTMwAAAPo/google-technology-company.mp4' },
        gifPlayback: true,
        caption: resText,
      }, { quoted: msg });
    } catch (err) {
      console.error('Search error:', err);
      await react('❌');
      return reply(`An error occurred while searching for: *${text}*`);
    }
  },
};
