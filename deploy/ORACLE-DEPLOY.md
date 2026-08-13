# Oracle Cloud deployment guide

The supported default is **one Ubuntu 22.04 VM** running Jutts Bot, MongoDB, PM2, Nginx and HTTPS. It is simpler and safer than exposing MongoDB between machines.

## Recommended: one VM

### 1. Create the VM

- Image: Ubuntu 22.04
- Shape: `VM.Standard.A1.Flex` (ARM64) or an x86_64 shape
- Save the SSH private key
- In the Oracle VCN security list, allow inbound TCP:
  - `22` for SSH
  - `80` for HTTP/Let's Encrypt
  - `443` for HTTPS

Do **not** expose ports `5000` or `27017`. Nginx is the public entry point; Node and MongoDB stay private.

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
- Installs MongoDB 7 with authentication and loopback-only binding
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

## Optional: private multi-VM database

Only use this if you understand Oracle VCN routing and firewall rules. Never bind MongoDB to `0.0.0.0` or expose `27017` to the internet.

Example layout:

```text
VM1 private IP 10.0.0.10: MongoDB + bot
VM2 private IP 10.0.0.11: bot
VM3 private IP 10.0.0.12: bot
```

### VM1: bind MongoDB to its private VCN address

Edit `/etc/mongod.conf`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.0.10
```

Then allow only the worker private IPs:

```bash
sudo ufw allow from 10.0.0.11 to 10.0.0.10 port 27017 proto tcp
sudo ufw allow from 10.0.0.12 to 10.0.0.10 port 27017 proto tcp
sudo systemctl restart mongod
```

Add matching Oracle VCN ingress rules with `/32` source CIDRs for the worker private IPs. Do not use `0.0.0.0/0`.

### VM2/VM3: point the bot to VM1

After running normal setup on each worker, edit its `.env`:

```dotenv
MONGODB_URI=mongodb://aa_bot_user:URL_ENCODED_PASSWORD@10.0.0.10:27017/aa_md_bot?authSource=aa_md_bot
```

Then restart PM2 from the ecosystem file:

```bash
pm2 delete jutts-bot
pm2 start /home/ubuntu/JUTT-HACkING-BOT/ecosystem.config.cjs
pm2 save
```

Each VM should use a distinct `SERVER_ID`. Re-running the full setup script on VM1 resets MongoDB to loopback-only; reapply the private `bindIp` afterward.

## Security checklist

- [ ] Ports 5000 and 27017 are not public
- [ ] `.env` mode is `600`
- [ ] `DASHBOARD_TOKEN` is random and private
- [ ] MongoDB password is unique and URL-encoded in the URI
- [ ] HTTPS works before pairing a real account
- [ ] Worker database rules use private `/32` source addresses
- [ ] Old database credentials were rotated if they ever appeared in Git history
- [ ] `npm audit --omit=dev` reports zero known vulnerabilities

## Troubleshooting

| Problem | Checks |
|---|---|
| Dashboard unavailable | `pm2 logs jutts-bot --err`, `sudo nginx -t`, `sudo systemctl status nginx` |
| Login rejected | Verify `DASHBOARD_TOKEN` in `.env`; restart PM2 from ecosystem config |
| MongoDB failed | `sudo systemctl status mongod`, then verify `MONGODB_URI` and `authSource` |
| Worker cannot reach VM1 | Test private routing and confirm both UFW and Oracle VCN `/32` rules |
| Bot restart loop | `pm2 logs jutts-bot --lines 100 --nostream` |
| YouTube bot check | Update yt-dlp and provide a private `cookies.txt` as documented in `cookies.txt.example` |
