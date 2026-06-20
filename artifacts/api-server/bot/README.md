# AA MD Bot v3.0.0

> **Multi-Device WhatsApp Bot** by Ahsan Ali Wadani | AA Mods

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the bot
npm start
```

On first run, scan the QR code in the terminal with WhatsApp.

---

## 📱 Multi-Device Setup

### Add New Session
```
.adddevice [session_name]
```
Scan the QR code that appears in the terminal.

### View All Sessions
```
.devices
```

### Remove a Session
```
.deldevice [session_name]
```

---

## 👑 Owner Setup

Edit `bot/config.js` and add your WhatsApp number to `owners`:

```js
owners: ['923001234567'],  // Without + or spaces
```

Or use the command after setting an initial owner in config:
```
.addsudo @user
```

---

## 🔧 Commands Overview

| Category | Count | Description |
|----------|-------|-------------|
| 🔧 Utility | 13 | ping, calc, weather, translate, qr, info... |
| 🎮 Fun | 14 | joke, meme, trivia, ship, roast, dice... |
| 👮 Admin | 10 | kick, promote, warn, antilink, tagall... |
| 👑 Owner | 13 | eval, shell, broadcast, devices, sudo... |
| 🔍 Search | 8 | wiki, youtube, anime, lyrics, recipe... |
| 📥 Download | 9 | ytmp3, ytmp4, tiktok, instagram... |
| 🎨 Media | 8 | sticker, blur, flip, grayscale, resize... |
| 👥 Group | 9 | welcome, setname, poll, antibot... |
| 🛠️ Tools | 8 | system, memory, speedtest, backup... |
| 💰 Economy | 8 | balance, daily, work, gamble, shop... |
| ⭐ Level | 5 | rank, xp, top, profile... |
| **Total** | **105+** | |

---

## 📋 Key Commands

```
.menu              - Show all commands
.menu [category]   - Show category commands

# Owner
.addsudo @user     - Add sudo user
.delsudo @user     - Remove sudo user
.listsudo          - List all sudo/owners
.broadcast [msg]   - Broadcast to all groups
.maintenance on    - Enable maintenance mode
.restart           - Restart the bot
.eval [code]       - Execute JavaScript
.shell [cmd]       - Execute shell command

# Device Management
.devices           - Show all sessions
.adddevice [name]  - Add new WhatsApp session
.deldevice [name]  - Remove a session

# Economy
.balance           - Check coins
.daily             - Claim daily reward
.work              - Earn coins by working
.gamble [amount]   - Try your luck
.shop              - Browse item shop
.transfer @u [amt] - Send coins

# Fun
.joke              - Random joke
.meme              - Random meme
.truth             - Truth question
.dare              - Dare challenge
.8ball [question]  - Magic 8-ball
.ship @u1 @u2      - Love calculator
.trivia            - Trivia quiz
.rps rock/paper/scissors

# Media
.sticker           - Image/video to sticker
.sticker2img       - Sticker to image
.blur [level]      - Blur image
.grayscale         - B&W image
.flip h/v          - Mirror image
.resize [w] [h]    - Resize image

# Downloads
.ytmp3 [url]       - YouTube to MP3
.ytmp4 [url]       - YouTube to MP4
.tiktok [url]      - TikTok downloader
.instagram [url]   - Instagram downloader
.twitter [url]     - Twitter video
```

---

## 🗂️ Project Structure

```
bot/
├── index.js              # Main entry point
├── config.js             # Bot configuration
├── database/             # JSON databases
│   ├── users.json
│   ├── groups.json
│   ├── settings.json
│   └── sessions.json
├── lib/                  # Core libraries
│   ├── sessionManager.js # Multi-device engine
│   ├── commandHandler.js # Command processing
│   ├── pluginLoader.js   # Auto plugin loader
│   ├── database.js       # DB operations
│   ├── helper.js         # Utility functions
│   └── logger.js         # Logging system
├── plugins/              # 105+ plugins
│   ├── admin/
│   ├── download/
│   ├── economy/
│   ├── fun/
│   ├── group/
│   ├── level/
│   ├── media/
│   ├── owner/
│   ├── search/
│   ├── tools/
│   └── utility/
├── session/              # WhatsApp sessions
├── logs/                 # Bot logs
└── temp/                 # Temporary files
```

---

## 🔌 Adding Custom Plugins

Create a file in `bot/plugins/[category]/mycommand.js`:

```js
export default {
  command: 'mycommand',           // Command name
  alias: ['mc', 'mycmd'],         // Aliases
  description: 'My custom command',
  category: 'utility',
  
  // Permissions (optional)
  ownerOnly: false,
  sudoOnly: false,
  groupOnly: false,
  privateOnly: false,
  adminOnly: false,
  
  async execute({ reply, sock, jid, senderJid, msg, args, text, db, config, isOwner, isSudo }) {
    reply('Hello from my plugin!');
  },
};
```

Then reload with: `.reload`

---

## 🛡️ Permission Levels

| Level | Access |
|-------|--------|
| Owner | Full control |
| Sudo | Extended control (no eval/shell) |
| Admin | Group admin commands |
| User | Regular commands |

---

## 📞 Support

- Developer: **Ahsan Ali Wadani**
- Brand: **AA Mods**
- Bot: **AA MD Bot v3.0.0**
