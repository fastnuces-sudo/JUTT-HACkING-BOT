// ============================================
// AA MD Bot - GitHub Info
// Handles both repo (.github owner/repo)
// and user (.ghuser username) lookups
// ============================================

import axios from 'axios';

const GH = axios.create({
  baseURL: 'https://api.github.com',
  headers: { 'User-Agent': 'AA-MD-Bot' },
  timeout: 10000,
});

async function repoInfo(repo) {
  const { data: r } = await GH.get(`/repos/${repo}`);
  return (
    `🐙 *GitHub Repository*\n\n` +
    `📦 *${r.full_name}*\n` +
    `📝 ${r.description || '_No description_'}\n\n` +
    `⭐ *Stars:* ${r.stargazers_count.toLocaleString()}\n` +
    `🍴 *Forks:* ${r.forks_count.toLocaleString()}\n` +
    `👁️ *Watchers:* ${r.watchers_count.toLocaleString()}\n` +
    `🐛 *Issues:* ${r.open_issues_count.toLocaleString()}\n` +
    `💻 *Language:* ${r.language || 'N/A'}\n` +
    `📅 *Created:* ${new Date(r.created_at).toLocaleDateString()}\n` +
    `🔄 *Updated:* ${new Date(r.updated_at).toLocaleDateString()}\n` +
    `📜 *License:* ${r.license?.name || 'None'}\n\n` +
    `🔗 ${r.html_url}`
  );
}

async function userInfo(username, sock, jid, msg) {
  const { data: u } = await GH.get(`/users/${username}`);
  const caption =
    `👤 *GitHub User*\n\n` +
    `🏷️ *Username:* ${u.login}\n` +
    `📛 *Name:* ${u.name || 'N/A'}\n` +
    `📝 *Bio:* ${u.bio || 'N/A'}\n\n` +
    `👥 *Followers:* ${u.followers.toLocaleString()}\n` +
    `👣 *Following:* ${u.following.toLocaleString()}\n` +
    `📦 *Public Repos:* ${u.public_repos.toLocaleString()}\n` +
    `🌐 *Blog:* ${u.blog || 'N/A'}\n` +
    `📍 *Location:* ${u.location || 'N/A'}\n` +
    `🏢 *Company:* ${u.company || 'N/A'}\n\n` +
    `🔗 ${u.html_url}`;

  await sock.sendMessage(jid, { image: { url: u.avatar_url }, caption }, { quoted: msg });
  return null; // sent directly
}

export default {
  command: 'github',
  alias: ['gh', 'gitrepo', 'ghuser', 'gituser'],
  description: 'GitHub repo info (.github owner/repo) or user (.github @username)',
  category: 'search',

  async execute({ reply, react, args, sock, jid, msg, prefix }) {
    if (!args[0]) return reply(
      `🐙 *GitHub Info*\n\n` +
      `*Repo:*\n` +
      `${prefix}github whiskeysockets/baileys\n\n` +
      `*User:*\n` +
      `${prefix}github @octocat\n\n` +
      `> 🐙 *AA MD Bot*`
    );

    await react('🐙');
    const input = args[0].replace(/^https?:\/\/github\.com\//i, '');

    try {
      if (input.startsWith('@') || !input.includes('/')) {
        // User lookup
        const username = input.replace('@', '');
        const result = await userInfo(username, sock, jid, msg);
        if (result) reply(result);
      } else {
        // Repo lookup
        const text = await repoInfo(input);
        reply(text);
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ GitHub: Not found — *${input}*\n\n💡 For users: ${prefix}github @username\nFor repos: ${prefix}github owner/repo`);
    }
  },
};
