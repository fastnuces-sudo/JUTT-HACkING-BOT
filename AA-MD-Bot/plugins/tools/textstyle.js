const BOLD_MAP   = [...'𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭'];
const ITALIC_MAP = [...'𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡'];
const SCRIPT_MAP = [...'𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵'];
const FRAKTUR_MAP= [...'𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ'];
const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function map(t, arr) {
  return [...t].map(c => { const i = ALPHA.indexOf(c); return i >= 0 ? arr[i] : c; }).join('');
}
function wide(t) {
  return [...t].map(c => {
    const code = c.charCodeAt(0);
    if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFEE0);
    if (c === ' ') return '　';
    return c;
  }).join('');
}
const SMALLCAPS = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'Q',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
const FLIP     = { a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z' };

export default {
  command: 'textstyle',
  alias: ['style', 'stylish', 'font', 'fonts'],
  description: 'Convert text to stylish Unicode fonts',
  category: 'tools',
  usage: '.textstyle <text>',

  async execute({ reply, text }) {
    if (!text) return reply('✨ Usage: .textstyle <text>\n\nExample: .textstyle Hello World');

    const s = {
      '𝗕𝗼𝗹𝗱':         map(text, BOLD_MAP),
      '𝘐𝘵𝘢𝘭𝘪𝘤':        map(text, ITALIC_MAP),
      '𝑺𝒄𝒓𝒊𝒑𝒕':        map(text, SCRIPT_MAP),
      '𝔉𝔯𝔞𝔨𝔱𝔲𝔯':       map(text, FRAKTUR_MAP),
      'ＷＩＤＥ':         wide(text),
      'ᴢᴇɴɪᴛʜ ꜱᴍᴀʟʟ': [...text.toLowerCase()].map(c => SMALLCAPS[c] || c).join(''),
      'uʍop-ǝpısdn':   [...text.toLowerCase()].reverse().map(c => FLIP[c] || c).join(''),
    };

    let out = `✨ *Text Styles:* "${text}"\n\n`;
    for (const [name, styled] of Object.entries(s)) {
      out += `*${name}:*\n${styled}\n\n`;
    }

    return reply(out.trim());
  },
};
