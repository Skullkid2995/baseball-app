# Get the Exact Connection String from Supabase

## The Problem
"Tenant or user not found" usually means we're using the wrong pooler hostname/region or username format.

## Solution: Get the Exact Connection String from Supabase Dashboard

### Step 1: Find Your Connection String
1. Go to: https://supabase.com/dashboard/project/uzbupbtrmbmmmkztmrtl
2. In the left sidebar, click **Settings** (gear icon)
3. Click **Database** (under Settings)
4. Scroll down to find the connection information

### Step 2: Look for One of These Sections
You might see:
- **"Connection Pooling"** section
- **"Connection string"** section  
- **"Database"** connection info tab
- Or a section showing connection strings with tabs like "URI", "Session mode", "Transaction mode"

### Step 3: Find "Session mode" Connection String
Look for text that says "Session mode" or port `6543`. It should look like:
```
postgresql://postgres.uzbupbtrmbmmmkztmrtl:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### Step 4: Parse the Connection String
From that connection string, extract:
- **Host**: The part after `@` and before `:6543`
  - Example: `aws-0-us-east-1.pooler.supabase.com`
- **Port**: `6543` (for Session mode)
- **Database**: `postgres`
- **Username**: The part after `postgresql://` and before `:`
  - Example: `postgres.uzbupbtrmbmmmkztmrtl`
- **Password**: Your database password

### Step 5: Use These Exact Values in DBeaver
1. Edit your connection in DBeaver
2. **Main tab:**
   - Host: (exact hostname from connection string)
   - Port: `6543`
   - Database: `postgres`
   - Username: (exact username from connection string)
   - Password: (your database password)

3. **SSL tab:**
   - ✅ Use SSL: Checked
   - SSL Mode: `require`

### Alternative: If You Can't Find Connection Pooling Section
Try these direct URLs:
1. Settings → Database → Connection Pooling
2. Settings → Database → Connection info
3. Or check Settings → API for connection details

## Quick Test: Try Different Regions
If you can't find the connection string, try these regions one by one:

**US East (most common):**
- Host: `aws-0-us-east-1.pooler.supabase.com`
- Port: `6543`

**US West:**
- Host: `aws-0-us-west-1.pooler.supabase.com`
- Port: `6543`

**EU West:**
- Host: `aws-0-eu-west-1.pooler.supabase.com`
- Port: `6543`

## Still Not Working?
If none of these work, please:
1. Check your Supabase dashboard → Settings → General
2. Find your project's **Region**
3. Use that region in the pooler hostname: `aws-0-[YOUR-REGION].pooler.supabase.com`




