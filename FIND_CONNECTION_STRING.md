# Finding Your Supabase Connection String

## Current Location
You're in: **Database** → **Settings** ✅ (Correct location!)

## What to Look For

On the Settings → Database page, scroll down and look for these sections:

### Option 1: "Connection Pooling" Section
- Should show pooler connection details
- Look for text mentioning "aws-0-[region].pooler.supabase.com"

### Option 2: "Connection info" or "Connection string" Tab/Section
- May be a separate tab at the top of the page
- Or a collapsible section you need to expand

### Option 3: Look for These Keywords
Search the page for:
- "pooler"
- "aws-0"
- "Connection string"
- "Session mode"
- "Transaction mode"

## Alternative: Get Connection String from API Settings

If you can't find it in Database Settings, try:

1. **Settings** → **API** (in the left sidebar, under Settings)
2. Look for database connection information there

## Manual Connection Details

Based on your project reference `uzbupbtrmbmmmkztmrtl`, you can try these pooler addresses:

**Common Regions to Try:**
- `aws-0-us-east-1.pooler.supabase.com` (US East - Virginia)
- `aws-0-us-west-1.pooler.supabase.com` (US West - California)  
- `aws-0-eu-west-1.pooler.supabase.com` (EU West - Ireland)
- `aws-0-ap-southeast-1.pooler.supabase.com` (Asia Pacific - Singapore)

**For DBeaver, try connecting with:**
- **Host**: `aws-0-us-east-1.pooler.supabase.com` (try different regions)
- **Port**: `6543` (Session mode) or `5432` (Transaction mode)
- **Database**: `postgres`
- **Username**: `postgres.uzbupbtrmbmmmkztmrtl`
- **Password**: Your database password

**To find your password:**
1. Settings → Database
2. Look for "Database password" section
3. You might need to click "Reset database password" if you don't know it

## Quick Test

Try this in PowerShell to see which pooler works:
```powershell
nslookup aws-0-us-east-1.pooler.supabase.com
nslookup aws-0-us-west-1.pooler.supabase.com
```

If the hostname resolves, that region is likely correct for your project.




