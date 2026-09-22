# Two-manager scorecard — first playable slice

The batting manager writes a play in the existing `ScorecardBox`. They confirm
its interpretation and submit it. The defending manager sees the original ink
and proposed score, outs, inning and runners, then accepts it or requests a
correction. Only acceptance changes confirmed game state and statistics.

## Setup

1. Use a test Supabase project with the current schema and migrations through
   `2026-09-12_users_roles.sql`, `2026-09-12_leagues_scope.sql`, and
   `2026-09-12_games_between_league_teams.sql` applied.
2. Apply `database/migrations/2026-09-22_manager_faceoff.sql`. It creates an
   isolated room table and removes the old permissive `authenticated full
   access` policy on `app_users`, preserving the super-admin write policies.
3. Set `SUPABASE_SERVICE_ROLE_KEY` in the **server environment** alongside the
   existing public Supabase URL and publishable/anon key. Never put the service
   key in a `NEXT_PUBLIC_` variable, source control, or browser code.
4. Assign active coaches to each team's `app_users.team_id` in Settings. The
   two teams need complete saved lineups and starting pitchers. For a DH, set
   `batting_for` to the starting pitcher.
5. Prepare a new game linking both teams and lineups, and select batting first.
   Open its scorebook and choose **Open two-manager scorecard**. The direct URL
   is `/live/<game-id>/faceoff`. A super admin starts the room. Games with existing
   legacy at-bats cannot be imported into this first slice.
6. Each manager opens that same URL with their own account. An observer admin
   can inspect the room without being assigned to a team.

Database setup is a separate step from deploying the application.

## Super-admin testing from one account

Select a team in **Super-admin testing**. Choose the team currently batting,
write and confirm a play, and submit. Switch the selector to the other team to
accept or request correction. An accepted record is labeled `TEST` and retains
its real author/reviewer IDs. Turning the selector off restores the account's
normal team assignment. Ordinary coaches cannot enable this by forging the
request field; the server rechecks the authenticated admin role.

## Persistence and synchronization

- A room snapshots its two teams, lineups and initial rules. This version uses
  the rules engine's defaults; it does not load league-specific rule sets.
- Original strokes and taps are stored per submitted play, including rejected
  versions. Multiple plate appearances in the same inning remain separate.
- The server applies the existing pure rules engine. It never accepts a
  client-supplied score or approval identity.
- One proposal may be pending. Accept and correction requests use a versioned,
  atomic compare-and-swap update of the entire room row. A stale client gets a
  409 and must review the updated state. Duplicate submission IDs are rejected.
- Both devices refetch every two seconds while visible and on focus/reconnect.
  This is polling, not a Supabase Realtime subscription. Network errors disable
  submissions. Draft ink is retained in this tab's session storage; there is no
  offline write queue. A stale draft must be explicitly reviewed before reuse.
- New room data is inaccessible to browser database clients. The authenticated
  server API authorizes active coaches by the room's snapshotted team IDs.
- The room's confirmed batting statistics are displayed below its scorecards.
  Legacy `at_bats`, season dashboards and the old game's score remain separate.

## Current limits / next integration work

This is a reviewable first slice, not a production league rollout. It supports
standard plate results and engine-default runner advancement. Ink is preserved
as the visual record; drawn runner paths do not override the engine. The UI
shows the proposed runners so both managers can review them. Independent runner
plays, custom advancement, substitutions/pitching changes, corrections to
already accepted plays, lineup readiness from both managers, league-specific
rules and export into season statistics remain to be integrated. Don't use this
slice as the official scorebook for a game requiring those features.

The existing repository's legacy tables still have broad authenticated policies.
This change secures the new room and the role assignments it trusts, but is not
a complete security review of the existing app. Do not rerun the legacy blanket
RLS setup script over the new schema.

## Verification

- `npm test`: rules engine, ink interpretation, workflow and API authorization.
- `npx tsc --noEmit`: TypeScript.
- Targeted ESLint on the new files.
- Deployment gate: apply the migration in a test project, configure the server
  key, and exercise both real manager accounts plus the super-admin switcher on
  two devices. Verify concurrent acceptance, disconnect/reconnect and correction.

The dependency lock was repaired because the original picomatch layout prevented
`npm ci` from installing the existing dependency declarations.

Browser checks cover the unified local scorecard at phone widths, including
out persistence and retention of an entered play after a simulated save failure.
Physical tablet/stylus behavior and simultaneous play on two real manager
devices still need field testing.
