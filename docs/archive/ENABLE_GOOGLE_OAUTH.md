# Quick Guide: Enable Google OAuth in Supabase

## Step 1: Enable Google Provider in Supabase

1. Go to: https://supabase.com/dashboard
2. Select your project: **uzbupbtrmbmmmkztmrtl** (or your project name)
3. Click **Authentication** in the left sidebar
4. Click **Providers**
5. Scroll down to find **Google**
6. Click the toggle to **Enable** it

## Step 2: Get Google OAuth Credentials

### Option A: If you already have Google Cloud credentials
- Skip to Step 3

### Option B: Create new Google OAuth credentials

1. Go to: https://console.cloud.google.com/
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure OAuth consent screen:
   - Choose **External** (for testing)
   - Fill in required fields (App name, User support email, Developer contact)
   - Add your email as a test user
   - Save and Continue
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Baseball App` (or any name)
   - **Authorized redirect URIs**: Add this EXACT URL:
     ```
     https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback
     ```
   - For local development, also add:
     ```
     http://localhost:3000/auth/callback
     ```
7. Click **CREATE**
8. Copy the **Client ID** and **Client Secret**

## Step 3: Configure in Supabase

1. Back in Supabase → **Authentication** → **Providers** → **Google**
2. Paste the **Client ID** from Google Cloud Console
3. Paste the **Client Secret** from Google Cloud Console
4. The **Redirect URL** should automatically be:
   ```
   https://uzbupbtrmbmmmkztmrtl.supabase.co/auth/v1/callback
   ```
5. Click **Save**

## Step 4: Test

1. Refresh your application
2. Click "Sign in with Google"
3. You should be redirected to Google's login page
4. Sign in with an authorized email address (e.g., `jesus.contreras@group-u.com` or `skullkid2995@gmail.com`)
5. You'll be redirected back and logged in

## Troubleshooting

- **"provider is not enabled" error**: Make sure the Google toggle is ON in Supabase
- **Redirect URI mismatch**: Ensure the redirect URI in Google Cloud Console exactly matches Supabase's callback URL
- **401/403 errors**: Make sure your Google OAuth consent screen is configured and your email is added as a test user (if app is in testing mode)

## Important Notes

- Only authorized email addresses (currently `jesus.contreras@group-u.com` and `skullkid2995@gmail.com`) will be able to access the application after sign-in
- The redirect URI must match exactly between Google Cloud Console and Supabase
- It may take a few minutes for changes to propagate after saving

