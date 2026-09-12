-- =============================================================================
-- Games between two league teams + finer game permissions
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
--
-- games.opponent_team_id  the visiting team as a real team (games.opponent keeps the name)
-- games.league_id         the league the game belongs to (from the home team)
-- role_permissions        the board creates games (gamesCreate); coaches prepare lineups
--                         (gamesLineups) but do not create games. Rows are only added when
--                         missing, so choices already made in Settings are kept.
-- =============================================================================

alter table public.games add column if not exists opponent_team_id uuid references public.teams(id) on delete set null;
alter table public.games add column if not exists league_id        uuid references public.leagues(id) on delete set null;
create index if not exists idx_games_opponent_team on public.games(opponent_team_id);
create index if not exists idx_games_league on public.games(league_id);

-- Link existing games to their opponent team by name, and to the league of their team
update public.games g set opponent_team_id = t.id
  from public.teams t
 where g.opponent_team_id is null and lower(t.name) = lower(g.opponent);
update public.games g set league_id = t.league_id
  from public.teams t
 where g.league_id is null and g.team_id = t.id and t.league_id is not null;

-- Defaults by hierarchy (only where nothing was set yet)
insert into public.role_permissions (role, feature, can_view, can_edit) values
  ('board', 'games',        true,  true),
  ('board', 'gamesCreate',  true,  true),
  ('board', 'gamesDelete',  true,  true),
  ('board', 'schedule',     true,  false),
  ('coach', 'games',        true,  false),
  ('coach', 'gamesLineups', true,  true),
  ('coach', 'schedule',     true,  false),
  ('coach', 'live',         true,  false),
  ('player', 'games',       true,  false),
  ('player', 'schedule',    true,  false)
on conflict (role, feature) do nothing;

-- Verify
select role, feature, can_view, can_edit from public.role_permissions order by 1, 2;
