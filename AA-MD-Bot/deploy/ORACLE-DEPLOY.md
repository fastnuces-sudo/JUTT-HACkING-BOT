# 🚀 AA MD Bot — Oracle Cloud Free Tier Deployment Guide

> **3 Servers + Self-hosted MongoDB on Oracle Cloud**  
> Total cost: **₹0 / $0** — fully within Always Free limits

---

## 📋 Architecture

```
Oracle Cloud VCN (Virtual Private Network)
│
├── VM1 — Server 1  (1 OCPU, 8 GB RAM)   ← Bot + MongoDB host
├── VM2 — Server 2  (1 OCPU, 8 GB RAM)   ← Bot only
└── VM3 — Server 3  (1 OCPU, 8 GB RAM)   ← Bot only
                        ↑
              All 3 connect to MongoDB on VM1 via private IP
```

**Oracle Free Tier used:**
- 4 ARM OCPUs + 24 GB RAM → we use 3 OCPUs + 18 GB RAM ✔
- 200 GB block storage → we use ~60 GB ✔
- 1 VCN + subnets → free ✔

---

## PART 1 — Oracle Cloud Account Setup

### Step 1 — Sign in to Oracle Cloud

1. Go to **https://cloud.oracle.com**
2. Sign in with your Oracle account
3. You will land at the **Oracle Cloud Console** home

---

### Step 2 — Create a VCN (Virtual Network)

> All 3 VMs must be in the same VCN so they can communicate via private IP.

1. In the top search bar type **VCN** → click **Virtual Cloud Networks**
2. Click **Start VCN Wizard**
3. Choose **Create VCN with Internet Connectivity** → click **Start VCN Wizard**
4. Fill in:
   - **VCN Name:** `aa-bot-vcn`
   - **VCN CIDR Block:** `10.0.0.0/16`
   - Leave everything else as default
5. Click **Next** → **Create**
6. Wait ~30 seconds → click **View VCN**

---

### Step 3 — Open Required Ports in Security List

> By default Oracle blocks all inbound ports. We need to open port 5000 (dashboard) and 27017 (MongoDB internal).

1. Inside your VCN, click **Security Lists** in the left sidebar
2. Click **Default Security List for aa-bot-vcn**
3. Click **Add Ingress Rules** and add these 3 rules:

**Rule 1 — SSH (already exists, skip if present)**
| Field | Value |
|---|---|
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | TCP |
| Destination Port | `22` |

**Rule 2 — Bot Dashboard**
| Field | Value |
|---|---|
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | TCP |
| Destination Port | `5000` |
| Description | `AA MD Bot Dashboard` |

**Rule 3 — MongoDB (internal VMs only)**
| Field | Value |
|---|---|
| Source CIDR | `10.0.0.0/16` |
| IP Protocol | TCP |
| Destination Port | `27017` |
| Description | `MongoDB internal` |

4. Click **Add Ingress Rules**

---

## PART 2 — Create 3 VMs

> Repeat these steps 3 times (once per server).

### Step 4 — Create VM1 (Server 1)

1. Go to **Compute → Instances** from the top menu
2. Click **Create Instance**
3. Fill in:

**Name & placement:**
- Name: `aa-bot-server-1`
- Compartment: (your root compartment)

**Image & shape:**
- Click **Change image** → choose **Canonical Ubuntu** → **Ubuntu 22.04**
- Click **Change shape** → choose **Ampere** (ARM) → `VM.Standard.A1.Flex`
- Set: **1 OCPU**, **8 GB Memory**

> ⚠️ Do NOT use AMD shapes — they have only 1 GB RAM (too small)

**Networking:**
- VCN: `aa-bot-vcn`
- Subnet: `Public Subnet-aa-bot-vcn`
- Check ✅ **Assign a public IPv4 address**

**SSH keys:**
- Choose **Generate a key pair for me**
- Click **Save Private Key** → save as `aa-bot-server-1.key`

4. Click **Create**
5. Wait 2-3 minutes until status shows **Running**
6. **Write down the Public IP** shown on the instance page

---

### Step 5 — Create VM2 (Server 2)

Repeat Step 4 with these changes:
- Name: `aa-bot-server-2`
- Save key as: `aa-bot-server-2.key`
- **Write down the Public IP**

---

### Step 6 — Create VM3 (Server 3)

