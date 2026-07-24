# 🗄️ Oracle Autonomous Database Setup Guide
## AA MD Bot — Free Tier (20 GB, No Maintenance Required)

> **Why Oracle ADB?**  
> MongoDB Atlas Free = 512 MB storage only.  
> Oracle Autonomous Database Free = **20 GB** storage + managed backups + 99.95% uptime SLA.  
> Oracle ADB 23ai has a **built-in MongoDB-compatible API** — no code changes needed.

---

## Overview

Oracle ADB acts as a drop-in MongoDB replacement:
- Same MongoDB Node.js driver ✅
- Same CRUD operations ✅
- Just different connection string ✅
- 20 GB free storage (40x more than Atlas free) ✅
- Fully managed — no installation, no updates ✅

---

## STEP 1 — Create Oracle Autonomous Database

1. Go to **https://cloud.oracle.com** → sign in
2. Top-left menu (☰) → **Oracle Database** → **Autonomous Database**
3. Click **Create Autonomous Database**

Fill in the form:

| Field | Value |
|---|---|
| Compartment | (your root compartment) |
| Display name | `aa-bot-db` |
| Database name | `aabotdb` |
| Workload type | ✅ **Transaction Processing** (OLTP) |
| Deployment type | ✅ **Serverless** |
| **Database version** | ✅ **23ai** ← IMPORTANT |
| ECPU count | `2` (Always Free) |
| Storage | `20 GB` (Always Free) |
| **Always Free** toggle | ✅ **ON** |

**Administrator credentials:**
- Username: `ADMIN` (fixed)
- Password: Make a strong password — **save it somewhere safe**
  - Must be 12–30 characters
  - Must include uppercase, lowercase, number, special char
  - Example: `MyBot@Oracle2024`

4. Click **Create Autonomous Database**
5. Wait 2–3 minutes until status shows **Available** (green)

---

## STEP 2 — Enable MongoDB API (ORDS)

> Oracle ADB uses ORDS (Oracle REST Data Services) to expose a MongoDB-compatible API on port 27017.

1. Click on your database `aa-bot-db` to open it
2. Click **Database Actions** → **Database Actions** (opens new tab)
3. Sign in with `ADMIN` + your password if prompted
4. In Database Actions, go to **REST** (top menu)
5. Click **AutoREST** in the left panel

OR take the easier path:

1. On the ADB details page, click **Database connection** button (top)
2. Scroll down to **MongoDB API** section
3. You will see a connection string like:
   ```
   mongodb://[user]:[password]@adb-xxxxxxxx.adb.REGION.oraclecloudapps.com:27017/[user]?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true
   ```
4. **Copy this string** — this is your `MONGODB_URI`

> If you don't see the MongoDB API section, follow Step 2b below to enable ORDS first.

---

## STEP 2b — Enable ORDS (if MongoDB API section was missing)

1. On ADB details page, click **Database Actions** → **SQL**
2. Sign in as `ADMIN`
3. Paste and run this SQL to enable ORDS:

```sql
BEGIN
  ORDS_ADMIN.ENABLE_SCHEMA(
    p_enabled => TRUE,
    p_schema  => 'ADMIN',
    p_url_mapping_type => 'BASE_PATH',
    p_url_mapping_pattern => 'admin',
    p_auto_rest_auth => FALSE
  );
  COMMIT;
END;
/
```

4. Click ▶ Run
5. Go back to **Database connection** page — MongoDB API section should now appear

---

## STEP 3 — Get Your Connection String

On the ADB details page:
1. Click **Database connection**
2. In the **MongoDB API** section, copy the full connection string

It looks like:
```
mongodb://ADMIN:YourPassword@adb-abcde12345.adb.ap-mumbai-1.oraclecloudapps.com:27017/ADMIN?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true
```

Replace `YourPassword` with the ADMIN password you set in Step 1.

**This is your `MONGODB_URI` — paste it in your `.env` file.**

---

## STEP 4 — Update .env on All 3 Servers

SSH into each server VM and edit `.env`:

```bash
nano /home/ubuntu/AA-MD-Bot/.env
```

Paste your connection string:
```env
PORT=5000
SERVER_ID=server-1    # Change to server-2 / server-3 on other VMs

MONGODB_URI=mongodb://ADMIN:YourPassword@adb-xxxxx.adb.REGION.oraclecloudapps.com:27017/ADMIN?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true

TELEGRAM_BOT_TOKEN=your_token
```

Save: `Ctrl+X` → `Y` → `Enter`

Restart bot:
```bash
pm2 restart aa-md-bot
pm2 logs aa-md-bot --lines 30
```

✅ Success message looks like:
```
[DB] ✅ MongoDB loaded — groups:0  settings:0  sessionSettings:0 ...
```

---

## STEP 5 — Verify Connection

**On any VM**, run:
```bash
cd /home/ubuntu/AA-MD-Bot
node -e "
import('./lib/database.js').then(async m => {
  const db = await m.getDb();
  if (db) {
    const ping = await db.command({ ping: 1 });
    console.log('✅ Oracle ADB connected:', JSON.stringify(ping));
  } else {
    console.log('❌ Connection failed');
  }
  process.exit(0);
});
"
```

Expected output: `✅ Oracle ADB connected: {"ok":1}`

---

## STEP 6 — View Your Data in Oracle Console

1. Go to ADB → **Database Actions** → **JSON**
2. You will see collections created by the bot:
   - `groups`
   - `settings`
   - `sessionSettings`
   - `birthdays`
   - `notes`
   - `sessions`
3. Click any collection to browse and edit documents

---

## Troubleshooting

### ❌ "Connection timeout" or "Server selection timeout"
- Make sure you copied the **full** connection string including all parameters
- Check that `retryWrites=false` and `loadBalanced=true` are in the URL
- Oracle ADB firewall: the bot connects outbound on port 27017 (always allowed)

### ❌ "Authentication failed"
- Check your ADMIN password — Oracle passwords are case-sensitive
- Make sure you URL-encoded special chars in password: replace `@` with `%40`, `#` with `%23`
- Safest: use a password without special characters: `MyBotOracle2024`

### ❌ "MongoDB API section missing in Database Connection"
- Your ADB might be on database version 19c instead of 23ai
- Solution: create a new ADB and select **23ai** version
- OR follow Step 2b to manually enable ORDS

### ❌ "SSL/TLS handshake failed"
- Make sure `tls=true` and `tlsAllowInvalidCertificates=true` are in the URI
- These params tell the MongoDB driver to accept Oracle's certificate

---

## Storage & Limits (Always Free)

| Resource | Limit |
|---|---|
| Storage | 20 GB |
| ECPU | 2 (shared) |
| Databases | 2 per region |
| Collections | Unlimited |
| Documents | Unlimited (up to 20 GB) |
| Connections | Up to 300 concurrent |
| Backup | Automatic (60 days) |

At typical bot usage (groups, settings, reminders), 20 GB lasts **years**.

---

## Connecting from All 3 Servers

All 3 bot instances use the **same `MONGODB_URI`** — Oracle ADB handles concurrent connections automatically. No special configuration needed.

```
Server 1 ──────────┐
Server 2 ──────────┼──→ Oracle ADB (cloud.oracle.com) ← 20 GB
Server 3 ──────────┘
```

Data is shared across all 3 bots automatically (settings, groups, reminders, etc.).

---

## Done ✅

Your bot now uses Oracle Autonomous Database — fully managed, 20 GB free, automatic backups, zero maintenance.
