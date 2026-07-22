// AA MD Bot - Instagram Profile Lookup
// Multiple API methods with fallbacks
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function fmtNum(n) {
  if (n === undefined || n === null) return 'N/A';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// Method 1: Instagram web_profile_info (works occasionally from fresh IPs)
async function tryInstagramApi(username) {
  const { data } = await axios.get(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': UA,
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'ig_did=AA; csrftoken=AA;',
      },
      timeout: 12000,
    }
  );
  const u = data?.data?.user;
  if (!u) throw new Error('no user');
  return u;
}

// Method 2: Dumpor.com public scraper
async function tryDumpor(username) {
  const { data } = await axios.get(
    `https://dumpor.com/v/${encodeURIComponent(username)}`,
    { headers: { 'User-Agent': UA }, timeout: 15000 }
  );
  const html = typeof data === 'string' ? data : '';
  const followers = html.match(/<span[^>]*class="[^"]*followers[^"]*"[^>]*>([\d.,KkMm]+)<\/span>/i)?.[1];
  const following = html.match(/<span[^>]*class="[^"]*following[^"]*"[^>]*>([\d.,KkMm]+)<\/span>/i)?.[1];
  const posts = html.match(/(\d[\d,.]*)\s*posts?/i)?.[1];
  const bio = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  const verified = html.includes('verified');
  if (!followers && !posts) throw new Error('parse failed');
  return {
    username, followers: followers || 'N/A', following: following || 'N/A',
    posts: posts || 'N/A', bio: bio || '—', verified,
    is_private: html.toLowerCase().includes('private account'),
  };
}

// Method 3: Imginn.com public viewer
async function tryImginn(username) {
  const { data } = await axios.get(
    `https://imginn.com/${encodeURIComponent(username)}/`,
    { headers: { 'User-Agent': UA, 'Referer': 'https://imginn.com/' }, timeout: 15000 }
  );
  const html = typeof data === 'string' ? data : '';
  const countsBlock = html.match(/class="counts"[^>]*>([\s\S]{0,500}?)<\/div>/i)?.[1] || '';
  const followers = countsBlock.match(/([\d.,KkMm]+)\s*followers/i)?.[1];
  const following = countsBlock.match(/([\d.,KkMm]+)\s*following/i)?.[1];
  const posts = countsBlock.match(/([\d.,KkMm]+)\s*posts/i)?.[1];
  const bio = html.match(/<p[^>]*class="[^"]*desc[^"]*"[^>]*>([^<]{5,})<\/p>/i)?.[1];
  const fullname = html.match(/<h1[^>]*class="[^"]*fullname[^"]*"[^>]*>([^<]+)<\/h1>/i)?.[1];
  if (!followers && !posts) throw new Error('parse failed');
  return {
    username, fullname: fullname?.trim() || username,
    followers: followers || 'N/A', following: following || 'N/A',
    posts: posts || 'N/A', bio: bio?.trim() || '—', verified: false,
    is_private: html.toLowerCase().includes('private'),
  };
}

function formatApiUser(u, username) {
  return {
    username: u.username || username,
    fullname: u.full_name || username,
    bio: u.biography || '—',
    followers: fmtNum(u.edge_followed_by?.count ?? u.follower_count),
    following: fmtNum(u.edge_follow?.count ?? u.following_count),
    posts: fmtNum(u.edge_owner_to_timeline_media?.count ?? u.media_count),
    is_private: u.is_private,
    verified: u.is_verified,
    profile_pic: u.profile_pic_url_hd || u.profile_pic_url,
  };
}

export default {
  command: 'igstalk',
  alias: ['instastalk', 'iginfo', 'instagramstalk', 'igcheck'],
  description: 'Look up an Instagram profile — followers, bio, posts',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) {
      return reply(
        `📸 *Instagram Profile Lookup*\n\n` +
        `*Usage:* ${prefix}igstalk <username>\n` +
        `*Examples:* ${prefix}igstalk cristiano\n\n` +
        `⚠️ _Instagram heavily rate-limits lookups from shared IPs._\n\n` +
        `> 📸 *AA MD Bot*`
      );
    }

    const username = text.replace(/^@/, '').trim().split(/\s+/)[0];
    await react('📸');

    let profile = null;
    let profilePic = null;

    // Try official API first
    try {
      const u = await tryInstagramApi(username);
      profile = formatApiUser(u, username);
      profilePic = profile.profile_pic;
    } catch {}

    // Try Dumpor
    if (!profile) {
      try {
        profile = await tryDumpor(username);
      } catch {}
    }

    // Try Imginn
    if (!profile) {
      try {
        profile = await tryImginn(username);
      } catch {}
    }

    if (!profile) {
      await react('❌');
      return reply(
        `❌ *Could not fetch @${username}*\n\n` +
        `Instagram heavily blocks lookups from shared server IPs.\n` +
        `Try searching directly at:\n` +
        `🔗 https://instagram.com/${username}\n\n` +
        `> 📸 *AA MD Bot*`
      );
    }

    const privBadge = profile.is_private ? '🔒 Private' : '🔓 Public';
    const verBadge  = profile.verified   ? ' ✅ Verified' : '';

    const text_out =
      `📸 *Instagram Profile*\n\n` +
      `👤 *Name:* ${profile.fullname || profile.username}\n` +
      `🔖 *Username:* @${profile.username}\n` +
      `${privBadge}${verBadge}\n\n` +
      `📝 *Bio:* ${profile.bio}\n\n` +
      `👥 *Followers:* ${profile.followers}\n` +
      `➕ *Following:* ${profile.following}\n` +
      `🖼️ *Posts:* ${profile.posts}\n\n` +
      `🔗 https://instagram.com/${profile.username}\n\n` +
      `> 📸 *AA MD Bot*`;

    if (profilePic) {
      try {
        await sock.sendMessage(jid, { image: { url: profilePic }, caption: text_out }, { quoted: msg });
        return await react('✅');
      } catch {}
    }

    await reply(text_out);
    await react('✅');
  },
};
