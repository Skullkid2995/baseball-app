# Fix "FATAL: Tenant or user not found" Error

## Good News! ✅
The connection is working - you can reach the host. The issue is authentication.

## Solution: Fix Username and SSL Settings

### Step 1: Verify Username Format
The username should be exactly: `postgres.uzbupbtrmbmmmkztmrtl`

Make sure:
- No extra spaces
- Lowercase only
- Includes the dot between `postgres` and your project ref

### Step 2: Configure SSL (IMPORTANT!)
The pooler connection requires SSL. In DBeaver:

1. Edit your connection → **"SSL"** tab
2. **Check "Use SSL"** checkbox
3. Set **"SSL Mode"** to: `require`
4. Leave other SSL fields empty (unless you have specific certificates)

### Step 3: Verify Password
1. Go to Supabase Dashboard → Settings → Database
2. Find "Database password" section
3. If you don't know it, click "Reset database password"
4. Use this password in DBeaver (NOT the anon key)

### Step 4: Final Connection Settings
**Main Tab:**
- Host: `aws-0-us-east-1.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- Username: `postgres.uzbupbtrmbmmmkztmrtl`
- Password: (your database password)

**SSL Tab:**
- ✅ Use SSL: **Checked**
- SSL Mode: `require`

### Step 5: Test Connection
Click "Test Connection" - it should work now!

## Common Mistakes
- ❌ Using anon key as password (wrong!)
- ❌ Username without the project ref (needs `postgres.uzbupbtrmbmmmkztmrtl`)
- ❌ SSL not enabled (required for pooler)
- ❌ Wrong database password

## Still Not Working?
If you still get errors, try:
1. Get the exact connection string from Supabase Dashboard
2. Settings → Database → Connection Pooling → Session mode
3. Parse the connection string to see the exact format they expect




