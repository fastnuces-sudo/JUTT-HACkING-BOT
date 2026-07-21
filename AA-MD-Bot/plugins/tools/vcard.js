// AA MD Bot - vCard Generator
// Generates a .vcf contact card and sends as document
export default {
  command: 'vcard',
  alias: ['contact', 'vcf', 'makecontact'],
  description: 'Contact card (vCard .vcf) banao',
  category: 'tools',

  async execute({ sock, jid, msg, reply, react, text, prefix }) {
    if (!text) return reply(
      `📇 *vCard Generator*\n\n*Format:*\n_${prefix}vcard Name | Number | Email | Company | Website_\n\n*Sirf Name aur Number zarori hain:*\n_${prefix}vcard Ahmed Ali | 923001234567_\n\n*Pura format:*\n_${prefix}vcard Ahmed Ali | 923001234567 | ahmed@email.com | AA Mods | aamods.com_\n\n> 🤖 *AA MD Bot*`
    );

    const parts = text.split('|').map(s => s.trim());
    const name    = parts[0] || '';
    const number  = (parts[1] || '').replace(/[^0-9+]/g, '');
    const email   = parts[2] || '';
    const company = parts[3] || '';
    const website = parts[4] || '';

    if (!name || !number) return reply(
      `❌ Name aur Number dono zarori hain.\n*Misaal:* _${prefix}vcard Ahmed Ali | 923001234567_\n\n> 🤖 *AA MD Bot*`
    );

    await react('⏳');

    const [firstName, ...rest] = name.trim().split(' ');
    const lastName = rest.join(' ');
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let vcf =
      `BEGIN:VCARD\r\n` +
      `VERSION:3.0\r\n` +
      `N:${lastName};${firstName};;;\r\n` +
      `FN:${name}\r\n` +
      `TEL;TYPE=CELL,VOICE:+${number.replace(/^\+/, '')}\r\n`;

    if (email)   vcf += `EMAIL;TYPE=INTERNET:${email}\r\n`;
    if (company) vcf += `ORG:${company}\r\n`;
    if (website) vcf += `URL:${website.startsWith('http') ? website : 'https://' + website}\r\n`;
    vcf += `REV:${now}\r\n`;
    vcf += `END:VCARD\r\n`;

    const vcfBuf = Buffer.from(vcf, 'utf-8');
    const fileName = `${name.replace(/\s+/g, '_')}.vcf`;

    try {
      await sock.sendMessage(jid, {
        document: vcfBuf,
        mimetype: 'text/vcard',
        fileName,
        caption:
          `📇 *vCard Ready*\n\n` +
          `👤 *Name:* ${name}\n` +
          `📞 *Number:* +${number}\n` +
          (email   ? `📧 *Email:* ${email}\n`   : '') +
          (company ? `🏢 *Company:* ${company}\n` : '') +
          (website ? `🌐 *Website:* ${website}\n` : '') +
          `\n_Save karo → contacts mein add ho jayega_\n\n> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
