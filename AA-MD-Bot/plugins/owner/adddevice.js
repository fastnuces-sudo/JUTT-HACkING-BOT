// ============================================
// AA MD Bot - Add New Device (Pairing Code)
// Developer: Ahsan Ali | AA Mods
// Sends pairing code via WhatsApp — no console needed
// ============================================

import { createSession, botEvents } from '../../lib/sessionManager.js';

export default {
  command: 'adddevice',
  alias: ['newsession', 'addsession'],
  description: 'Add a new WhatsApp session via pairing code',
  category: 'owner',
  ownerOnly: true,

  async execute({ reply, args }) {
    const phoneRaw  = args[0];
    const sessionId = args[1] || `device_${Date.now()}`;

    // Usage help
    if (!phoneRaw) {
      return reply(
        `📱 *Add New Device*\n\n` +
        `*Usage:*\n` +
        `\`${'.adddevice <number> [session-id]'}\`\n\n` +
        `*Example:*\n` +
        `\`${'.adddevice 923001234567'}\`\n\n` +
        `Enter your *full number* with country code — no + or spaces.\n` +
        `A pairing code will be sent back here.\n` +
        `Enter it in *WhatsApp → Settings → Linked Devices → Link Device → Link with phone number*.\n\n` +
        `> 📱 *AA MD Bot*`
      );
    }

    const phoneNumber = phoneRaw.replace(/\D/g, '');
    if (phoneNumber.length < 7 || phoneNumber.length > 15) {
      return reply(`❌ Invalid number: \`${phoneRaw}\`\nUse full number with country code, e.g. \`923001234567\``);
    }

    await reply(
      `📱 *Creating session…*\n\n` +
      `📞 Number: \`+${phoneNumber}\`\n` +
      `🆔 Session: \`${sessionId}\`\n\n` +
      `⏳ Requesting pairing code — please wait…`
    );

    try {
      // ── Register listeners BEFORE createSession to avoid race condition ───
      const codePromise = new Promise((resolve, reject) => {
        const TIMEOUT_MS = 35000;

        const timer = setTimeout(() => {
          botEvents.removeListener('pairingCode',      onCode);
          botEvents.removeListener('pairingCodeError', onErr);
          reject(new Error('Timed out (35s). Make sure the number is correct and has no active session.'));
        }, TIMEOUT_MS);

        function onCode({ sessionId: sid, code }) {
          if (sid !== sessionId) return;
          clearTimeout(timer);
          botEvents.removeListener('pairingCode',      onCode);
          botEvents.removeListener('pairingCodeError', onErr);
          resolve(code);
        }

        function onErr({ sessionId: sid, error }) {
          if (sid !== sessionId) return;
          clearTimeout(timer);
          botEvents.removeListener('pairingCode',      onCode);
          botEvents.removeListener('pairingCodeError', onErr);
          reject(new Error(error));
        }

        botEvents.on('pairingCode',      onCode);
        botEvents.on('pairingCodeError', onErr);
      });

      // ── Start the session ─────────────────────────────────────────────────
      await createSession(sessionId, /* usePairingCode */ true, phoneNumber);

      // ── Wait for code ─────────────────────────────────────────────────────
      const code = await codePromise;

      // Format as XXXX-XXXX for readability
      const formatted = code?.length === 8
        ? `${code.slice(0, 4)}-${code.slice(4)}`
        : (code || '????');

      return reply(
        `✅ *Pairing Code Ready!*\n\n` +
        `📞 *Number:*  +${phoneNumber}\n` +
        `🆔 *Session:* ${sessionId}\n\n` +
        `*🔑 Your Code:*\n` +
        `┌────────────────────┐\n` +
        `│   *${formatted}*   │\n` +
        `└────────────────────┘\n\n` +
        `*How to link:*\n` +
        `1️⃣ Open WhatsApp on your phone\n` +
        `2️⃣ *Settings* → *Linked Devices*\n` +
        `3️⃣ Tap *"Link a Device"*\n` +
        `4️⃣ Tap *"Link with phone number instead"*\n` +
        `5️⃣ Enter the code above\n\n` +
        `⏰ Code expires in ~60 seconds\n\n` +
        `> 📱 *AA MD Bot*`
      );
    } catch (err) {
      return reply(
        `❌ *Session creation failed*\n\n` +
        `${err.message}\n\n` +
        `*Check:*\n` +
        `• Number is correct with country code\n` +
        `• Session ID \`${sessionId}\` is not already in use (.devices to check)\n` +
        `• Try: .deldevice ${sessionId} first, then retry\n\n` +
        `> 📱 *AA MD Bot*`
      );
    }
  },
};
