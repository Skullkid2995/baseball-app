# Fix: Error 403: org_internal - OAuth Access Restricted

## Problem

You're seeing this error when trying to sign in:
```
Error 403: org_internal
n8n Ucallz is restricted to users within its organization. 
If you think you should have access, you can contact the developer.
```

This means the Google OAuth app is configured as **Internal** (organization-only), which only allows users from a Google Workspace organization to sign in. Personal Gmail accounts (like `skullkid2995@gmail.com`) cannot access it.

## Solution

You need to change the OAuth consent screen from **Internal** to **External** in Google Cloud Console.

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Make sure you're signed in with the account that created the OAuth credentials
3. Select the **correct project** (the one where you created the OAuth credentials for this baseball app)

### Step 2: Navigate to OAuth Consent Screen

1. In the left sidebar, click **APIs & Services**
2. Click **OAuth consent screen**

### Step 3: Change User Type to External

1. At the top of the page, you'll see the current user type (likely showing "Internal")
2. Look for a **"PUBLISH APP"** button or **"EDIT APP"** button at the top
3. Click **"EDIT APP"** (or navigate to edit mode)
4. Look for the **"User Type"** section
5. **If it shows "Internal"**, you need to change it:
   - Note: If this is a Google Workspace project, you might not be able to change this directly
   - You may need to use a different Google Cloud project or create a new one

### Step 4: Configure as External App

If you can edit the user type:

1. Change **User Type** from **Internal** to **External**
2. Click **SAVE AND CONTINUE**
3. You'll be asked to configure additional settings:
   - **App name**: `Baseball App` (or your app name)
   - **User support email**: Select your email
   - **Developer contact information**: Enter your email
   - Click **SAVE AND CONTINUE**
4. **Scopes**: Click **SAVE AND CONTINUE** (default scopes are fine)
5. **Test users**: 
   - Click **+ ADD USERS**
   - Add: `skullkid2995@gmail.com`
   - Add: `jesus.contreras@group-u.com` (if needed)
   - Click **ADD**
   - Click **SAVE AND CONTINUE**
6. Review and go back to dashboard

### Step 5: Add Test Users (If App is in Testing Mode)

If your app is in **Testing** mode (which it should be for external apps initially):

1. In the **OAuth consent screen**, scroll to **Test users** section
2. Click **+ ADD USERS**
3. Add these emails:
   - `skullkid2995@gmail.com`
   - `jesus.contreras@group-u.com`
4. Click **ADD**
5. Click **SAVE**

### Alternative: Create New OAuth App (If Current One Can't Be Changed)

If the current OAuth app is tied to a Google Workspace organization and can't be changed:

1. **Create a new Google Cloud Project** (if needed):
   - Go to project dropdown at top
   - Click **NEW PROJECT**
   - Name it: `Baseball App OAuth`
   - Click **CREATE**

2. **Create new OAuth credentials** following the guide in `GET_GOOGLE_CREDENTIALS.md`

3. **Configure as External** from the start:
   - Choose **External** user type
   - Add test users: `skullkid2995@gmail.com` and `jesus.contreras@group-u.com`

4. **Update Supabase**:
   - Go to Supabase Dashboard → Authentication → Providers → Google
   - Update the **Client ID** and **Client Secret** with the new credentials
   - Click **Save**

### Step 6: Wait for Changes to Propagate

- OAuth consent screen changes can take a few minutes to propagate
- Test the sign-in again after 2-5 minutes

## Verification

After making changes:

1. Try signing in again at: http://localhost:3000/login
2. Click "Sign in with Google"
3. You should now be able to sign in with `skullkid2995@gmail.com`

## Troubleshooting

### If "Internal" can't be changed:

- The project might be tied to a Google Workspace organization
- **Solution**: Create a new Google Cloud project that's not tied to a workspace
- Or use a personal Google account to create the project

### If you see "App verification required":

- For external apps, Google may require verification if you're requesting sensitive scopes
- For basic profile/email scopes, this usually isn't required
- The app can stay in "Testing" mode with test users added

### If test users still can't sign in:

1. Verify the email is exactly correct (no typos)
2. Make sure you clicked **SAVE** after adding test users
3. Wait 5-10 minutes for changes to propagate
4. Try signing in again

## Important Notes

- **External apps** can have test users (for testing mode) or be published for anyone
- **Internal apps** only work for users in the same Google Workspace organization
- Personal Gmail accounts require an **External** app configuration
- Make sure both email addresses (`skullkid2995@gmail.com` and `jesus.contreras@group-u.com`) are added as test users

## Quick Checklist

- [ ] Opened Google Cloud Console
- [ ] Selected the correct project
- [ ] Went to APIs & Services → OAuth consent screen
- [ ] Changed User Type to "External" (or created new project)
- [ ] Added test users: `skullkid2995@gmail.com` and `jesus.contreras@group-u.com`
- [ ] Saved all changes
- [ ] Waited 5 minutes for changes to propagate
- [ ] Tried signing in again



