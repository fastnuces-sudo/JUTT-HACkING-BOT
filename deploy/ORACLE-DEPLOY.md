# Oracle Cloud deployment guide

The supported default is **one Ubuntu 22.04 VM** running Jutts Bot, PM2, Nginx and HTTPS, with the database hosted on **[Neon](https://neon.tech)** (serverless Postgres). No database server runs on the VM, so there is nothing to harden, back up or expose between machines.

## Prerequisite: create the Neon database

1. Sign up at [console.neon.tech](https://console.neon.tech) — the free tier is enough to start.
2. Create a project (choose the region closest to your VM to keep latency low).
3. Open **Connection Details** and copy the **pooled** connection string — its host contains `-pooler`:

   ```text
   postgresql://user:password@ep-xxxx-pooler.us-east-2.aws.neon.tech/jutts_bot?sslmode=require
   ```

Keep it handy: the setup script asks for it. You can also export it beforehand for a fully unattended install:

```bash
export DATABASE_URL='postgresql://user:password@ep-xxxx-pooler.us-east-2.aws.neon.tech/jutts_bot?sslmode=require'
```

Tables are created automatically the first time the bot starts — you never need to run SQL by hand.

> **Neon free tier note:** a free project scales to zero after a few minutes idle. The first query afterwards wakes it in under a second, and the bot retries automatically, so this is safe for normal use.

## Recommended: one VM

### 1. Create the VM

- Image: Ubuntu 22.04
- Shape: `VM.Standard.A1.Flex` (ARM64) or an x86_64 shape
- Save the SSH private key
- In the Oracle VCN security list, allow inbound TCP:
  - `22` for SSH
  - `80` for HTTP/Let's Encrypt
  - `443` for HTTPS

Do **not** expose port `5000`. Nginx is the public entry point; Node stays private. The database is reached outbound over TLS to Neon, so no inbound database port is ever needed.

### 2. Connect

```bash
chmod 400 your-oracle-key.key
ssh -i your-oracle-key.key ubuntu@YOUR_PUBLIC_IP
```

### 3. Run setup

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/fastnuces-sudo/JUTT-HACkING-BOT/main/deploy/setup.sh)
```

The script is idempotent and performs these steps:

- Updates Ubuntu and installs required system packages
- Asks for (or reuses) your Neon `DATABASE_URL` and validates it
- Installs Node.js 20, PM2, FFmpeg, yt-dlp and Deno
- Clones to `/home/ubuntu/JUTT-HACkING-BOT`
- Runs `npm ci --omit=dev` from the committed lockfile
- Generates `.env` secrets and a protected dashboard token
- Runs Node on `127.0.0.1:5000`
- Configures Nginx, a nip.io hostname and Let's Encrypt
- Opens only SSH/HTTP/HTTPS in the VM firewall
- Registers the PM2 process for reboot persistence

The final output includes a URL similar to:

```text
https://203-0-113-10.nip.io/#token=64_HEX_CHARACTERS
```

The token is in a URL **fragment**, so it is not sent to Nginx access logs. The login page exchanges it for a signed HttpOnly cookie.

## Pair WhatsApp

1. Open the protected dashboard URL printed by setup.
2. Enter a session ID.
3. Select QR or phone-number pairing.
4. For phone pairing, enter digits with country code, such as `923001234567`.
5. In WhatsApp, open **Settings → Linked Devices → Link a Device → Link with phone number**.
6. Enter the displayed code.

## Operations

```bash
pm2 status
pm2 logs jutts-bot
pm2 logs jutts-bot --err
pm2 restart jutts-bot
bash ~/redeploy.sh
```

Configuration:

```bash
nano /home/ubuntu/JUTT-HACkING-BOT/.env
pm2 delete jutts-bot
pm2 start /home/ubuntu/JUTT-HACkING-BOT/ecosystem.config.cjs
pm2 save
```

Health check:

```bash
curl -fsS http://127.0.0.1:5000/healthz
```

Dashboard token recovery:

```bash
grep '^DASHBOARD_TOKEN=' /home/ubuntu/JUTT-HACkING-BOT/.env
```

To rotate it:

```bash
sed -i "s/^DASHBOARD_TOKEN=.*/DASHBOARD_TOKEN=$(openssl rand -hex 32)/" /home/ubuntu/JUTT-HACkING-BOT/.env
pm2 delete jutts-bot
pm2 start /home/ubuntu/JUTT-HACkING-BOT/ecosystem.config.cjs
pm2 save
```

Existing browser cookies become invalid after rotation.

## Optional: multiple VMs sharing one database

Because Neon is a managed service reachable over TLS, running several bot VMs is straightforward: give every VM the **same** `DATABASE_URL` and a **distinct** `SERVER_ID`.

```dotenv
# VM1 .env
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.us-east-2.aws.neon.tech/jutts_bot?sslmode=require
SERVER_ID=server-1

# VM2 .env — same DATABASE_URL, different SERVER_ID
SERVER_ID=server-2
```

Then restart PM2 from the ecosystem file on each VM:

```bash
pm2 delete jutts-bot
pm2 start /home/ubuntu/JUTT-HACkING-BOT/ecosystem.config.cjs
pm2 save
```

Use the pooled (`-pooler`) connection string on every VM so Neon multiplexes the connections. There are no VCN routing rules, firewall openings or `bindIp` edits to manage.

## Security checklist

- [ ] Port 5000 is not public
- [ ] `.env` mode is `600`
- [ ] `DASHBOARD_TOKEN` is random and private
- [ ] `DATABASE_URL` ends with `sslmode=require` and its password is URL-encoded
- [ ] The Neon password has been rotated if it ever appeared in Git history or a screenshot
- [ ] HTTPS works before pairing a real account
- [ ] Old database credentials were rotated if they ever appeared in Git history
- [ ] `npm audit --omit=dev` reports zero known vulnerabilities

## Troubleshooting

| Problem | Checks |
|---|---|
| Dashboard unavailable | `pm2 logs jutts-bot --err`, `sudo nginx -t`, `sudo systemctl status nginx` |
| Login rejected | Verify `DASHBOARD_TOKEN` in `.env`; restart PM2 from ecosystem config |
| Database connection failed | Verify `DATABASE_URL` in `.env`, confirm the Neon project is not suspended, and check the console for the current password |
| `self-signed certificate` / TLS error | Ensure the URL ends with `sslmode=require` and that the host is the real Neon endpoint |
| Bot restart loop | `pm2 logs jutts-bot --lines 100 --nostream` |
| YouTube bot check | Update yt-dlp and provide a private `cookies.txt` as documented in `cookies.txt.example` |
