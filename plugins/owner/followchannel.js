// ============================================
// AA MD Bot - Follow Channel Manager (Super Owner)
// Whenever a WhatsApp number connects to the bot, it auto-follows every
// channel in this list. Only the main developer (superOwner) can manage it.
// ============================================

import {
  getFollowChannels, addFollowChannel, removeFollowChannel,
  replaceFollowChannels, clearFollowChannels,
} from '../../lib/channelFollow.js';

export default {
  command: 'followchannel',
  alias: ['followchannels', 'autofollow', 'channellist'],
  description: 'Manage WhatsApp channels auto-followed on connect (super owner)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  usage:
    '.followchannel — list channels\n' +
    '.followchannel add <link> — add a channel\n' +
    '.followchannel remove <number> — remove a channel\n' +
    '.followchannel set <link> — replace all with one channel\n' +
    '.followchannel clear — remove all channels',

  async execute({ reply, args }) {
    const sub = (args[0] || 'list').toLowerCase();

    if (sub === 'list' || !args.length) {
      const list = getFollowChannels();
      if (!list.length) {
        return reply('📢 *Auto-Follow Channels*\n\nNo channels configured. Use *.followchannel add <link>*.');
      }
      const lines = list.map((c, i) => `${i + 1}. ${c.link}${c.jid ? ` ✅ (resolved)` : ''}`).join('\n');
      return reply(
        `📢 *Auto-Follow Channels*\n\n${lines}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Every WhatsApp number that connects to this bot will automatically follow all of the above.\n\n` +
        `*.followchannel add <link>* — add another\n` +
        `*.followchannel remove <number>* — remove one\n` +
        `*.followchannel set <link>* — replace all with one\n` +
        `*.followchannel clear* — remove all`
      );
    }

    if (sub === 'add') {
      const link = args[1];
      if (!link) return reply('❌ Usage: .followchannel add <channel link>');
      const res = addFollowChannel(link);
      if (!res.ok) return reply(`❌ ${res.error}`);
      return reply(`✅ *Channel Added!*\n\n📢 ${link}\n\n📋 Total channels: ${res.list.length}\n\nAll newly connected numbers will now auto-follow it.`);
    }

    if (sub === 'remove' || sub === 'delete' || sub === 'del') {
      const idx = parseInt(args[1], 10) - 1;
      if (isNaN(idx)) return reply('❌ Usage: .followchannel remove <number>\n\nUse *.followchannel* to see the list with numbers.');
      const res = removeFollowChannel(idx);
      if (!res.ok) return reply(`❌ ${res.error}`);
      return reply(`✅ *Channel Removed!*\n\n📢 ${res.removed.link}\n\n📋 Remaining channels: ${res.list.length}`);
    }

    if (sub === 'set' || sub === 'change' || sub === 'replace') {
      const link = args[1];
      if (!link) return reply('❌ Usage: .followchannel set <channel link>');
      const res = replaceFollowChannels(link);
      if (!res.ok) return reply(`❌ ${res.error}`);
      return reply(`✅ *Channel List Replaced!*\n\n📢 Only this channel remains:\n${link}`);
    }

    if (sub === 'clear') {
      clearFollowChannels();
      return reply('✅ All auto-follow channels cleared.');
    }

    return reply('❌ Unknown option.\n\nUse: list, add, remove, set, clear.');
  },
};
