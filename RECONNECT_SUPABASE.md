# Reconnecting Supabase (September 2026)

## What is wrong

The app points at Supabase project **`uzbupbtrmbmmmkztmrtl`**
(`https://uzbupbtrmbmmmkztmrtl.supabase.co`). As of 2026-09-11 that hostname
no longer resolves in DNS ("Non-existent domain"), while `supabase.com` and the
pooler hosts resolve fine. Supabase removes a project's DNS entry when the
project is **paused** (free-tier projects pause after about a week of
inactivity) or **deleted**. The last activity on this repo was 2026-01-12.

Nothing in the code can fix that. It has to be resolved in the Supabase
dashboard, then the app reconnects with the steps below.

Two smaller local problems were already fixed in this pass:

- `.env` and `.env.local` were saved as UTF-16 (PowerShell's default for `>`),
  which Next.js cannot parse. They are UTF-8 now. The originals are kept as
  `.env.bak-utf16` / `.env.local.bak-utf16` (git-ignored).
- One TypeScript error and 8 ESLint errors in `components/LineupSelection.tsx`.

## Step 1: check the project in the dashboard

Open <https://supabase.com/dashboard/projects> with the account that owns the
project (`jesus.contreras@group-u.com` or `skullkid2995@gmail.com`).

- **Project listed as "Paused"** → open it and click **Restore project**.
  Restores of long-paused free projects can take several minutes. Then go to
  Step 2 (existing project).
- **Project not listed at all** → it was deleted. Supabase keeps a downloadable
  backup for a while under *Organization → Backups* (or it may be gone). Go to
  Step 3 (new project).

## Step 2: reconnect to the EXISTING project (after restore)

1. Dashboard → Project Settings → **API Keys**. Copy the URL and the
   **anon** (`eyJ...`) or **publishable** (`sb_publishable_...`) key. Both work.
2. Put them in `.env.local` (keep the file UTF-8):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://uzbupbtrmbmmmkztmrtl.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
   ```

   If the key is unchanged, the current `.env.local` already has it.
3. Run the two January migrations that may never have been applied
   (they are idempotent, safe to re-run) in SQL Editor:
   `database/legacy/add_batting_first_column.sql` and
   `database/legacy/add_batting_for_to_lineup_templates.sql`.
4. `npm run dev` → <http://localhost:3000> → sign in with Google.

## Step 2b: two dashboard fixes found after the restore (2026-09-11)

1. **Exposed schema.** The Data API answered every query with
   `Could not find the table api.teams` - the API is serving schema `api`
   instead of `public`. Fix: Project Settings → Data API → **Exposed schemas**
   → make sure `public` is listed (first), remove `api` if it is not a real
   schema → Save. Takes effect within a minute.
2. **RLS was disabled on every table** (UNRESTRICTED badges). Run
   `database/enable_rls.sql` in the SQL Editor. It locks all tables to
   signed-in users and (re)creates the `player-photos` bucket policies.
3. **Missing columns.** Four columns the code expects were never migrated here
   (`games.team_id`, `lineup_template_players.batting_for`, `at_bats.team_side`,
   `teams.lineup`). The same `database/enable_rls.sql` adds them; all four were
   applied on 2026-09-11.

## Step 3: rebuild on a NEW project

1. Dashboard → **New project** (any name, pick a region near Mexico/US, save the
   DB password somewhere).
2. SQL Editor → paste the whole of `database/schema.sql` → Run.
   This creates all six tables, indexes, triggers, RLS policies and the
   `player-photos` storage bucket in one go.
3. Project Settings → API Keys → copy the **URL** and the **anon/publishable key**
   into `.env.local` (see Step 2, item 2, but with the new URL).
4. (Done already) The old hard-coded fallbacks in `lib/env.ts` and `middleware.ts`
   were removed; the app now fails fast if the env vars are missing.
5. Google login (see `AUTH_SETUP.md` for screenshots-level detail):
   - Supabase → Authentication → Providers → **Google** → enable, paste the
     existing Client ID / Client Secret from Google Cloud Console.
   - Google Cloud Console → Credentials → the OAuth client → add the new
     redirect URI `https://<NEW-REF>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → URL Configuration → Site URL
     `https://baseball-app-swart.vercel.app`, redirect URLs
     `https://baseball-app-swart.vercel.app/auth/callback` and
     `http://localhost:3000/auth/callback`.
6. `npm run dev` → sign in → create a team, add a player, create a game, open
   the scorebook. Old data is gone unless a backup was restored.
7. Vercel → Project → Settings → Environment Variables → update
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → redeploy.

## Quick connectivity test (no browser needed)

```bash
node -e "fetch(process.env.U+'/auth/v1/health',{headers:{apikey:process.env.K}}).then(r=>console.log(r.status)).catch(e=>console.log(e.cause?.code||e.message))"
```

Run with `U` and `K` set to the URL and key. `200` means the project is alive;
`ENOTFOUND` means it is still paused or deleted.

## Vercel deployment

`https://baseball-app-swart.vercel.app` is still deployed and responding (it
redirects to `/login`), but its build points at the same dead project, so login
fails there too. Once the project is restored or recreated:

1. Vercel → baseball-app → Settings → Environment Variables → set
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for
   Production (and Preview).
2. Deployments → Redeploy the latest one (env vars are baked in at build time).
3. Confirm Supabase → Authentication → URL Configuration still lists
   `https://baseball-app-swart.vercel.app/auth/callback`.

## Going paid (recommended before the season)

The root cause of this outage is the free tier's auto-pause. Supabase **Pro**
(about USD 25/month per organization) never pauses projects, adds daily
backups with 7-day retention, and raises storage/bandwidth limits. Upgrading
is Organization → Billing → Change plan; the project and its keys stay the
same, nothing in the app changes. Vercel's Hobby plan is fine for this app's
traffic; Vercel Pro only matters for team members or commercial use.