Repeat Step 4 with these changes:
- Name: `aa-bot-server-3`
- Save key as: `aa-bot-server-3.key`
- **Write down the Public IP**

---

### Step 7 — Note Down Private IPs

> Private IPs are how the VMs talk to each other (for MongoDB).

For each VM:
1. Click on the instance name
2. Scroll down to **Primary VNIC** section
3. Note the **Private IP address** (looks like `10.0.x.x`)

Write these down:
```
VM1 Public IP  : _______________
VM1 Private IP : _______________   ← VM2 and VM3 will connect to this

VM2 Public IP  : _______________
VM2 Private IP : _______________

VM3 Public IP  : _______________
VM3 Private IP : _______________
```

---

## PART 3 — Connect via SSH

### Step 8 — SSH into each VM

**On Windows:** Use PuTTY or Windows Terminal  
**On Mac/Linux:** Use Terminal

First, fix the key file permissions:
```bash
chmod 400 aa-bot-server-1.key
chmod 400 aa-bot-server-2.key
chmod 400 aa-bot-server-3.key
```

Connect to VM1:
```bash
ssh -i aa-bot-server-1.key ubuntu@YOUR_VM1_PUBLIC_IP
```

> If you see a prompt "Are you sure you want to continue?" — type `yes` and press Enter.

---

## PART 4 — Run Setup Script (one VM at a time)

### Step 9 — Setup VM1 (with MongoDB)

**Connected to VM1 via SSH — run these commands:**

```bash
# Download setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh

# Run setup (Server 1 installs MongoDB locally)
bash setup.sh 1 install-mongo
```

> ⚠️ This takes 5-10 minutes. When done, you will see:
> ```
> ══════════════════════════════
>   SAVE THESE CREDENTIALS:
>   MONGO_BOT_PASS : xXxXxXxX
>   MONGODB_URI    : mongodb://aa_bot_user:xXxXxXxX@localhost:27017/aa_md_bot
> ══════════════════════════════
> ```
> **Copy and save `MONGO_BOT_PASS` immediately — it won't be shown again!**

---

### Step 10 — Setup VM2 (connects to VM1's MongoDB)

Open a **new terminal window**. Connect to VM2:
```bash
ssh -i aa-bot-server-2.key ubuntu@YOUR_VM2_PUBLIC_IP
```

Run:
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh

# Replace 10.0.0.X with VM1's PRIVATE IP
bash setup.sh 2 10.0.0.X
```

---

### Step 11 — Setup VM3 (connects to VM1's MongoDB)

Open another terminal. Connect to VM3:
```bash
ssh -i aa-bot-server-3.key ubuntu@YOUR_VM3_PUBLIC_IP
```

Run:
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh -o setup.sh

# Replace 10.0.0.X with VM1's PRIVATE IP
bash setup.sh 3 10.0.0.X
```

---

## PART 5 — Configure Each Bot

### Step 12 — Edit .env on VM1

```bash
nano /home/ubuntu/AA-MD-Bot/.env
```

Fill in your values:
```env
PORT=5000
SERVER_ID=server-1

# MongoDB — VM1 uses localhost
MONGODB_URI=mongodb://aa_bot_user:YOUR_MONGO_BOT_PASS@localhost:27017/aa_md_bot

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_FEATURES_BOT_TOKEN=your_features_token_here

# Optional APIs
OPENWEATHER_API_KEY=
OMDB_API_KEY=
```

Save: press `Ctrl+X` → `Y` → `Enter`

---

### Step 13 — Edit .env on VM2

```bash
nano /home/ubuntu/AA-MD-Bot/.env
```

```env
PORT=5000
SERVER_ID=server-2

# MongoDB — connects to VM1's private IP
MONGODB_URI=mongodb://aa_bot_user:YOUR_MONGO_BOT_PASS@10.0.0.X:27017/aa_md_bot

# Telegram (optional — different token for this server or leave blank)
TELEGRAM_BOT_TOKEN=
TELEGRAM_FEATURES_BOT_TOKEN=
```

Save: `Ctrl+X` → `Y` → `Enter`

---

### Step 14 — Edit .env on VM3

Same as VM2 but change `SERVER_ID=server-3`.

---

## PART 6 — Start the Bots

### Step 15 — Start bot on all 3 VMs

