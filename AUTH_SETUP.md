# Authentication Setup Guide

This application uses Google OAuth for authentication and only allows access to **jesus.contreras@group-u.com**.

## Supabase Configuration

### 1. Enable Google OAuth Provider

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click to enable it

### 2. Configure Google OAuth Credentials

You'll need to create a Google OAuth app:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the OAuth consent screen if prompted
6. Choose **Web application** as the application type
7. Add the following **Authorized redirect URIs**:
   - `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
   - For local development: `http://localhost:3000/auth/callback`

8. Copy the **Client ID** and **Client Secret**
9. Go back to Supabase → **Authentication** → **Providers** → **Google**
10. Paste the **Client ID** and **Client Secret**
11. The **Redirect URL** should be: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`
12. Click **Save**

### 3. Update Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```

### 4. Email Allowlist (Optional but Recommended)

1. In Supabase Dashboard, go to **Authentication** → **Policies**
2. You can restrict email signups by enabling email allowlist
3. Add `jesus.contreras@group-u.com` to the allowlist

## Security Features

- **Email Restriction**: Only `jesus.contreras@group-u.com` can access the application
- **Middleware Protection**: All routes are protected except `/login` and `/auth/callback`
- **Auto Sign-out**: If a user with a different email tries to access, they are automatically signed out
- **Session Management**: Sessions are managed securely through Supabase Auth

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to `/login`
4. Click "Sign in with Google"
5. Sign in with `jesus.contreras@group-u.com`
6. You should be redirected back to the main application

## Troubleshooting

- **"Access denied" error**: Make sure you're signing in with `jesus.contreras@group-u.com`
- **OAuth callback fails**: Verify the redirect URI in Google Cloud Console matches Supabase's callback URL
- **Session not persisting**: Check that cookies are enabled in your browser

