# Fix: OAuth Redirect Issue

## Problem
After Google authentication, you're being redirected to:
```
uzbupbtrmbmmmkztmrtl.supabase.co/baseball-app-swart.vercel.app
```

This means Supabase is appending your Vercel URL instead of redirecting to it.

## Solution: Update Supabase URL Configuration

### Step 1: Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard
2. Select your project: **uzbupbtrmbmmmkztmrtl**
3. Go to **Authentication** → **URL Configuration**

### Step 2: Update Site URL
**Site URL** should be:
```
https://baseball-app-swart.vercel.app
```

**IMPORTANT:** Make sure it starts with `https://` and is the FULL URL, not just the domain.

### Step 3: Update Redirect URLs
Under **Redirect URLs**, you should have:
```
https://baseball-app-swart.vercel.app/auth/callback
```

**Make sure:**
- It starts with `https://`
- It's the complete URL (not just the domain)
- No trailing slash
- Click **Save**

### Step 4: Clear Browser Cache
After updating Supabase:
1. Clear your browser cache or use incognito mode
2. Try logging in again

## How OAuth Flow Should Work

1. User clicks "Sign in with Google" on: `https://baseball-app-swart.vercel.app`
2. Redirects to Google
3. Google redirects to: `https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback` (Supabase)
4. Supabase processes OAuth
5. Supabase redirects to: `https://baseball-app-swart.vercel.app/auth/callback` (Your app)
6. Your app handles the session

## Common Mistakes

❌ **Wrong:** `baseball-app-swart.vercel.app` (missing https://)
❌ **Wrong:** `https://baseball-app-swart.vercel.app/` (trailing slash)
✅ **Correct:** `https://baseball-app-swart.vercel.app`

❌ **Wrong:** `https://baseball-app-swart.vercel.app/auth/callback/` (trailing slash)
✅ **Correct:** `https://baseball-app-swart.vercel.app/auth/callback`

## Google OAuth Propagation Time

- **Usually:** Instant to 1 minute
- **Rarely:** Up to 5 minutes
- **Worst case:** A few hours (very rare)

Most changes take effect immediately. The "5 minutes to hours" is Google's conservative estimate.

