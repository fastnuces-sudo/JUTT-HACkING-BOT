import axios from 'axios';

export default {
  command: 'ytsearch',
  alias: ['youtube', 'yt'],
  description: 'Search YouTube videos',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .ytsearch [query]\nExample: .ytsearch Alan Walker faded');
    try {
      const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(text)}&sp=EgIQAQ%3D%3D`);
      const match = res.data.match(/var ytInitialData = (.+?);<\/script>/);
      if (!match) throw new Error('parse error');
      const data = JSON.parse(match[1]);
      const videos = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents
        ?.filter(c => c.videoRenderer)
        ?.slice(0, 5)
        ?.map(c => {
          const v = c.videoRenderer;
          return {
            title: v.title?.runs?.[0]?.text || 'Unknown',
            id: v.videoId,
            channel: v.ownerText?.runs?.[0]?.text || 'Unknown',
            duration: v.lengthText?.simpleText || 'N/A',
            views: v.viewCountText?.simpleText || 'N/A',
          };
        }) || [];
      if (!videos.length) return reply('❌ No results found.');
      let text2 = `🎬 *YouTube Search: ${text}*\n\n`;
      videos.forEach((v, i) => {
        text2 += `${i + 1}. *${v.title}*\n   📺 ${v.channel} | ⏱️ ${v.duration} | 👁️ ${v.views}\n   🔗 https://youtu.be/${v.id}\n\n`;
      });
      reply(text2.trim());
    } catch {
      reply(`❌ YouTube search failed. Try again.`);
    }
  },
};