**On each VM**, run:
```bash
cd /home/ubuntu/AA-MD-Bot
pm2 restart aa-md-bot
pm2 logs aa-md-bot --lines 50
```

You should see:
```
✨ AA MD Bot is ready!
[DB] ✅ MongoDB loaded — groups:0  settings:0 ...
📱 QR ready — scan now
```

---

### Step 16 — Open the Dashboard and Pair WhatsApp

In your browser, open each server's dashboard:
- **Server 1:** `http://VM1_PUBLIC_IP:5000`
- **Server 2:** `http://VM2_PUBLIC_IP:5000`
- **Server 3:** `http://VM3_PUBLIC_IP:5000`

For each dashboard:
1. Enter the WhatsApp number to connect (with country code, e.g. `923316041183`)
2. Click **Get Pairing Code**
3. On WhatsApp: **Settings → Linked Devices → Link a Device → Link with phone number**
4. Enter the 8-digit pairing code shown

---

## PART 7 — Final Configuration

### Step 17 — UFW Firewall on each VM (already done by script)

Verify firewall is active:
```bash
sudo ufw status
```

Expected output:
```
Status: active
To                Action    From
--                ------    ----
OpenSSH           ALLOW     Anywhere
5000/tcp          ALLOW     Anywhere
27017/tcp         ALLOW     10.0.0.0/16
```

---

### Step 18 — Verify MongoDB is shared

On VM2 or VM3, test the connection:
```bash
mongosh "mongodb://aa_bot_user:YOUR_PASS@10.0.0.X:27017/aa_md_bot" --eval "db.runCommand({ping:1})"
```

Expected:
```json
{ "ok": 1 }
```

---

### Step 19 — Enable bot auto-start on VM reboot

Already done by the setup script. Verify:
```bash
pm2 list
systemctl is-enabled pm2-ubuntu
```

Both should show `enabled` / `online`.

---

## PART 8 — Useful Commands

### Daily management

```bash
# View logs (live)
pm2 logs aa-md-bot

# Restart bot
pm2 restart aa-md-bot

# Stop bot
pm2 stop aa-md-bot

# Bot status
pm2 status

# Update bot (pull latest code)
cd /home/ubuntu/AA-MD-Bot
git pull
npm install --omit=dev
pm2 restart aa-md-bot

# MongoDB status (VM1 only)
sudo systemctl status mongod

# MongoDB backup
mongodump --uri="mongodb://aa_bot_user:PASS@localhost:27017/aa_md_bot" --out=/home/ubuntu/backup
```

---

### Troubleshooting

| Problem | Solution |
|---|---|
| Dashboard not loading | Check `pm2 logs aa-md-bot` for errors |
| MongoDB connection failed | Check VM1 private IP in .env is correct |
| Bot crashes after start | Run `pm2 logs aa-md-bot --err` |
| yt-dlp not found | Run `which yt-dlp` — if missing, run `sudo curl -L ... -o /usr/local/bin/yt-dlp` |
| QR code doesn't appear | Delete session folder: `rm -rf session/default` then restart |
| Port 5000 unreachable | Check Oracle Security List has port 5000 open (Step 3) |

---

## Summary Checklist

- [ ] VCN created with Internet Connectivity
- [ ] Security List: ports 22, 5000, 27017 opened
- [ ] VM1 created (1 OCPU, 8 GB, Ubuntu 22.04, ARM)
- [ ] VM2 created (1 OCPU, 8 GB, Ubuntu 22.04, ARM)
- [ ] VM3 created (1 OCPU, 8 GB, Ubuntu 22.04, ARM)
- [ ] Private IPs noted for all 3 VMs
- [ ] `setup.sh 1 install-mongo` run on VM1 — MongoDB credentials saved
- [ ] `setup.sh 2 10.0.0.X` run on VM2
- [ ] `setup.sh 3 10.0.0.X` run on VM3
- [ ] `.env` configured on all 3 VMs
- [ ] `pm2 restart aa-md-bot` run on all 3
- [ ] WhatsApp paired via dashboard on all 3
- [ ] `pm2 save` run on all 3 for auto-restart on reboot

---

> 💡 **Tip:** Oracle ARM VMs use Ubuntu 22.04 on aarch64 (ARM64). All packages installed by the setup script are ARM-compatible. Node.js, ffmpeg, MongoDB 7.0, and yt-dlp all have official ARM64 builds.
