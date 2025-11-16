# Deploy Baseball App to Vercel

This guide will help you deploy the Baseball Management System to Vercel.

## Prerequisites

- ✅ Your code is committed to Git
- ✅ You have a Vercel account (free tier works)
- ✅ Google OAuth is configured in Supabase (from previous steps)

## Option 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push to GitHub (if not already done)

1. Make sure all your changes are committed:
   ```bash
   git status
   git add .
   git commit -m "Prepare for Vercel deployment"
   ```

2. Push to GitHub:
   ```bash
   git push origin main
   ```

### Step 2: Import Project to Vercel

1. Go to: https://vercel.com/new
2. Sign in with GitHub (if not already signed in)
3. Click **Import Project**
4. Select your repository: `Skullkid2995/baseball-app` (or your repo name)
5. Click **Import**

### Step 3: Configure Project

1. **Project Name**: `baseball-app` (or your preferred name)
2. **Framework Preset**: Vercel will auto-detect "Next.js"
3. **Root Directory**: `./` (leave as default)
4. **Build Command**: `npm run build` (leave as default)
   - Note: Vercel will automatically handle Next.js builds, even with Turbopack
5. **Output Directory**: `.next` (leave as default)
6. **Install Command**: `npm install` (leave as default)

### Step 4: Add Environment Variables

**Important**: Click **Environment Variables** and add these:

```
NEXT_PUBLIC_SUPABASE_URL=https://uzbupbtrmbmmmkztmrtl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6YnVwYnRybWJtbW1renRtcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNjUyMjAsImV4cCI6MjA2NjY0MTIyMH0.rCR1cmQ4itYa7S0PVY9PKdOuO57jJ4PAJO-7w53L50Y
```

**How to add:**
1. Click **Environment Variables** section
2. For each variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://uzbupbtrmbmmmkztmrtl.supabase.co`
   - **Environment**: Select **Production**, **Preview**, and **Development**
3. Click **Add**
4. Repeat for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 5: Deploy

1. Click **Deploy**
2. Wait for the build to complete (usually 2-5 minutes)
3. Once deployed, you'll see a success message with your URL

### Step 6: Update Google OAuth Redirect URI

After deployment, you need to add your Vercel URL to Google OAuth:

1. Copy your Vercel deployment URL (e.g., `https://baseball-app.vercel.app`)
2. Go to [Google Cloud Console](https://console.cloud.google.com/)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one you created earlier)
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, add:
   ```
   https://your-app-name.vercel.app/auth/callback
   ```
   (Replace `your-app-name` with your actual Vercel app name)
7. Click **Save**

## Option 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (first time)
- Project name? `baseball-app`
- Directory? `./`
- Override settings? **N**

### Step 4: Add Environment Variables

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

For each command, enter the value when prompted:
- `NEXT_PUBLIC_SUPABASE_URL`: `https://uzbupbtrmbmmmkztmrtl.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon key

### Step 5: Deploy to Production

```bash
vercel --prod
```

## Post-Deployment Steps

### 1. Update Supabase Auth Settings

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **URL Configuration**
3. Add your Vercel URL to **Site URL**:
   ```
   https://your-app-name.vercel.app
   ```
4. Add to **Redirect URLs**:
   ```
   https://your-app-name.vercel.app/auth/callback
   ```

### 2. Test Your Deployment

1. Visit your Vercel URL: `https://your-app-name.vercel.app`
2. You should be redirected to `/login`
3. Try signing in with Google using `jesus.contreras@group-u.com`
4. You should be redirected back and logged in

## Troubleshooting

### Build Fails

- **Error about Turbopack**: Vercel should handle this automatically. If issues persist, you can remove `--turbopack` from `package.json` build script temporarily.
- **Missing environment variables**: Make sure all environment variables are set in Vercel dashboard
- **Type errors**: Run `npm run build` locally first to check for errors

### OAuth Not Working

- **Redirect URI mismatch**: Make sure your Vercel URL is added to:
  - Google Cloud Console (OAuth Client redirect URIs)
  - Supabase (Authentication → URL Configuration)
- **CORS errors**: Check that your Supabase project allows your Vercel domain

### Session Not Persisting

- Check that cookies are working (should be automatic with Supabase SSR)
- Verify middleware is working correctly in production

## Automatic Deployments

Once set up, Vercel will automatically deploy:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches or pull requests

## Useful Commands

- View deployments: `vercel ls`
- View logs: `vercel logs`
- Open deployment: `vercel open`

## Next Steps

After successful deployment:
1. ✅ Share your Vercel URL with authorized users
2. ✅ Monitor deployments in Vercel dashboard
3. ✅ Set up custom domain (optional) in Vercel project settings

