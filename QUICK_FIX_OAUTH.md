# Quick Fix: OAuth Error 403 org_internal

## The Problem
Your Google OAuth app is set to "Internal" (organization-only), so personal Gmail accounts can't sign in.

## Step-by-Step Fix (5 minutes)

### Step 1: Open Google Cloud Console
1. Go to: **https://console.cloud.google.com/**
2. Make sure you're signed in with the account that has access to the OAuth project

### Step 2: Find Your Project
1. Look at the **project dropdown** at the top (next to "Google Cloud")
2. You need to find the project that has the OAuth credentials for your baseball app
3. If you see "n8n Ucallz" mentioned, that might be the project name - try selecting it
4. If you're not sure which project, try each project until you find the one with OAuth credentials

### Step 3: Open OAuth Consent Screen
1. In the left sidebar, click: **APIs & Services**
2. Click: **OAuth consent screen**
3. You should see your app configuration

### Step 4: Check Current Settings
Look at the top of the page. You'll see:
- **App name** (might say "n8n Ucallz" or something else)
- **User type** - This is the problem! It probably says "Internal"

### Step 5: Fix the User Type

**Option A: If you can edit it:**
1. Click the **"EDIT APP"** button (usually at the top)
2. Scroll down to find **"User Type"** section
3. Change from **"Internal"** to **"External"**
4. Click **"SAVE AND CONTINUE"**
5. You'll need to fill out some required fields:
   - App name: `Baseball App` (or any name)
   - User support email: Select your email
   - Developer contact: Your email
6. Continue through the steps, adding test users:
   - Click **"+ ADD USERS"**
   - Add: `skullkid2995@gmail.com`
   - Add: `jesus.contreras@group-u.com`
   - Click **ADD**
7. Save everything

**Option B: If you CAN'T change it (User Type is locked):**
This means the project is tied to a Google Workspace organization. You need to create NEW OAuth credentials:

1. **Create a new Google Cloud Project**:
   - Click the project dropdown → **NEW PROJECT**
   - Name: `Baseball App OAuth`
   - Click **CREATE**
   - Select the new project

2. **Create new OAuth credentials**:
   - Go to: **APIs & Services** → **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - First, configure OAuth consent screen:
     - Choose **External**
     - App name: `Baseball App`
     - User support email: Your email
     - Developer contact: Your email
     - Save and continue through steps
     - Add test users: `skullkid2995@gmail.com` and `jesus.contreras@group-u.com`
   
   - Then create OAuth client ID:
     - Type: **Web application**
     - Name: `Baseball App`
     - Authorized redirect URIs:
       - `https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback`
       - `http://localhost:3000/auth/callback`
     - Click **CREATE**
     - **COPY** the Client ID and Client Secret

3. **Update Supabase**:
   - Go to: **https://supabase.com/dashboard**
   - Select your project
   - Go to: **Authentication** → **Providers** → **Google**
   - Paste the NEW Client ID
   - Paste the NEW Client Secret
   - Click **SAVE**

### Step 6: Wait and Test
- Wait 2-5 minutes for changes to take effect
- Go to: http://localhost:3000/login
- Try signing in with Google again

## Still Having Issues?

### Can't find the OAuth project?
1. Check which project has OAuth credentials in Supabase
2. In Supabase Dashboard → Authentication → Providers → Google
3. Look at the Client ID (it starts with numbers)
4. The Client ID format is: `123456789-xxxxx.apps.googleusercontent.com`
5. The project number is the first part (123456789)
6. In Google Cloud Console, look for a project with that number

### The app says "n8n Ucallz"?
This suggests the OAuth app was created for a different project. You have two options:
1. Change the app name to "Baseball App" in the OAuth consent screen
2. Create entirely new OAuth credentials for your baseball app

### Need to verify current OAuth credentials?
The credentials are stored in Supabase, not in your code. To see them:
1. Go to Supabase Dashboard
2. Authentication → Providers → Google
3. You'll see the Client ID there (but not the secret)

## Quick Checklist

- [ ] Opened Google Cloud Console
- [ ] Found the correct project (the one with OAuth credentials)
- [ ] Went to OAuth consent screen
- [ ] Either:
  - [ ] Changed User Type from Internal to External, OR
  - [ ] Created new OAuth credentials in a new project
- [ ] Added test users: `skullkid2995@gmail.com` and `jesus.contreras@group-u.com`
- [ ] If created new credentials: Updated Supabase with new Client ID and Secret
- [ ] Waited 5 minutes
- [ ] Tested sign-in again

