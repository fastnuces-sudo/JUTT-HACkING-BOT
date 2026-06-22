import axios from 'axios';

export default {
  command: 'github',
  alias: ['gh'],
  description: 'Get GitHub user info',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide a valid *Github* username!\n\nExample: *${prefix}gh FantoX001*`);
    }
    await react('📊');
    let GHuserInfo;
    try {
      const ghRes = await axios.get(`https://api.github.com/users/${text}`);
      GHuserInfo = ghRes.data;
    } catch (error) {
      await react('❌');
      return reply(`GitHub user not found or API error: ${error.message}`);
    }
    const GhUserPP = GHuserInfo.avatar_url;
    let resText4 = `        *🏮 GitHub User Info 🏮*\n\n_🎀 Username:_ *${GHuserInfo.login}*\n_🧩 Name:_ *${GHuserInfo.name}*\n\n_🧣 Bio:_ *${GHuserInfo.bio}*\n\n_🍁 Total Followers:_ *${GHuserInfo.followers}*\n_🔖 Total Public Repos:_ *${GHuserInfo.public_repos}*\n_📌 Website:_ ${GHuserInfo.blog}\n`;
    await sock.sendMessage(jid, {
      image: { url: GhUserPP, mimetype: 'image/jpeg' },
      caption: resText4,
    }, { quoted: msg });
  },
};
