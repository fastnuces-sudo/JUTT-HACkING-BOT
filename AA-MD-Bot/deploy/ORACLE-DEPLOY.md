# 🚀 AA MD Bot — Oracle Cloud Free Tier Deployment
## 3 Servers + Oracle Autonomous Database (20 GB Free)

> **Total cost: ₹0 / $0** — entirely within Oracle Always Free limits

---

## Architecture

```
Oracle Cloud Free Tier
│
├── Autonomous Database (ADB 23ai)  ←── 20 GB, managed, zero maintenance
│         ↑ all 3 servers connect to this one DB
│
├── VM1 — Server 1  (ARM, 1 OCPU, 8 GB RAM)
├── VM2 — Server 2  (ARM, 1 OCPU, 8 GB RAM)
└── VM3 — Server 3  (ARM, 1 OCPU, 8 GB RAM)
```

**Always Free resources used:**
| Resource | Free Limit | Used |
|---|---|---|
| ARM OCPUs | 4 total | 3 (1 per VM) |
| ARM RAM | 24 GB total | 18 GB (6 GB per VM) |
| Block Storage | 200 GB | ~45 GB |
| Oracle ADB | 2 databases | 1 |
| ADB Storage | 20 GB | ~1 GB (grows with use) |

---

## Quick Reference — All Commands

```bash
# Start / stop / restart bot
pm2 restart aa-md-bot
pm2 stop aa-md-bot
pm2 logs aa-md-bot

# Update bot after code change
cd /home/ubuntu/AA-MD-Bot && git pull && npm install --omit=dev && pm2 restart aa-md-bot

# Check bot status
pm2 status

# Edit config
nano /home/ubuntu/AA-MD-Bot/.env
```

---

# PART A — Oracle Autonomous Database (do this FIRST)

**Full guide → [`deploy/ORACLE-ADB-GUIDE.md`](./ORACLE-ADB-GUIDE.md)**

Short version:
1. Oracle Console → **Autonomous Database** → Create
2. Choose **23ai**, **Transaction Processing**, **Serverless**, **Always Free ON**
3. Set ADMIN password → Create → wait 3 minutes
4. Open DB → **Database connection** → copy **MongoDB API** connection string
5. Keep this string ready — you'll paste it into `.env` on each server

---

# PART B — Create 3 Oracle VMs

## Step 1 — Create VCN

1. Oracle Console → search **VCN** → **Virtual Cloud Networks**
2. Click **Start VCN Wizard** → **Create VCN with Internet Connectivity**
3. VCN Name: `aa-bot-vcn` | CIDR: `10.0.0.0/16`
4. Click **Next** → **Create**

---

## Step 2 — Open Ports in Security List

VCN → **Security Lists** → **Default Security List** → **Add Ingress Rules**:

| Source CIDR | Protocol | Port | Description |
|---|---|---|---|
| `0.0.0.0/0` | TCP | `22` | SSH |
| `0.0.0.0/0` | TCP | `5000` | Bot Dashboard |

> MongoDB port not needed — Oracle ADB is cloud-managed (connects outbound on 27017 automatically)

---

## Step 3 — Create 3 VMs

**Compute → Instances → Create Instance** (repeat 3 times)

| Field | Value |
|---|---|
| Name | `aa-bot-server-1` (then 2, then 3) |
| Image | **Ubuntu 22.04** |
| Shape | **VM.Standard.A1.Flex** (ARM Ampere) |
| OCPU | **1** |
| Memory | **6 GB** (or 8 GB — your choice, stays within 24 GB total) |
| Subnet | Public Subnet, ✅ Assign public IPv4 |
| SSH Key | Generate → **Save private key** |

After creating, note down the **Public IP** of each VM.

> ⚠️ Use ARM shape (Ampere A1.Flex) — AMD micro shapes only have 1 GB RAM, too small for the bot.

---

## Step 4 — Fix SSH Key Permissions

On your computer (Mac/Linux terminal or Windows PowerShell):

```bash
# Mac / Linux
chmod 400 aa-bot-server-1.key
chmod 400 aa-bot-server-2.key
chmod 400 aa-bot-server-3.key
```

```powershell
# Windows PowerShell
icacls "aa-bot-server-1.key" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

---

## Step 5 — Push Code to GitHub

Before running setup on VMs, push this repository to your GitHub account:

```bash
# On your local machine
git remote add origin https://github.com/YOUR_USERNAME/AA-MD-Bot.git
git push -u origin main
```

Also update `REPO_URL` in `deploy/setup.sh`:
```bash
REPO_URL="https://github.com/YOUR_USERNAME/AA-MD-Bot.git"
```

---

# PART C — Setup Each Server

## Step 6 — Connect to VM1 via SSH

```bash
ssh -i aa-bot-server-1.key ubuntu@VM1_PUBLIC_IP
```

Type `yes` when asked about authenticity, then press Enter.

---

## Step 7 — Run Setup Script on VM1

```bash
# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh
bash setup.sh 1
```

**What this installs automatically:**
- ✅ System updates + ffmpeg
- ✅ Node.js 20
- ✅ yt-dlp (latest)
- ✅ Deno (for YouTube n-challenge)
- ✅ PM2 (process manager, auto-restart on reboot)
- ✅ Bot code (git clone)
- ✅ npm packages
- ✅ UFW firewall (SSH + 5000 open)
- ✅ `.env` template created

Takes **5–8 minutes**. When done you'll see: `✅ Server 1 Setup Complete!`

---

## Step 8 — Configure .env on VM1

```bash
nano /home/ubuntu/AA-MD-Bot/.env
```

Fill in your values:
```env
PORT=5000
SERVER_ID=server-1

