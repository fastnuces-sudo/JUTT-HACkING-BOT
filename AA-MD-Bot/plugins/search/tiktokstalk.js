// AA MD Bot - TikTok Profile Lookup
import axios from 'axios';

function fmtNum(n) {
  if (!n && n !== 0) return 'N/A';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function bar(value, max, len = 10) {
  if (!max) return '▱'.repeat(len);
  const filled = Math.min(Math.round((value / max) * len), len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

export default {
  command: 'tiktokstalk',
  alias: ['ttstalk', 'tksearch', 'ttuser', 'tikstalk', 'tiktokinfo'],
  description: 'Look up a TikTok profile — followers, videos, likes, bio',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    const username = text?.replace(/^@/, '').trim().split(/\s+/)[0];
    if (!username) {
      return reply(
        `🎵 *TikTok Profile Lookup*\n\n` +
        `*Usage:* ${prefix}tiktokstalk <username>\n` +
        `*Example:* ${prefix}ttstalk charlidamelio\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');

    let userData = null;

    // Method 1: TikWM API
    try {
      const { data } = await axios.get(
        `https://tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`,
        { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
      );
      if (data?.code === 0 && data?.data?.user) userData = data.data.user;
    } catch {}

    // Method 2: Unofficial TikTok API proxy
    if (!userData) {
      try {
        const { data } = await axios.get(
          `https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}&msToken=`,
          {
            timeout: 12000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              Referer: 'https://www.tiktok.com/',
            },
          }
        );
        const u = data?.userInfo?.user;
        const s = data?.userInfo?.stats;
        if (u) {
          userData = { ...u, fans: s?.followerCount, heart: s?.heartCount,
            following: s?.followingCount, video: s?.videoCount };
        }
      } catch {}
    }

    if (!userData) {
      await react('❌');
      return reply(
        `❌ TikTok user *@${username}* not found or profile is private.\n\n` +
        `Make sure the username is correct.\n\n> 🤖 *AA MD Bot*`
      );
    }

    const u = userData;
    const followers = u.fans ?? u.followerCount ?? 0;
    const following = u.following ?? u.followingCount ?? 0;
    const likes     = u.heart ?? u.heartCount ?? 0;
    const videos    = u.video ?? u.videoCount ?? 0;
    const maxVal    = Math.max(followers, likes, 1);

    const badges = [];
    if (u.verified)       badges.push('✅ Verified');
    if (u.privateAccount) badges.push('🔒 Private');
    if (followers > 1_000_000 && !u.verified) badges.push('🚀 1M+ Creator');

    const bio = (u.signature || u.bio || '').trim().replace(/\n+/g, ' ') || '—';
    const region = u.region || u.country || '—';

    const msg_text =
      `┌──────────────────────┐\n` +
      `   🎵 *TikTok Profile*\n` +
      `└──────────────────────┘\n\n` +
      `👤 *Name:* ${u.nickname || username}\n` +
      `🔖 *Username:* @${u.uniqueId || username}\n` +
      `🆔 *User ID:* ${u.id || '—'}\n` +
      (region !== '—' ? `🌍 *Region:* ${region}\n` : '') +
      `📝 *Bio:* ${bio}\n\n` +
      `👥 *Followers:* ${fmtNum(followers)}\n` +
      `   ${bar(followers, maxVal)}\n` +
      `❤️ *Likes:* ${fmtNum(likes)}\n` +
      `   ${bar(likes, maxVal)}\n` +
      `➕ *Following:* ${fmtNum(following)}\n` +
      `🎬 *Videos:* ${fmtNum(videos)}\n\n` +
      (badges.length ? `🏅 *Badges:* ${badges.join(' • ')}\n\n` : '') +
      `🔗 https://tiktok.com/@${u.uniqueId || username}\n\n` +
      `> 🤖 *AA MD Bot*`;

    // Send with profile picture if available
    const avatar = u.avatarLarger || u.avatarMedium || u.avatar_larger?.url_list?.[0];
    if (avatar) {
      try {
        await sock.sendMessage(jid, { image: { url: avatar }, caption: msg_text }, { quoted: msg });
        return await react('✅');
      } catch {}
    }

    await reply(msg_text);
    await react('✅');
  },
};
