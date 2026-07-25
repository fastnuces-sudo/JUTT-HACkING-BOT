// ╔══════════════════════════════════════════════════════════════════╗
// ║   AA MD Bot — Remote Terminal  (.sh / .$ / .terminal)           ║
// ║   SuperOwner only — real-time streaming output                   ║
// ║   Features:                                                      ║
// ║   • Live output (edits message every 2s as command runs)         ║
// ║   • Persistent working directory per WhatsApp session            ║
// ║   • Long output auto-split into multiple messages                ║
// ║   • Kill running process with .sh kill                           ║
// ║   • Exit code + runtime shown                                    ║
// ║   • .sh cd <dir>  — change directory (persists)                  ║
// ║   • .sh pwd       — show current directory                       ║
// ║   • .sh clear     — reset working directory to bot root          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { spawn }       from 'child_process';
import path            from 'path';
import { fileURLToPath } from 'url';
import os              from 'os';

const BOT_ROOT = path.dirname(fileURLToPath(import.meta.url.replace('/plugins/owner/shell.js', '/index.js')));

// ── Per-session state ─────────────────────────────────────────────────────────
// cwd persists across commands in the same WhatsApp chat
const cwdMap     = new Map(); // jid → current working directory
const activeProc = new Map(); // jid → { proc, kill }

function getCwd(jid) {
  return cwdMap.get(jid) || BOT_ROOT;
}

// ── Output formatter ──────────────────────────────────────────────────────────
const MAX_CHUNK = 3800; // WhatsApp message limit is ~4096 chars

function buildMsg(header, output, done, exitCode, ms) {
  const out   = output.slice(-MAX_CHUNK) || '(no output)';
  const trunc = output.length > MAX_CHUNK ? `\n…[truncated — ${output.length} chars total]\n` : '';
  const tail  = done
    ? `\n\n${exitCode === 0 ? '✅' : '❌'} Exit: ${exitCode}  ⏱ ${(ms / 1000).toFixed(1)}s`
    : '\n\n⏳ _Running…_';
  return `${header}\`\`\`\n${trunc}${out}\n\`\`\`${tail}`;
}

