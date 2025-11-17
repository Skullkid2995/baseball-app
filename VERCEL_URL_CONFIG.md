# Quick Reference: Vercel URL Configuration

**Your Vercel Domain:** `baseball-app-swart.vercel.app`

## URLs to Configure

### 1. Supabase URL Configuration

Go to: https://supabase.com/dashboard → Your Project → **Authentication** → **URL Configuration**

**Site URL:**
```
https://baseball-app-swart.vercel.app
```

**Redirect URLs (add these):**
```
https://baseball-app-swart.vercel.app/auth/callback
https://baseball-app-swart.vercel.app/*
```

### 2. Google OAuth Redirect URI

Go to: https://console.cloud.google.com/ → **APIs & Services** → **Credentials** → Your OAuth Client ID

**Authorized redirect URIs (add this):**
```
https://baseball-app-swart.vercel.app/auth/callback
```

**Also keep for local development:**
```
http://localhost:3000/auth/callback
https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback
```

## Quick Checklist

- [ ] Supabase Site URL updated to `https://baseball-app-swart.vercel.app`
- [ ] Supabase Redirect URL added: `https://baseball-app-swart.vercel.app/auth/callback`
- [ ] Google OAuth redirect URI added: `https://baseball-app-swart.vercel.app/auth/callback`
- [ ] All changes saved

## Test After Configuration

1. Visit: https://baseball-app-swart.vercel.app
2. Click "Sign in with Google"
3. Should redirect to Google, then back to Vercel (not localhost)

