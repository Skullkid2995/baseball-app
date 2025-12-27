# DBeaver Connection Guide for Supabase

## Problem: "Unknown host" Error

If you're getting an "Unknown host" error when trying to connect to `db.uzbupbtrmbmmmkztmrtl.supabase.co`, this is likely due to:

1. **IPv6 Connectivity Issue**: Supabase uses IPv6 for `.co` domains. If your network/ISP doesn't support IPv6, the hostname won't resolve.
2. **DNS Resolution**: Your DNS might not be resolving the Supabase hostname correctly.

## Solution: Use the Session Pooler (IPv4 Connection)

Supabase provides connection poolers that use IPv4, which should work even if your network doesn't support IPv6.

### Step 1: Get Your Connection String from Supabase Dashboard

**⚠️ IMPORTANT: You do NOT need to pay for the IPv4 add-on! The connection pooler is FREE and already supports IPv4.**

**Where to go:**
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (`uzbupbtrmbmmmkztmrtl`)
3. Navigate to **Settings** → **Database** (NOT the "Dedicated IPv4 address" page)
4. Scroll down to **"Connection string"** section
5. Look for **"Session mode"** connection string (this uses IPv4 via pooler - **FREE**)
6. It should look like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

**You're in the WRONG place if you see:**
- A page titled "Dedicated IPv4 address"
- Options to pay $4/month
- Information about upgrading your plan

**You're in the RIGHT place if you see:**
- "Connection string" section
- Multiple connection options (URI, Session mode, Transaction mode)
- Connection pooling information

### Step 2: Parse the Connection String

The connection string format is:
```
postgresql://postgres.uzbupbtrmbmmmkztmrtl:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

From this, extract:
- **Host**: `aws-0-[REGION].pooler.supabase.com` (e.g., `aws-0-us-east-1.pooler.supabase.com`)
- **Port**: `6543` (Session mode) or `5432` (Transaction mode)
- **Database**: `postgres`
- **Username**: `postgres.uzbupbtrmbmmmkztmrtl`
- **Password**: Your database password (NOT your anon key)

### Step 3: Configure DBeaver Connection

1. **Open DBeaver** and click "New Database Connection" (or press `Ctrl+Shift+N`)
2. **Select PostgreSQL** from the list
3. **Fill in the connection details**:
   - **Host**: `aws-0-[REGION].pooler.supabase.com` (from your connection string)
   - **Port**: `6543` (for Session mode) or `5432` (for Transaction mode)
   - **Database**: `postgres`
   - **Username**: `postgres.uzbupbtrmbmmmkztmrtl`
   - **Password**: Your database password
4. **Test Connection** to verify it works
5. **Save** the connection

### Step 4: Alternative - Transaction Mode Pooler

If Session mode doesn't work, try Transaction mode:
- **Port**: `6543` (Transaction mode pooler)
- The host will be the same pooler address

### Step 5: Direct Connection (If IPv6 Works)

If your network supports IPv6, you can use the direct connection:
- **Host**: `db.uzbupbtrmbmmmkztmrtl.supabase.co`
- **Port**: `5432`
- **Username**: `postgres.uzbupbtrmbmmmkztmrtl`
- **Password**: Your database password

## Troubleshooting

### Test DNS Resolution

Test if the hostname resolves:

**Windows PowerShell:**
```powershell
nslookup db.uzbupbtrmbmmmkztmrtl.supabase.co
ping db.uzbupbtrmbmmmkztmrtl.supabase.co
```

**If it fails, try the pooler:**
```powershell
nslookup aws-0-us-east-1.pooler.supabase.com
```

### Common Issues

1. **Wrong Password**: Make sure you're using the database password, NOT the anon key. Find it in Supabase Dashboard → Settings → Database → Database password.

2. **IP Restrictions**: Check if your Supabase project has IP restrictions enabled. Go to Settings → Database → Connection Pooling and check "Allow all IP addresses" or add your IP.

3. **Region Mismatch**: Make sure you're using the correct region in the pooler hostname. Check your Supabase project region in Settings → General.

4. **Port Mismatch**: 
   - Port `5432`: Transaction mode pooler
   - Port `6543`: Session mode pooler (recommended for DBeaver)

### Connection Pooler Modes

- **Session Mode** (Port 6543): Better for interactive tools like DBeaver. Supports prepared statements and temporary tables.
- **Transaction Mode** (Port 5432): Better for serverless environments. Each query runs in its own transaction.

## Quick Reference

**Your Project Reference**: `uzbupbtrmbmmmkztmrtl`

**Supabase Dashboard**: https://supabase.com/dashboard/project/uzbupbtrmbmmmkztmrtl

**Connection Settings Location**: Dashboard → Settings → Database → Connection string

## Verified Diagnosis

✅ **DNS Test Results:**
- `db.uzbupbtrmbmmmkztmrtl.supabase.co` → IPv6 only (2600:1f1c:f9:4d0e:6e9e:8258:4ea6:653a)
- `aws-0-us-east-1.pooler.supabase.com` → IPv4 addresses available (44.208.221.186, 52.45.94.125, etc.)

**This confirms the issue**: Your network/DBeaver cannot connect via IPv6, so you MUST use the pooler connection with IPv4.

## Need Help?

1. Check your Supabase dashboard for the exact connection string
2. Verify your network supports IPv6 (or use pooler)
3. Ensure your database password is correct
4. Check if IP restrictions are blocking your connection

