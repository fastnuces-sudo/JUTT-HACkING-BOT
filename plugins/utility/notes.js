// ============================================
// Jutts Bot - Notes System (Neon Postgres-backed)
// Developer: Sajid Jutt | Jutts Mods
// All notes stored in Neon Postgres via db.notes
// — zero local file writes.
// ============================================

import { db } from '../../lib/database.js';

export default {
  command: 'note',
  alias: ['notes', 'savenote', 'getnote', 'delnote'],
  description: 'Save and retrieve notes. .note save <name> <text> | .note get <name> | .note list | .note del <name>',
  category: 'utility',

  async execute({ jid, senderJid, args, reply, react }) {
    const sub  = (args[0] || '').toLowerCase().trim();
    const name = (args[1] || '').toLowerCase().trim();
    const key  = jid; // group notes are shared; DM notes are personal

    const notes = db.notes.get(key);

    if (!sub || sub === 'list') {
      const keys = Object.keys(notes);
      if (!keys.length) return reply(`📝 *No notes saved yet.*\n\n💡 Save one: *.note save <name> <text>*\n\n> 🤖 *Jutts Bot*`);
      return reply(
        `📝 *Saved Notes (${keys.length})*\n\n` +
        keys.map((k, i) => `${i + 1}. *${k}*`).join('\n') +
        `\n\n💡 Get a note: *.note get <name>*\n\n> 🤖 *Jutts Bot*`
      );
    }

    if (sub === 'save' || sub === 'add' || sub === 'set') {
      if (!name) return reply(`⚠️ Usage: *.note save <name> <text>*\n\n> 🤖 *Jutts Bot*`);
      const content = args.slice(2).join(' ').trim();
      if (!content) return reply(`⚠️ Provide note content: *.note save ${name} <text>*\n\n> 🤖 *Jutts Bot*`);
      db.notes.setNote(key, name, { content, by: senderJid, at: Date.now() });
      await react('📝');
      return reply(`✅ *Note saved!*\n\n📌 Name: *${name}*\n📄 Content: ${content}\n\n> 🤖 *Jutts Bot*`);
    }

    if (sub === 'get' || sub === 'show' || sub === '#') {
      const n = notes[name];
      if (!n) return reply(`❌ *No note named "${name}"*\n\nUse *.note list* to see all notes.\n\n> 🤖 *Jutts Bot*`);
      return reply(`📝 *Note: ${name}*\n\n${n.content}\n\n> 🤖 *Jutts Bot*`);
    }

    if (sub === 'del' || sub === 'delete' || sub === 'remove' || sub === 'rm') {
      if (!notes[name]) return reply(`❌ *Note "${name}" not found.*\n\n> 🤖 *Jutts Bot*`);
      db.notes.delNote(key, name);
      await react('🗑️');
      return reply(`🗑️ *Note "${name}" deleted.*\n\n> 🤖 *Jutts Bot*`);
    }

    // Shorthand: .note <name> → get note
    const shortNote = notes[sub];
    if (shortNote) return reply(`📝 *Note: ${sub}*\n\n${shortNote.content}\n\n> 🤖 *Jutts Bot*`);

    return reply(
      `📝 *Notes Help*\n\n` +
      `• *.note save <name> <text>* — save a note\n` +
      `• *.note get <name>* — get a note\n` +
      `• *.note list* — see all notes\n` +
      `• *.note del <name>* — delete a note\n\n` +
      `> 🤖 *Jutts Bot*`
    );
  },
};
