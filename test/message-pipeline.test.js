import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMessage } from '../lib/commandHandler.js';
import { loadAllPlugins, plugins } from '../lib/pluginLoader.js';
import { db } from '../lib/database.js';

const WATERMARK_MARKER = 'Powered by Jutts Bot';

function countMarkers(value) {
  return String(value ?? '').split(WATERMARK_MARKER).length - 1;
}

// Minimal Baileys-like socket that records everything the handler sends.
function makeSock() {
  const sent = [];
  const presence = [];
  return {
    sent,
    presence,
    user: { id: '111111111111:1@s.whatsapp.net', name: 'Test Bot' },
    ws: { readyState: 1 },
    async sendMessage(jid, content, options) {
      sent.push({ jid, content, options });
      return { key: { id: 'sent' } };
    },
    async sendPresenceUpdate(state, jid) {
      presence.push({ state, jid });
    },
    async groupMetadata() {
      return { participants: [] };
    },
  };
}

function textMessage(body, overrides = {}) {
  return {
    key: {
      remoteJid: '999999999999@s.whatsapp.net',
      fromMe: false,
      id: 'MSGID1',
      participant: undefined,
      ...overrides.key,
    },
    message: { conversation: body },
    ...overrides,
  };
}

// Register a throwaway plugin so the pipeline has a deterministic target.
function installProbePlugin(command, execute, extra = {}) {
  const plugin = { command, category: 'misc', execute, ...extra };
  plugins.set(command, plugin);
  return () => plugins.delete(command);
}

test.before(async () => {
  await loadAllPlugins();
  // Keep the pipeline deterministic: no cooldowns/spam gates in these tests.
  db.settings.setValue('antiSpam', false);
});

test('a reply carrying the watermark is not stamped twice', async () => {
  const sock = makeSock();
  const remove = installProbePlugin('__probe_reply__', async ({ reply }) => {
    await reply('first line');
  });

  try {
    await handleMessage(sock, textMessage('.__probe_reply__'), 'sess-1');
  } finally {
    remove();
  }

  assert.equal(sock.sent.length, 1);
  assert.equal(countMarkers(sock.sent[0].content.text), 1);
});

test('a caption that already ends in the watermark is left alone', async () => {
  const sock = makeSock();
  const preStamped = `look at this\n\n> 🤖 *${WATERMARK_MARKER}*  👨‍💻 *Sajid Jutt*`;
  const remove = installProbePlugin('__probe_caption__', async ({ send }) => {
    await send({ image: Buffer.from('fake'), caption: preStamped });
  });

  try {
    await handleMessage(sock, textMessage('.__probe_caption__'), 'sess-1');
  } finally {
    remove();
  }

  assert.equal(sock.sent.length, 1);
  assert.equal(countMarkers(sock.sent[0].content.caption), 1);
});

test('sending one payload to several chats does not accumulate watermarks', async () => {
  const sock = makeSock();
  // A plugin that reuses a single object for repeated sends must not have that
  // object mutated by the watermark helper.
  const payload = { image: Buffer.from('fake'), caption: 'broadcast body' };
  const remove = installProbePlugin('__probe_reuse__', async ({ send }) => {
    await send(payload);
    await send(payload);
    await send(payload);
  });

  try {
    await handleMessage(sock, textMessage('.__probe_reuse__'), 'sess-1');
  } finally {
    remove();
  }

  assert.equal(sock.sent.length, 3);
  for (const entry of sock.sent) {
    assert.equal(countMarkers(entry.content.caption), 1);
  }
  // The caller's object must be untouched.
  assert.equal(payload.caption, 'broadcast body');
});

test('the typing indicator is always cleared, even when a plugin throws', async () => {
  const sock = makeSock();
  const remove = installProbePlugin('__probe_boom__', async () => {
    throw new Error('plugin exploded');
  });

  try {
    await handleMessage(sock, textMessage('.__probe_boom__'), 'sess-typing');
  } finally {
    remove();
  }

  const states = sock.presence.map(entry => entry.state);
  assert.ok(states.includes('composing'), 'expected a composing presence update');
  assert.ok(states.includes('paused'), 'typing indicator was never cleared');
});

test('commands are recognised inside ephemeral and viewOnce wrappers', async () => {
  const wrappers = {
    ephemeral: {
      ephemeralMessage: { message: { conversation: '.__probe_wrap__' } },
    },
    'ephemeral image caption': {
      ephemeralMessage: { message: { imageMessage: { caption: '.__probe_wrap__' } } },
    },
    'ephemeral viewOnce caption': {
      ephemeralMessage: {
        message: { viewOnceMessageV2: { message: { imageMessage: { caption: '.__probe_wrap__' } } } },
      },
    },
    'viewOnce caption': {
      viewOnceMessageV2: { message: { imageMessage: { caption: '.__probe_wrap__' } } },
    },
  };

  // Each case uses a distinct sender, otherwise the per-sender command cooldown
  // (3s by default) would swallow every run after the first.
  let index = 0;
  for (const [label, message] of Object.entries(wrappers)) {
    const sock = makeSock();
    let ran = 0;
    const remove = installProbePlugin('__probe_wrap__', async () => { ran++; });
    const remoteJid = `900000000${index++}@s.whatsapp.net`;
    try {
      await handleMessage(sock, { key: { remoteJid, fromMe: false, id: `X${index}` }, message }, 'sess-wrap');
    } finally {
      remove();
    }
    assert.equal(ran, 1, `command was not detected inside ${label}`);
  }
});
