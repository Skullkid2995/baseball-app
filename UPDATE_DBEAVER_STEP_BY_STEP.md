# Step-by-Step: Update Your DBeaver Connection

## The Error Shows the Old Hostname
Your error still says `db.uzbupbtrmbmmmkztmrtl.supabase.co` - this means the connection settings haven't been changed yet.

## Detailed Steps to Fix

### Step 1: Open Connection Settings
1. In DBeaver, look at the **Database Navigator** panel (left side)
2. Find your PostgreSQL/Supabase connection (it might be collapsed under "Databases" → "PostgreSQL")
3. **Right-click** on the connection name
4. Select **"Edit Connection"** from the menu

### Step 2: Change the Hostname
1. You should see a dialog box with tabs at the top: "Main", "Network", "SSH", etc.
2. Make sure you're on the **"Main"** tab
3. Find the **"Host"** field (usually near the top)
4. **Delete** the current value: `db.uzbupbtrmbmmmkztmrtl.supabase.co`
5. **Type or paste** this new value: `aws-0-us-east-1.pooler.supabase.com`

### Step 3: Change the Port
1. Find the **"Port"** field (usually right below Host)
2. Change it to: `6543`

### Step 4: Verify Other Settings
Make sure these are correct:
- **Database**: `postgres`
- **Username**: `postgres.uzbupbtrmbmmmkztmrtl`
- **Password**: (your database password - click "Test Connection" if you need to verify)

### Step 5: Save and Test
1. Click the **"Test Connection"** button at the bottom
2. If it asks for a password, enter your database password
3. Wait for the test to complete
4. If it says "Success", click **"OK"** to save
5. If it still fails, share the exact error message

## Visual Guide
Your connection dialog should look like this:

```
Main Tab:
─────────────────────────────────
Host:      [aws-0-us-east-1.pooler.supabase.com]
Port:      [6543]
Database:  [postgres]
Username:  [postgres.uzbupbtrmbmmmkztmrtl]
Password:  [********]
─────────────────────────────────
```

## If You Can't Find "Edit Connection"

Alternative ways to access:
1. **Double-click** the connection name in Database Navigator
2. Or right-click → **"Properties"**
3. Or right-click → **"Connection"** → **"Edit"**

## Still Having Issues?

If you're still seeing the old hostname in the error:
1. Make sure you clicked **"OK"** after making changes
2. Make sure you're editing the correct connection (check the connection name)
3. Try disconnecting first: Right-click → **"Disconnect"**, then edit




