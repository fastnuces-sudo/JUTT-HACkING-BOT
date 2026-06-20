const roasts = [
  'You\'re proof that evolution can go in reverse.',
  'I\'d agree with you but then we\'d both be wrong.',
  'You\'re not stupid; you just have bad luck thinking.',
  'I\'ve seen better heads on a glass of beer.',
  'You\'re like a cloud. When you disappear, it\'s a beautiful day.',
  'I would roast you, but my parents told me not to burn trash.',
  'You bring everyone so much joy when you leave the room.',
  'I\'d explain it to you but I left my crayons at home.',
  'You have your entire life to be an idiot. Why not take today off?',
  'I\'d roast you harder, but I don\'t want to burn something that\'s already a dumpster fire.',
];

export default {
  command: 'roast',
  alias: ['burn'],
  description: 'Get a savage roast',
  category: 'fun',
  async execute({ reply, msg, sock, jid, args }) {
    const roast = roasts[Math.floor(Math.random() * roasts.length)];
    const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target = mention ? `@${mention.split('@')[0]}` : 'you';
    reply(`🔥 *Roast Mode Activated*\n\n${target} — ${roast}`, mention ? { mentions: [mention] } : {});
  },
};
