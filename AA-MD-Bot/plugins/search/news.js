// ============================================
// AA MD Bot - News (Fixed)
// Uses Guardian "test" key (always free) +
// BBC RSS as fallback — no signup needed
// ============================================

import axios from 'axios';

const GUARDIAN = 'https://content.guardianapis.com/search';
const BBC_RSS  = 'https://feeds.bbci.co.uk/news';

const TOPIC_MAP = {
  tech: '/technology', technology: '/technology',
  sport: '/sport', sports: '/sport',
  business: '/business', finance: '/business',
  science: '/science',
  health: '/health', medical: '/health',
  world: '', global: '', international: '',
};

function parseRss(xml) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null && items.length < 5) {
    const block = m[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block) || [])[1] || '';
    const link  = (/<link>(.*?)<\/link>/.exec(block) || [])[1] || '';
    const pub   = (/<pubDate>(.*?)<\/pubDate>/.exec(block) || [])[1] || '';
    if (title) items.push({ title: title.trim(), url: link.trim(), date: pub.trim() });
  }
  return items;
}

async function fromGuardian(topic) {
  const { data } = await axios.get(GUARDIAN, {
    params: {
      q: topic,
      'api-key': 'test',
      'show-fields': 'headline,trailText',
      'page-size': 5,
      'order-by': 'newest',
    },
    timeout: 10000,
  });
  return (data?.response?.results || []).map(r => ({
    title: r.fields?.headline || r.webTitle,
    url:   r.webUrl,
    date:  r.webPublicationDate?.split('T')[0] || '',
    desc:  r.fields?.trailText || '',
  }));
}

async function fromBBC(topic) {
  const slug = TOPIC_MAP[topic.toLowerCase()] ?? '';
  const feed = `${BBC_RSS}${slug}/rss.xml`;
  const { data } = await axios.get(feed, { timeout: 10000 });
  return parseRss(data);
}

export default {
  command: 'news',
  alias: ['headlines', 'breakingnews'],
  description: 'Get latest news headlines on any topic',
  category: 'search',

  async execute({ reply, args, react }) {
    const topic = args.join(' ').trim() || 'world';
    await react('📰');

    let articles = [];
    let source = '';

    try {
      articles = await fromGuardian(topic);
      source = 'The Guardian';
    } catch {
      try {
        articles = await fromBBC(topic);
        source = 'BBC News';
      } catch (e) {
        return reply(`❌ Could not fetch news right now. Try again later.\n${e.message}`);
      }
    }

    if (!articles.length) return reply(`📰 No articles found for "*${topic}*". Try a different keyword.`);

    let text = `📰 *${topic.toUpperCase()} — Latest News*\n`;
    text += `📡 Source: ${source}\n`;
    text += `${'─'.repeat(28)}\n\n`;

    articles.forEach((a, i) => {
      text += `*${i + 1}. ${a.title}*\n`;
      if (a.desc) text += `   📝 ${a.desc.replace(/<[^>]+>/g, '').substring(0, 100)}…\n`;
      if (a.date) text += `   📅 ${a.date}\n`;
      text += `   🔗 ${a.url}\n\n`;
    });

    text += `> 📰 *AA MD Bot*`;
    await react('✅');
    reply(text.trim());
  },
};
