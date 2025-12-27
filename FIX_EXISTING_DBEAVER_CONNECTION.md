# Fix Your Existing DBeaver Connection

## The Problem
Your connection is using `db.uzbupbtrmbmmmkztmrtl.supabase.co` which only supports IPv6, causing "Unknown host" errors.

## The Fix
Change the host to use the pooler (supports IPv4) instead.

## Steps to Fix Your Existing Connection

1. **Open DBeaver**

2. **Find your connection** in the Database Navigator (left sidebar)
   - Look for your Supabase/PostgreSQL connection

3. **Right-click on the connection** → Select **"Edit Connection"** (or **"Properties"**)

4. **In the "Main" tab, update these fields:**
   
   **Change Host from:**
   ```
   db.uzbupbtrmbmmmkztmrtl.supabase.co
   ```
   
   **To:**
   ```
   aws-0-us-east-1.pooler.supabase.com
   ```
   
   **Change Port to:**
   ```
   6543
   ```
   
   **Keep these the same:**
   - Database: `postgres`
   - Username: `postgres.uzbupbtrmbmmmkztmrtl`
   - Password: (your existing password)

5. **Click "Test Connection"** to verify it works

6. **Click "OK"** to save

## If That Doesn't Work

If `aws-0-us-east-1` doesn't work, try these other regions (change only the Host):

- `aws-0-us-west-1.pooler.supabase.com` (US West)
- `aws-0-eu-west-1.pooler.supabase.com` (EU West)

## Why This Works

- **Old host** (`db.uzbupbtrmbmmmkztmrtl.supabase.co`): IPv6 only → doesn't work on your network
- **New host** (`aws-0-us-east-1.pooler.supabase.com`): IPv4 support → works on your network

The pooler hostname resolves to IPv4 addresses that your network can reach, fixing the "Unknown host" error.