// ── Main execute ──────────────────────────────────────────────────────────────
export default {
  command: 'sh',
  alias: ['$', 'terminal', 'term', 'exec', 'run'],
  description: 'Real-time remote terminal (superOwner only)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,

  async execute({ sock, msg, jid, text, reply }) {
    // ── Get command text (also accept replied text) ───────────────────────────
    let cmd = (text || '').trim();
    if (!cmd) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) cmd = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }

    if (!cmd) {
      const cwd = getCwd(jid);
      return reply(
        `💻 *Remote Terminal*\n\n` +
        `📂 CWD: \`${cwd}\`\n` +
        `🖥️ Host: \`${os.hostname()}\`\n` +
        `⚙️ OS: \`${os.type()} ${os.arch()}\`\n` +
        `🧠 RAM: \`${Math.round(os.freemem()/1024/1024)}MB free / ${Math.round(os.totalmem()/1024/1024)}MB total\`\n\n` +
        `*Usage:*\n` +
        `• \`.sh <command>\` — run command\n` +
        `• \`.sh kill\` — kill running process\n` +
        `• \`.sh cd <dir>\` — change directory\n` +
        `• \`.sh pwd\` — show current directory\n` +
        `• \`.sh clear\` — reset to bot root\n\n` +
        `*Examples:*\n` +
        `\`.sh pm2 status\`\n` +
        `\`.sh df -h\`\n` +
        `\`.sh tail -n 50 logs/pm2-out.log\`\n` +
        `\`.sh top -bn1 | head -20\``
      );
    }

    // ── kill — terminate active process ───────────────────────────────────────
    if (cmd.toLowerCase() === 'kill') {
      const active = activeProc.get(jid);
      if (!active) return reply('ℹ️ No running process to kill.');
      active.kill();
      activeProc.delete(jid);
      return reply('🔪 Process killed.');
    }

    // ── pwd — show current directory ──────────────────────────────────────────
    if (cmd.toLowerCase() === 'pwd') {
      return reply(`📂 \`${getCwd(jid)}\``);
    }

    // ── clear — reset working directory ──────────────────────────────────────
    if (cmd.toLowerCase() === 'clear') {
      cwdMap.set(jid, BOT_ROOT);
      return reply(`🔄 Working directory reset to bot root:\n\`${BOT_ROOT}\``);
    }

    // ── cd — change directory (persists for this chat) ────────────────────────
    if (cmd.toLowerCase().startsWith('cd ') || cmd.toLowerCase() === 'cd') {
      const target = cmd.slice(3).trim() || os.homedir();
      const newDir = path.isAbsolute(target)
        ? target
        : path.join(getCwd(jid), target);
      try {
        // Verify the directory exists by running test -d
        await new Promise((res, rej) => {
          const p = spawn('test', ['-d', newDir]);
          p.on('close', code => code === 0 ? res() : rej(new Error(`No such directory: ${newDir}`)));
        });
        cwdMap.set(jid, newDir);
        return reply(`📂 Changed directory to:\n\`${newDir}\``);
      } catch (e) {
        return reply(`❌ ${e.message}`);
      }
    }

    // ── Guard: block another command if one is already running ────────────────
    if (activeProc.has(jid)) {
      return reply('⚠️ A command is already running.\nSend `.sh kill` to stop it first.');
    }

    // ── Run command with real-time streaming ──────────────────────────────────
    const cwd    = getCwd(jid);
    const header = `💻 *Terminal* — \`${cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd}\`\n📂 \`${cwd}\`\n\n`;
    const start  = Date.now();
    let output   = '';
    let lastEditContent = '';

    // Send initial "running" message — we'll edit this as output arrives
    let statusMsg;
    try {
      statusMsg = await sock.sendMessage(jid, {
        text: buildMsg(header, '', false, 0, 0),
      }, { quoted: msg });
    } catch {
      statusMsg = null;
    }

    const editMsg = async (content) => {
      if (!statusMsg || content === lastEditContent) return;
      lastEditContent = content;
      try {
        await sock.sendMessage(jid, {
          text: content,
          edit: statusMsg.key,
        });
      } catch {}
    };

    // Spawn the command in a shell so pipes, &&, ||, etc. all work
    const proc = spawn('bash', ['-c', cmd], {
      cwd,
      env: { ...process.env, TERM: 'xterm' },
      timeout: 0, // we manage timeout ourselves
    });

    let killed = false;
    const killFn = () => { killed = true; proc.kill('SIGTERM'); setTimeout(() => proc.kill('SIGKILL'), 3000); };
    activeProc.set(jid, { proc, kill: killFn });

    // Live-edit the message every 2 seconds while the command runs
    const editInterval = setInterval(async () => {
      await editMsg(buildMsg(header, output, false, 0, Date.now() - start));
    }, 2000);

    // Hard timeout — 3 minutes
    const timeoutHandle = setTimeout(() => {
      output += '\n\n⏰ [Timeout: 3 minutes exceeded — process killed]';
      killFn();
    }, 180000);

    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { output += d.toString(); });

    await new Promise(res => proc.on('close', res));

    clearInterval(editInterval);
    clearTimeout(timeoutHandle);
    activeProc.delete(jid);

    const ms       = Date.now() - start;
    const exitCode = proc.exitCode ?? (killed ? 137 : 0);

    // If output fits in one message — edit in-place
    if (output.length <= MAX_CHUNK) {
      await editMsg(buildMsg(header, output, true, exitCode, ms));
      return;
    }

    // Long output — split into chunks and send separately
    const firstChunk = output.slice(0, MAX_CHUNK);
    await editMsg(buildMsg(header, firstChunk, false, exitCode, ms));

    const rest = output.slice(MAX_CHUNK);
    for (let i = 0; i < rest.length; i += MAX_CHUNK) {
      const part  = rest.slice(i, i + MAX_CHUNK);
      const isLast = i + MAX_CHUNK >= rest.length;
      await sock.sendMessage(jid, {
        text: isLast
          ? buildMsg(`💻 *(cont.)*\n\n`, part, true, exitCode, ms)
          : `💻 *(cont.)*\n\n\`\`\`\n${part}\n\`\`\``,
      }, { quoted: msg });
      if (!isLast) await new Promise(r => setTimeout(r, 500)); // small delay between chunks
    }
  },
};
