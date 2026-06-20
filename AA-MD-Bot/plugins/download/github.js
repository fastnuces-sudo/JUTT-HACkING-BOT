import axios from 'axios';

export default {
  command: 'github',
  alias: ['gh', 'gitrepo'],
  description: 'Get GitHub repository information',
  category: 'download',
  async execute({ reply, args }) {
    if (!args[0]) return reply('❌ Usage: .github [owner/repo]\nExample: .github whiskeysockets/baileys');
    const repo = args[0].replace('https://github.com/', '');
    try {
      const res = await axios.get(`https://api.github.com/repos/${repo}`, { headers: { 'User-Agent': 'AA-MD-Bot' } });
      const r = res.data;
      reply(`🐙 *GitHub: ${r.full_name}*\n\n📝 ${r.description || 'No description'}\n\n⭐ Stars: *${r.stargazers_count.toLocaleString()}*\n🍴 Forks: *${r.forks_count.toLocaleString()}*\n👁️ Watchers: *${r.watchers_count.toLocaleString()}*\n🐛 Issues: *${r.open_issues_count.toLocaleString()}*\n💻 Language: *${r.language || 'N/A'}*\n📅 Created: *${new Date(r.created_at).toLocaleDateString()}*\n🔄 Updated: *${new Date(r.updated_at).toLocaleDateString()}*\n🔗 ${r.html_url}`);
    } catch {
      reply(`❌ Repository not found: *${repo}*`);
    }
  },
};
