// ============================================
// AA MD Bot - Notes System
// Developer: Ahsan Ali | AA Mods
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, '../../database/notes');
fs.ensureDirSync(NOTES_DIR);

function notesFile(jid) { return path.join(NOTES_DIR, `${jid.replace(/[^a-z0-9]/gi,'_')}.json`); }

function loadNotes(jid) {
  try { return JSON.parse(fs.readFileSync(notesFile(jid), 'utf8')); } catch { return {}; }
}

function saveNotes(jid, data) {
  fs.writeFileSync(notesFile(jid), JSON.stringify(data, null, 2));
}

export default {
  command: 'note',
  alias: ['notes', 'savenote', 'getnote', 'delnote'],
  description: 'Save and retrieve notes. .note save <name> <text> | .note get <name> | .note list | .note del <name>',
  category: 'utility',

  async execute({ jid, senderJid, args, reply, react, msg }) {
    const sub  = (args[0] || '').toLowerCase().trim();
    const name = (args[1] || '').toLowerCase().trim();
    const key  = jid; // group notes are shared; DM notes are personal
    const notes = loadNotes(key);

    if (!sub || sub === 'list') {
      const keys = Object.keys(notes);
      if (!keys.length) return reply(`📝 *No notes saved yet.*\n\n💡 Save one: *.note save <name> <text>*\n\n> 🤖 *AA MD Bot*`);
      return reply(
        `📝 *Saved Notes (${keys.length})*\n\n` +
        keys.map((k,i) => `${i+1}. *${k}*`).join('\n') +
        `\n\n💡 Get a note: *.note get <name>*\n\n> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'save' || sub === 'add' || sub === 'set') {
      if (!name) return reply(`⚠️ Usage: *.note save <name> <text>*\n\n> 🤖 *AA MD Bot*`);
      const content = args.slice(2).join(' ').trim();
      if (!content) return reply(`⚠️ Provide note content: *.note save ${name} <text>*\n\n> 🤖 *AA MD Bot*`);
      notes[name] = { content, by: senderJid, at: Date.now() };
      saveNotes(key, notes);
      await react('📝');
      return reply(`✅ *Note saved!*\n\n📌 Name: *${name}*\n📄 Content: ${content}\n\n> 🤖 *AA MD Bot*`);
    }

    if (sub === 'get' || sub === 'show' || sub === '#') {
      const n = notes[name];
      if (!n) return reply(`❌ *No note named "${name}"*\n\nUse *.note list* to see all notes.\n\n> 🤖 *AA MD Bot*`);
      return reply(`📝 *Note: ${name}*\n\n${n.content}\n\n> 🤖 *AA MD Bot*`);
    }

    if (sub === 'del' || sub === 'delete' || sub === 'remove' || sub === 'rm') {
      if (!notes[name]) return reply(`❌ *Note "${name}" not found.*\n\n> 🤖 *AA MD Bot*`);
      delete notes[name];
      saveNotes(key, notes);
      await react('🗑️');
      return reply(`🗑️ *Note "${name}" deleted.*\n\n> 🤖 *AA MD Bot*`);
    }

    // Shorthand: .note <name> → get note
    const shortNote = notes[sub];
    if (shortNote) return reply(`📝 *Note: ${sub}*\n\n${shortNote.content}\n\n> 🤖 *AA MD Bot*`);

    return reply(
      `📝 *Notes Help*\n\n` +
      `• *.note save <name> <text>* — save a note\n` +
      `• *.note get <name>* — get a note\n` +
      `• *.note list* — see all notes\n` +
      `• *.note del <name>* — delete a note\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
