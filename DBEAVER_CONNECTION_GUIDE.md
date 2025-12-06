# DBeaver Connection Guide for Supabase

This guide will help you connect DBeaver to your Supabase PostgreSQL database.

## Prerequisites

- DBeaver installed on your computer
- Access to your Supabase project dashboard
- Your Supabase project URL: `https://uzbupbtrmbmmmkztmrtl.supabase.co`

## Step 1: Get Database Connection Details from Supabase

1. **Log into Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project (the one with URL: `uzbupbtrmbmmmkztmrtl.supabase.co`)

2. **Navigate to Database Settings**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **Database** in the settings menu

3. **Find Connection Details**
   - Look for the **Connection string** section
   - You'll see connection parameters like:
     - **Host**: `db.uzbupbtrmbmmmkztmrtl.supabase.co` (or similar)
     - **Port**: `5432` (default PostgreSQL port)
     - **Database name**: `postgres` (usually)
     - **User**: `postgres` (or your database user)
     - **Password**: Your database password (see "How to Find Your Password" below)

### 🔑 How to Find Your Database Password

**Option 1: View Password in Dashboard (If Project is New)**
- When you first create a Supabase project, the database password is shown **once** during project creation
- If you saved it, use that password

**Option 2: Reset/View Password in Settings**
1. In **Settings → Database**, scroll down to find the **Database password** section
2. You'll see a field showing your password (it may be hidden with dots)
3. Click the **eye icon** 👁️ or **"Show"** button to reveal it
4. If you can't see it, click **"Reset database password"** to set a new one
   - ⚠️ **Warning**: Resetting the password will disconnect all existing connections
   - Make sure to save the new password immediately!

**Option 3: Connection String Method**
- In the **Connection string** section, you'll see a connection string like:
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.uzbupbtrmbmmmkztmrtl.supabase.co:5432/postgres
  ```
- The password is shown in the connection string (between `postgres:` and `@`)
- You can copy the entire connection string and extract the password from it

4. **Alternative: Connection Pooling**
   - Supabase also provides connection pooling
   - Look for **Connection pooling** section
   - Use port `6543` for connection pooling (recommended for external tools)
   - Use port `5432` for direct connection

## Step 2: Create New Connection in DBeaver

1. **Open DBeaver**
   - Launch DBeaver application

2. **Create New Database Connection**
   - Click on **New Database Connection** button (plug icon) in the toolbar
   - Or go to: **Database** → **New Database Connection**

3. **Select PostgreSQL**
   - In the connection wizard, search for **PostgreSQL**
   - Select **PostgreSQL** from the list
   - Click **Next**

## Step 3: Configure Connection Settings

Fill in the connection details:

### Main Tab:
- **Host**: `db.uzbupbtrmbmmmkztmrtl.supabase.co` (from Supabase dashboard)
- **Port**: 
  - `6543` (for connection pooling - recommended)
  - OR `5432` (for direct connection)
- **Database**: `postgres` (usually, check your Supabase dashboard)
- **Username**: `postgres` (or your database user from dashboard)
- **Password**: Your database password (enter it here)

### SSL Tab (Important for Supabase):
1. Click on the **SSL** tab
2. Enable **Use SSL**
3. Set **SSL Mode**: `require` or `verify-full`
4. You may need to download the SSL certificate from Supabase if using `verify-full`

### Connection Pooling Tab (Optional):
- If using port `6543`, you can configure connection pooling settings
- Leave defaults unless you have specific requirements

## Step 4: Test Connection

1. Click **Test Connection** button
2. If this is your first time connecting to PostgreSQL, DBeaver may prompt you to download the PostgreSQL driver
   - Click **Download** and wait for it to complete
3. If successful, you'll see "Connected" message
4. If it fails, check:
   - Your password is correct
   - Your IP address is allowed (check Supabase Dashboard → Settings → Database → Connection Pooling → Allowed IPs)
   - SSL settings are correct

## Step 5: Save and Connect

1. Click **Finish** to save the connection
2. The connection will appear in your Database Navigator
3. Expand it to see your database schema, tables, views, etc.

## Troubleshooting

### Connection Timeout
- **Problem**: Connection times out
- **Solution**: 
  - Check if your IP is whitelisted in Supabase
  - Go to Supabase Dashboard → Settings → Database → Connection Pooling
  - Add your IP address to allowed IPs, or use "0.0.0.0/0" for all IPs (less secure)

### SSL Certificate Error
- **Problem**: SSL certificate verification fails
- **Solution**:
  - Change SSL Mode to `require` instead of `verify-full`
  - Or download the SSL certificate from Supabase and configure it in DBeaver

### Authentication Failed
- **Problem**: Authentication fails
- **Solution**:
  - Double-check your username and password in Supabase Dashboard
  - Make sure you're using the **database password**, not the API keys (anon key or service role key)
  - The database password is different from your Supabase account password
  - Reset your database password in Supabase Dashboard → Settings → Database if needed
  - Make sure you're using the password from the **Database** settings, not from **API** settings

### Connection Pooling vs Direct Connection
- **Port 6543** (Connection Pooling): Better for applications, handles connection limits better
- **Port 5432** (Direct Connection): Direct database access, may hit connection limits faster

## Quick Reference: Connection String Format

If you prefer using a connection string, Supabase provides it in this format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.uzbupbtrmbmmmkztmrtl.supabase.co:5432/postgres
```

You can use this in DBeaver by:
1. Creating a new connection
2. Selecting "Connection by URL" option
3. Pasting the connection string

## Next Steps

Once connected, you can:
- Browse your database schema
- View and edit table data
- Run SQL queries
- Export/import data
- Manage database objects

## Security Notes

⚠️ **Important Security Considerations:**
- Never commit your database password to version control
- Use connection pooling (port 6543) when possible
- Restrict IP access in Supabase settings
- Use SSL connections (required by Supabase)
- Consider using environment variables for sensitive data

