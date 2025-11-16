# Step-by-Step: How to Get Google OAuth Credentials

## Overview
You need to create OAuth credentials in Google Cloud Console to enable Google sign-in for your Supabase project.

## Detailed Steps

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account (use the account that has access to your Google Cloud projects)

### Step 2: Create or Select a Project
1. At the top of the page, click the **project dropdown** (it may show "Select a project" or an existing project name)
2. Either:
   - **Select an existing project** (if you have one)
   - **Create a new project**:
     - Click **NEW PROJECT**
     - Enter a name: `Baseball App` (or any name)
     - Click **CREATE**
     - Wait a few seconds, then select it from the dropdown

### Step 3: Configure OAuth Consent Screen (First Time Only)
1. In the left sidebar, click **APIs & Services** → **OAuth consent screen**
2. If you see a message asking to configure it:
   - Select **External** (unless you have a Google Workspace)
   - Click **CREATE**
   - Fill in the required fields:
     - **App name**: `Baseball Management System` (or any name)
     - **User support email**: Select your email from the dropdown
     - **Developer contact information**: Enter your email address
   - Click **SAVE AND CONTINUE**
   - **Scopes**: Click **SAVE AND CONTINUE** (default scopes are fine)
   - **Test users**: 
     - Click **+ ADD USERS**
     - Add: `jesus.contreras@group-u.com`
     - Click **ADD**
     - Click **SAVE AND CONTINUE**
   - Click **BACK TO DASHBOARD**

### Step 4: Create OAuth Client ID
1. In the left sidebar, click **APIs & Services** → **Credentials**
2. At the top, click **+ CREATE CREDENTIALS**
3. Select **OAuth client ID** from the dropdown
4. If prompted about the consent screen, click **CONFIGURE CONSENT SCREEN** and complete Step 3, then come back here

5. **Application type**: Select **Web application**
6. **Name**: Enter `Baseball App` (or any name)
7. **Authorized redirect URIs**: 
   - Click **+ ADD URI**
   - Enter this EXACT URL (replace with your Supabase project reference if different):
     ```
     https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback
     ```
   - For local development, click **+ ADD URI** again and add:
     ```
     http://localhost:3000/auth/callback
     ```
8. Click **CREATE**

### Step 5: Copy Your Credentials
1. A popup will appear showing your credentials:
   - **Your Client ID**: This is a long string like `123456789-abcdefghijklmnop.apps.googleusercontent.com`
   - **Your Client Secret**: This is a shorter string like `GOCSPX-abcdefghijklmnopqrstuvwxyz`
2. **Copy both values** (you can click the copy icon next to each)
3. **Important**: Save these somewhere safe - you'll need them in Supabase
4. Click **OK**

## What to Do Next

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers** → **Google**
4. Enable Google (toggle it ON)
5. Paste your **Client ID** from Google Cloud Console
6. Paste your **Client Secret** from Google Cloud Console
7. Click **Save**

## Visual Guide

### In Google Cloud Console:
```
APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
```

### In Supabase:
```
Authentication → Providers → Google → Enable → Paste credentials → Save
```

## Troubleshooting

- **Can't find "Credentials"**: Make sure you're in **APIs & Services** in the left sidebar
- **"OAuth client ID" is grayed out**: Complete the OAuth consent screen first (Step 3)
- **Error about redirect URI**: Make sure you copied the redirect URI exactly as shown above
- **Lost your Client Secret**: You can't recover it, but you can create a new OAuth client ID

## Security Note

- Keep your Client Secret private
- Don't commit it to git (it should only be in Supabase Dashboard)
- The Client ID can be public (it's visible in your app)

