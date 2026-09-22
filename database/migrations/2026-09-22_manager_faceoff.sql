-- Requires users_roles and leagues_scope migrations. Apply to a test project first.
-- Faceoff is an isolated scoring mode; it does not modify legacy at_bats.
create table if not exists public.faceoff_rooms (
  game_id uuid primary key references public.games(id) on delete restrict,
  version integer not null default 0 check (version >= 0),
  home_team_id uuid not null references public.teams(id),
  opponent_team_id uuid not null references public.teams(id),
  names jsonb not null,
  state jsonb not null,
  pending jsonb,
  history jsonb not null default '[]',
  check (home_team_id <> opponent_team_id)
);
alter table public.faceoff_rooms enable row level security;
-- All reads/writes go through the authenticated Next.js endpoint, using the
-- server-only service key. Browser clients cannot forge approval or game state.
revoke all on public.faceoff_rooms from anon, authenticated;
grant select, insert, update on public.faceoff_rooms to service_role;

-- Legacy setup can leave this permissive policy on app_users. Remove it so
-- managers cannot give themselves another team's identity or an admin role.
drop policy if exists "authenticated full access" on public.app_users;
-- Existing users_roles policies permit writes only to super admins.
