# Complete Vercel Deployment Steps - From Scratch

## Step 1: Go to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Sign in with your GitHub account

## Step 2: Create New Project

1. Click **"Add New..."** button (top right)
2. Click **"Project"**
3. You'll see a list of your GitHub repositories

## Step 3: Import Your Repository

1. Find **`Skullkid2995/baseball-app`** in the list
2. Click **"Import"** next to it

## Step 4: Configure Project Settings

You'll see a configuration page. Set these:

- **Project Name**: `baseball-app` (or your preferred name)
- **Framework Preset**: Should auto-detect "Next.js" ✅
- **Root Directory**: `./` (leave as default)
- **Build Command**: `npm run build` (leave as default)
- **Output Directory**: `.next` (leave as default)
- **Install Command**: `npm install` (leave as default)

## Step 5: Add Environment Variables (CRITICAL - DO THIS BEFORE DEPLOYING)

1. Scroll down to **"Environment Variables"** section
2. Click **"Add"** or the **"Environment Variables"** button

### Add Variable 1:
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://uzbupbtrmbmmmkztmrtl.supabase.co`
- **Environments**: Check all three boxes:
  - ☑ Production
  - ☑ Preview  
  - ☑ Development
- Click **"Save"**

### Add Variable 2:
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y`
- **Environments**: Check all three boxes:
  - ☑ Production
  - ☑ Preview
  - ☑ Development
- Click **"Save"**

## Step 6: Deploy

1. Scroll to the bottom
2. Click **"Deploy"** button
3. Wait 2-5 minutes for the build to complete
4. You'll see a success message with your deployment URL

## Step 7: Get Your Deployment URL

After deployment completes, you'll see:
- **Production URL**: `https://baseball-app-xxxxx.vercel.app` (or similar)
- Copy this URL - you'll need it for the next steps

## Step 8: Update Google OAuth Redirect URI

**Your Vercel Domain:** `baseball-app-swart.vercel.app`

1. Go to: https://console.cloud.google.com/
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID (the one with Client ID ending in `.apps.googleusercontent.com`)
4. Click the **Edit** icon (pencil)
5. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
6. Add your Vercel URL:
   ```
   https://baseball-app-swart.vercel.app/auth/callback
   ```
7. Click **"SAVE"**

## Step 9: Update Supabase URL Configuration

**Your Vercel Domain:** `baseball-app-swart.vercel.app`

1. Go to: https://supabase.com/dashboard
2. Select your project: **uzbupbtrmbmmmkztmrtl**
3. Go to **Authentication** → **URL Configuration**
4. Update **Site URL**:
   ```
   https://baseball-app-swart.vercel.app
   ```
5. Under **Redirect URLs**, click **"Add URL"** and add:
   ```
   https://baseball-app-swart.vercel.app/auth/callback
   ```
6. Click **"Save"**

## Step 10: Test Your Deployment

1. Visit your Vercel URL: `https://your-vercel-app-name.vercel.app`
2. You should be redirected to `/login`
3. Click **"Sign in with Google"**
4. Sign in with `jesus.contreras@group-u.com`
5. You should be redirected back and logged in ✅

---

## Option 2: Replace Existing Vercel Project

If you want to replace your existing Vercel deployment:

1. Go to: https://vercel.com/dashboard
2. Find your existing project
3. Click on it to open project settings
4. Go to **Settings** → **General**
5. Scroll to **"Delete Project"** section
6. Delete the old project
7. Then follow **Option 1** steps above to create a new project

OR

1. Go to your existing project settings
2. Go to **Settings** → **Git**
3. Click **"Disconnect"** to disconnect the current repository
4. Click **"Connect Git Repository"**
5. Select **`Skullkid2995/baseball-app`**
6. Update environment variables (Step 5 above)
7. Redeploy

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Make sure environment variables are set correctly
- Verify all dependencies are in `package.json`

### OAuth Not Working
- Verify redirect URI is added in Google Cloud Console
- Check Supabase URL Configuration is updated
- Make sure Google OAuth is enabled in Supabase

### 404 Errors
- Check that routes are correct
- Verify middleware is working
- Check build logs for errors

