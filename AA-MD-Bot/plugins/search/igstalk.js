// ============================================
// AA MD Bot - Instagram Profile Lookup
// Uses multiple public endpoints with fallback
// Commands: .igstalk .instastalk .iginfo
// Note: Instagram rate-limits heavily on shared IPs
// ============================================
import axios from 'axios';

async function fetchProfile(username) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 9; GM1903) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.89 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'x-ig-app-id': '936619743392459',
    'x-requested-with': 'XMLHttpRequest',
  };

  // Try web_profile_info
  try {
    const { data } = await axios.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers, timeout: 15000 }
    );
    const u = data?.data?.user;
    if (u) return { source: 'instagram', user: u };
  } catch {}

  // Try ?__a=1 (older but sometimes works)
  try {
    const { data } = await axios.get(
      `https://www.instagram.com/${username}/?__a=1&__d=dis`,
      { headers: { ...headers, 'Accept': 'application/json' }, timeout: 12000 }
    );
    const u = data?.graphql?.user || data?.data?.user;
    if (u) return { source: 'instagram', user: u };
  } catch {}

  throw new Error('rate_limited');
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default {
  command: 'igstalk',
  alias: ['instastalk', 'iginfo', 'instagramstalk', 'igcheck'],
  description: 'Look up an Instagram profile — followers, bio, posts',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `📸 *Instagram Profile Lookup*\n\n` +
      `*Usage:* ${prefix}igstalk <username>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}igstalk cristiano\n` +
      `• ${prefix}igstalk natgeo\n\n` +
      `⚠️ _Instagram heavily rate-limits lookups on shared IPs._\n\n` +
      `> 📸 *AA MD Bot*`
    );

    const username = text.replace(/^@/,'').trim().split(/\s+/)[0];
    await react('📸');

    try {
      const { user } = await fetchProfile(username);

      const priv = user.is_private ? '🔒 Private' : '🔓 Public';
      const ver  = user.is_verified ? ' ✅' : '';

      let msg =
        `📸 *Instagram: @${user.username}*${ver}\n\n` +
        `👤 *Name:* ${user.full_name || 'N/A'}\n` +
        `🔐 *Account:* ${priv}\n`;

      if (user.biography) msg += `📝 *Bio:* _${user.biography.slice(0, 150)}_\n`;
      if (user.external_url || user.bio_links?.[0]?.url) msg += `🔗 *Link:* ${user.external_url || user.bio_links[0].url}\n`;

      msg +=
        `\n📊 *Stats*\n` +
        `• Posts: *${fmtNum(user.edge_owner_to_timeline_media?.count || user.media_count || 0)}*\n` +
        `• Followers: *${fmtNum(user.edge_followed_by?.count || user.follower_count || 0)}*\n` +
        `• Following: *${fmtNum(user.edge_follow?.count || user.following_count || 0)}*\n\n`;

      if (user.category_name) msg += `🏷️ *Category:* ${user.category_name}\n`;
      if (user.is_business_account) msg += `💼 *Business Account*\n`;

      msg += `\n🔗 https://www.instagram.com/${username}/\n\n> 📸 *AA MD Bot*`;
      reply(msg);
      await react('✅');
    } catch (e) {
      await react('❌');
      if (e.message === 'rate_limited' || e.response?.status === 429) {
        reply(
          `⏳ *Instagram Rate Limited*\n\n` +
          `Instagram is blocking automated lookups from this server IP.\n\n` +
          `💡 *Try:*\n` +
          `• Wait 5-10 minutes and try again\n` +
          `• Check directly: https://www.instagram.com/${username}/\n\n` +
          `> 📸 *AA MD Bot*`
        );
      } else if (e.response?.status === 404) {
        reply(`❌ Instagram user *@${username}* not found.\n\n> 📸 *AA MD Bot*`);
      } else {
        reply(`❌ *Lookup failed*\n\n${e.message}\n\n> 📸 *AA MD Bot*`);
      }
    }
  },
};
