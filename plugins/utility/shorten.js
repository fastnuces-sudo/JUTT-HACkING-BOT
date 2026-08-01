import axios from 'axios';

export default {
  command: 'shorten',
  alias: ['shorturl', 'tinyurl', 'short'],
  description: 'Shorten a long URL using TinyURL',
  category: 'utility',
  usage: '.shorten <URL>',

  async execute({ reply, args }) {
    let url = args[0];
    if (!url) {
      return reply('🔗 Usage: .shorten <URL>\n\nExample: .shorten https://example.com/very-long-url');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const { data } = await axios.get(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
        { timeout: 10000 }
      );

      if (!data || !data.startsWith('http')) throw new Error('Invalid response');

      const display = url.length > 55 ? url.slice(0, 52) + '...' : url;

      reply(
        `🔗 *URL Shortened!*\n\n` +
        `📎 *Original:* ${display}\n` +
        `✅ *Short URL:* ${data}\n\n` +
        `_Click the short URL to open the original link_`
      );
    } catch (err) {
      reply('❌ Shortening failed. Check the URL and try again.\n_' + (err.message?.slice(0, 60) || '') + '_');
    }
  },
};
