// AA MD Bot - Instagram Profile Lookup
// Multiple API methods with fallbacks
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function fmtNum(n) {
  if (n === undefined || n === null) return 'N/A';
  if (typeof n === 'string') return n; // already formatted by a scraper
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

// Method 2: storiesig public API
async function tryStoriesig(username) {
  const { data } = await axios.get(
    `https://storiesig.app/api/userinfo/${encodeURIComponent(username)}`,
    { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, timeout: 12000 }
  );
  if (!data?.user) throw new Error('no user');
  const u = data.user;
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

// Method 3: Picuki public scraper
async function tryPicuki(username) {
  const { data } = await axios.get(
    `https://www.picuki.com/profile/${encodeURIComponent(username)}`,
    {
      headers: { 'User-Agent': UA, 'Referer': 'https://www.picuki.com/' },
      timeout: 15000,
    }
  );
  const html = typeof data === 'string' ? data : '';
  if (html.toLowerCase().includes('page not found') || html.length < 500) throw new Error('not found');
  const followers = html.match(/followers[^<]*<span[^>]*>([\d.,KkMm]+)<\/span>/i)?.[1]
                 || html.match(/<span[^>]*>([\d.,KkMm]+)<\/span>[^<]*followers/i)?.[1];
  const following = html.match(/following[^<]*<span[^>]*>([\d.,KkMm]+)<\/span>/i)?.[1]
                 || html.match(/<span[^>]*>([\d.,KkMm]+)<\/span>[^<]*following/i)?.[1];
  const posts     = html.match(/posts[^<]*<span[^>]*>([\d.,KkMm]+)<\/span>/i)?.[1]
                 || html.match(/<span[^>]*>([\d.,KkMm]+)<\/span>[^<]*posts/i)?.[1]
                 || html.match(/(\d[\d,.]*)\s*posts?/i)?.[1];
  const bio       = html.match(/<div[^>]*class="[^"]*profile-description[^"]*"[^>]*>([\s\S]{0,300}?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
  const fullname  = html.match(/<h1[^>]*class="[^"]*profile-name[^"]*"[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
                 || html.match(/<h1[^>]*>([^<]{2,50})<\/h1>/i)?.[1]?.trim();
  if (!followers && !posts) throw new Error('parse failed');
  return {
    username, fullname: fullname || username,
    followers: followers || 'N/A', following: following || 'N/A',
    posts: posts || 'N/A', bio: bio || '—', verified: false,
    is_private: html.toLowerCase().includes('private account'),
  };
}

// Method 4: Imginn.com public viewer
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

// Method 5: Dumpor.com public scraper
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

// Method 6: Gramhir.com public viewer
async function tryGramhir(username) {
  const { data } = await axios.get(
    `https://gramhir.com/profile/${encodeURIComponent(username)}/`,
    { headers: { 'User-Agent': UA, 'Referer': 'https://gramhir.com/' }, timeout: 15000 }
  );
  const html = typeof data === 'string' ? data : '';
  if (html.length < 500) throw new Error('empty');
  const followers = html.match(/followers[^\d<]{0,20}([\d.,KkMm]+)/i)?.[1]
                 || html.match(/([\d.,KkMm]+)\s*followers/i)?.[1];
  const following = html.match(/following[^\d<]{0,20}([\d.,KkMm]+)/i)?.[1]
                 || html.match(/([\d.,KkMm]+)\s*following/i)?.[1];
  const posts     = html.match(/posts?[^\d<]{0,20}([\d.,KkMm]+)/i)?.[1]
                 || html.match(/([\d.,KkMm]+)\s*posts?/i)?.[1];
  const bio       = html.match(/<p[^>]*class="[^"]*biography[^"]*"[^>]*>([\s\S]{0,300}?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, '').trim()
                 || html.match(/<meta[^>]*name="description"[^>]*content="([^"]{5,200})"/i)?.[1];
  if (!followers && !posts) throw new Error('parse failed');
  return {
    username, fullname: username,
    followers: followers || 'N/A', following: following || 'N/A',
    posts: posts || 'N/A', bio: bio || '—', verified: false,
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
        `> 📸 *AA MD Bot*`
      );
    }

    const username = text.replace(/^@/, '').trim().split(/\s+/)[0];
    await react('📸');

    let profile = null;
    let profilePic = null;

    // Try all methods in sequence, stop on first success
    const methods = [
      async () => {
        const u = await tryInstagramApi(username);
        const p = formatApiUser(u, username);
        profilePic = p.profile_pic;
        return p;
      },
      () => tryStoriesig(username).then(p => { profilePic = p.profile_pic; return p; }),
      () => tryPicuki(username),
      () => tryImginn(username),
      () => tryDumpor(username),
      () => tryGramhir(username),
    ];

    for (const method of methods) {
      try {
        profile = await method();
        if (profile) break;
      } catch {}
    }

    if (!profile) {
      await react('❌');
      return reply(
        `❌ *Could not fetch @${username}*\n\n` +
        `All lookup methods failed — Instagram and its viewer sites are blocking this server's IP.\n\n` +
        `Try directly:\n` +
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