# Oracle ADB connection string (from ORACLE-ADB-GUIDE.md Step 3)
MONGODB_URI=mongodb://ADMIN:YourPassword@adb-xxxxx.adb.REGION.oraclecloudapps.com:27017/ADMIN?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true

# Telegram bots (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_FEATURES_BOT_TOKEN=
```

Save: **Ctrl+X → Y → Enter**

Restart bot:
```bash
pm2 restart aa-md-bot
pm2 logs aa-md-bot --lines 40
```

Look for: `[DB] ✅ MongoDB loaded`

---

## Step 9 — Setup VM2

Open a **new terminal window**:

```bash
ssh -i aa-bot-server-2.key ubuntu@VM2_PUBLIC_IP

curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh
bash setup.sh 2
```

Then configure `.env` — same as VM1 but change `SERVER_ID=server-2`:
```bash
nano /home/ubuntu/AA-MD-Bot/.env
```

---

## Step 10 — Setup VM3

Same as VM2, use `SERVER_ID=server-3`:

```bash
ssh -i aa-bot-server-3.key ubuntu@VM3_PUBLIC_IP

curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh
bash setup.sh 3
nano /home/ubuntu/AA-MD-Bot/.env   # set SERVER_ID=server-3
pm2 restart aa-md-bot
```

---

# PART D — Pair WhatsApp on All 3 Servers

## Step 11 — Open Dashboards

In your browser:
- Server 1: `http://VM1_PUBLIC_IP:5000`
- Server 2: `http://VM2_PUBLIC_IP:5000`
- Server 3: `http://VM3_PUBLIC_IP:5000`

## Step 12 — Pair Each Bot

On each dashboard:
1. Enter the WhatsApp number (with country code, e.g. `923316041183`)
2. Click **Get Pairing Code**
3. On WhatsApp: **Settings → Linked Devices → Link a Device → Link with phone number**
4. Enter the 8-digit pairing code shown on screen

---

# PART E — Verify Everything Works

## Step 13 — Check Logs

On each server:
```bash
pm2 logs aa-md-bot --lines 50
```

Good signs:
```
✨ AA MD Bot is ready!
[DB] ✅ MongoDB loaded — groups:0  settings:0  reminders:0 ...
📱 Connected to WhatsApp as +92XXXXXXXXXX
```

## Step 14 — Test Database Connection

```bash
cd /home/ubuntu/AA-MD-Bot
node -e "import('./lib/database.js').then(async m => { const db = await m.getDb(); console.log(db ? '✅ Oracle ADB OK' : '❌ No connection'); process.exit(0); })"
```

## Step 15 — Verify Auto-Restart

```bash
pm2 list                  # should show aa-md-bot as 'online'
systemctl is-enabled pm2-ubuntu    # should show 'enabled'
```

---

# Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard won't load | Check `pm2 logs aa-md-bot --err` |
| `[DB] ⚠️ MONGODB_PASSWORD not set` | MONGODB_URI is empty in .env — paste Oracle ADB URI |
| `Connection timeout` | Check Oracle ADB URI has all params (retryWrites=false etc.) |
| `Authentication failed` | Wrong ADMIN password — check/reset in Oracle Console |
| Bot crashes immediately | Run `pm2 logs aa-md-bot` to see error |
| Port 5000 not reachable | Oracle Console → VCN → Security List → add port 5000 |
| SSH key rejected | Run `chmod 400 key-file.key` again |
| Bot disconnects often | Normal — WhatsApp disconnects idle bots; PM2 auto-reconnects |
| yt-dlp not found | `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp` |

---

# Complete Checklist ✅

**Oracle ADB:**
- [ ] ADB created (23ai, Transaction Processing, Always Free)
- [ ] ADMIN password saved
- [ ] MongoDB API connection string copied

**VMs:**
- [ ] VCN created
- [ ] Security List: ports 22 and 5000 opened
- [ ] VM1 created (1 OCPU, 6–8 GB, Ubuntu 22.04, ARM)
- [ ] VM2 created
- [ ] VM3 created
- [ ] SSH key files saved for all 3 VMs

**Setup:**
- [ ] `setup.sh 1` run on VM1
- [ ] `setup.sh 2` run on VM2
- [ ] `setup.sh 3` run on VM3
- [ ] `.env` configured on all 3 (MONGODB_URI filled in)
- [ ] `pm2 restart aa-md-bot` on all 3
- [ ] `pm2 save` on all 3

**WhatsApp:**
- [ ] Dashboard accessible on all 3 (port 5000)
- [ ] WhatsApp paired on Server 1
- [ ] WhatsApp paired on Server 2
- [ ] WhatsApp paired on Server 3

---

> 💡 **All 3 bots share the same Oracle ADB database.** Group settings, reminders, notes, and birthdays set on one bot are visible to all 3. Each bot still has its own WhatsApp session (independent numbers).
