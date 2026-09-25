# Baseball Scorebook

Web app for managing one amateur baseball team (the Dodgers), its roster and
lineups, and scoring games pitch by pitch against any opponent. Spanish-first
UI with an English toggle. Access is limited to two Google accounts.

## Stack

- Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS 4
- Supabase: Postgres, Google OAuth, Storage bucket `player-photos`
- Deployed on Vercel: https://baseball-app-swart.vercel.app

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in URL + anon/publishable key
npm run dev                  # http://localhost:3000
```

The env file must be UTF-8. On Windows do not create it with PowerShell `>`
redirection, which writes UTF-16 that Next.js cannot read.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/dashboard` | Season overview: record, team batting, next game, recent results, top hitters |
| `app/teams` | Roster management, player photos, lineup templates |
| `app/players` | Roster directory across all teams with search, filters and player detail |
| `app/games` | Create games, guided game preparation (home/away, both lineups, review), live scorebook, hit statistics |
| `app/statistics` | Season batting leaderboard and hit distribution |
| `app/lineups` | Saved lineup templates per team |
| `app/settings` | Preferences, our team, account/access, system references |
| `app/login`, `app/auth/callback` | Google OAuth flow |
| `middleware.ts` | Redirects anyone not in `lib/auth.ts` to `/login` |
| `components/` | Screens. `TraditionalScorebook.tsx` + `DiamondCanvas.tsx` are the scorebook; `LineupSelection.tsx` is the 4-step game preparation flow |
| `components/ui/` | Design-system primitives (Button, Card, Modal, FormField, ...) used by every screen |
| `lib/navigation.ts` | Sidebar sections; add a view here and it shows up in the menu |
| `docs/FRONTEND_GUIDE.md` | How to build a screen: primitives, layout patterns, data model, batting math |
| `lib/supabase-browser.ts` / `lib/supabase-server.ts` | Supabase clients (client / server) |
| `database/schema.sql` | Complete schema for a fresh Supabase project |
| `database/legacy/` | Historical migrations, already folded into `schema.sql` |
| `docs/` | Auth, Google credentials and Vercel setup guides |
| `docs/archive/` | Old troubleshooting notes, kept for reference only |

## Setting up a new Supabase project

Follow `RECONNECT_SUPABASE.md`. Short version: create the project, run
`database/schema.sql` in the SQL Editor, enable the Google provider, set the
redirect URLs, put the URL and key in `.env.local` and in Vercel.

## Data model

`teams` → `players` (roster) and `lineup_templates` → `lineup_template_players`
(one saved batting order per team). `games` records a single game against an
`opponent`, links our lineup and the opponent lineup, and owns the `at_bats`
rows written by the scorebook.

## Unified scorekeeping

The scorebook combines handwriting and touch controls in one responsive editor.
Ink stays visible while writing. Only play-code recognition waits for a
2.5-second pause; ball/strike marks, base paths and hit directions respond
immediately. Active runners are labeled beside their bases, with full names below.
Choose a labeled hit, out, or reach-base result; confirm each runner's destination
and RBI before saving. Batter outs and runner outs are tracked separately so a
double play counts twice without counting the batter twice. Failed saves keep the
editor open with an error. The scorebook also supports multiple plate appearances
in one inning and independent runner plays between pitches.

Confirmed results collapse the choices and bring runner decisions into view.
In-game pinch hitters, pinch runners, defensive replacements and position swaps
require `database/migrations/2026-09-23_scorecard_player_changes.sql`.

Labs and live scorecards share paginated training-sample loading and a 2.5-second
recognition pause. Valid symbols are filtered before ranking; notation, letters,
and batting results use their own relevant vocabulary. Open screens refresh
after local training saves, on focus, and every 30 seconds while visible.
Apply `database/migrations/2026-09-23_atomic_scorecard_training.sql` for atomic,
retry-safe scorecard-lab saves. Notation and out digits become recognition
templates; other gesture samples are diagnostic examples for the shared rules,
not automatic changes to baseball scoring or gesture interpretation.

Run `npm test` for scoring, rules-engine, workflow and authorization regressions.

## Two-manager scorecard (draft)

See [MANAGER_FACEOFF.md](docs/MANAGER_FACEOFF.md) for the handwritten submission,
opponent validation, and super-admin testing workflow and required Supabase setup.
