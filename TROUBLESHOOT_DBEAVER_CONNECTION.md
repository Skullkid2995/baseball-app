# Troubleshooting DBeaver "Unknown host" Error

## DNS is Working ✅
The hostname `aws-0-us-east-1.pooler.supabase.com` resolves correctly to IPv4 addresses.

## If You're Still Getting "Unknown host" in DBeaver

### Step 1: Verify Your Connection Settings
1. **Edit your connection** in DBeaver
2. **Double-check the Host field** - make sure there are no extra spaces or typos:
   ```
   aws-0-us-east-1.pooler.supabase.com
   ```
3. **Check the Port** is set to: `6543`

### Step 2: Test the Connection
1. In the connection settings dialog, click **"Test Connection"**
2. If it still fails, look at the error message carefully

### Step 3: Clear DBeaver Cache
1. **Close DBeaver completely**
2. **Restart DBeaver**
3. Try connecting again

### Step 4: Try Different Region
If us-east-1 doesn't work, try:
- **Host**: `aws-0-us-west-1.pooler.supabase.com`
- **Port**: `6543`

Or:
- **Host**: `aws-0-eu-west-1.pooler.supabase.com`  
- **Port**: `6543`

### Step 5: Check Network Settings in DBeaver
1. Edit connection → **Network** tab
2. Make sure **"Use SSH tunnel"** is **NOT** checked (unless you specifically need it)

### Step 6: Verify Credentials
Make sure you have:
- **Username**: `postgres.uzbupbtrmbmmmkztmrtl` (with the project ref)
- **Password**: Your database password (not the anon key)
- **Database**: `postgres`

### Common Issues:
- **Typo in hostname**: Copy-paste the hostname exactly
- **Wrong port**: Use `6543` for Session mode (not `5432`)
- **Cached connection**: Restart DBeaver
- **Network restrictions**: Check if your firewall is blocking the connection




