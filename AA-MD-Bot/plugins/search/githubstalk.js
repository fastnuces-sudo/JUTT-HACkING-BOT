// ============================================
// AA MD Bot - GitHub Profile Stalker
// Uses GitHub public API — no key needed
// Commands: .ghstalk .githubstalk .github
// ============================================
import axios from 'axios';

function fmtNum(n) {
  if (!n && n !== 0) return 'N/A';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function fmtDate(str) {
  if (!str) return 'N/A';
  return new Date(str).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

export default {
  command: 'ghstalk',
  alias: ['githubstalk', 'githubinfo', 'ghinfo'],
  description: 'Stalk a GitHub profile — repos, stars, followers, bio & more',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `🐙 *GitHub Profile Stalker*\n\n` +
      `*Usage:* ${prefix}ghstalk <username>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}ghstalk torvalds\n` +
      `• ${prefix}ghstalk microsoft\n` +
      `• ${prefix}ghstalk SilvaTechB\n\n` +
      `> 🐙 *AA MD Bot*`
    );

    const username = text.replace(/^@/, '').trim().split(/\s+/)[0];
    await react('🐙');

    const headers = { 'User-Agent': 'AA-MD-Bot/3.0', Accept: 'application/vnd.github+json' };

    try {
      const [userRes, reposRes, orgsRes] = await Promise.allSettled([
        axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`,                                            { headers, timeout: 10000 }),
        axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5&type=owner`,   { headers, timeout: 10000 }),
        axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/orgs?per_page=5`,                            { headers, timeout: 10000 }),
      ]);

      if (userRes.status === 'rejected') {
        const code = userRes.reason?.response?.status;
        if (code === 404) return reply(`❌ GitHub user *@${username}* not found.\n\n> 🐙 *AA MD Bot*`);
        throw userRes.reason;
      }

      const user  = userRes.value.data;
      const repos  = reposRes.status  === 'fulfilled' ? reposRes.value.data  : [];
      const orgs   = orgsRes.status   === 'fulfilled' ? orgsRes.value.data   : [];

      const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
      const topLangs   = [...new Set(repos.map(r => r.language).filter(Boolean))].slice(0, 4).join(', ') || 'N/A';

      const badges = [];
      if (user.site_admin)              badges.push('⭐ GitHub Staff');
      if (user.type === 'Organization') badges.push('🏢 Organization');
      if (user.hireable)                badges.push('💼 Open to Work');
      if (user.twitter_username)        badges.push(`🐦 @${user.twitter_username}`);

      let msg =
        `🐙 *GitHub: @${user.login}*\n\n`;

      if (user.name)     msg += `👤 *Name:* ${user.name}\n`;
      if (user.company)  msg += `🏢 *Company:* ${user.company.trim()}\n`;
      if (user.location) msg += `📍 *Location:* ${user.location}\n`;
      if (user.blog)     msg += `🔗 *Website:* ${user.blog}\n`;
      if (user.bio)      msg += `📝 *Bio:* _${user.bio.slice(0, 120)}_\n`;
      msg += '\n';

      msg +=
        `📊 *Stats*\n` +
        `• Repos: *${fmtNum(user.public_repos)}*\n` +
        `• Followers: *${fmtNum(user.followers)}*  •  Following: *${fmtNum(user.following)}*\n` +
        `• Gists: *${fmtNum(user.public_gists)}*\n` +
        `• ⭐ Stars received: *${fmtNum(totalStars)}*\n` +
        `• Top Languages: ${topLangs}\n\n`;

      msg += `📅 *Joined:* ${fmtDate(user.created_at)}\n`;

      if (orgs.length) msg += `🏛️ *Orgs:* ${orgs.map(o => o.login).join(', ')}\n`;
      if (badges.length) msg += `\n${badges.join('\n')}\n`;

      if (repos.length) {
        msg += `\n📁 *Recent Repos:*\n`;
        for (const r of repos.slice(0, 4)) {
          msg += `• *${r.name}*${r.fork ? ' (fork)' : ''} ⭐${r.stargazers_count} 🍴${r.forks_count}\n`;
          if (r.description) msg += `  _${r.description.slice(0, 60)}_\n`;
        }
      }

      msg += `\n🔗 https://github.com/${user.login}\n\n> 🐙 *AA MD Bot*`;
      reply(msg);
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *GitHub lookup failed*\n\n${e.message}\n\n> 🐙 *AA MD Bot*`);
    }
  },
};
