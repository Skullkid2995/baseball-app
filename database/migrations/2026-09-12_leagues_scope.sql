-- =============================================================================
-- Leagues, stadiums, league officers, and who belongs where
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
--
-- leagues            a league with its location (city / state / country / address)
-- stadiums           the fields a league plays at (each with its own location)
-- league_officers    management roles inside a league (president, VP, treasurer...)
-- teams.league_id    which league a team plays in
-- games.stadium_id   the league stadium a game is played at (games.stadium text stays for display)
-- app_users.team_id  the team a coach / player belongs to (players also inherit it from their player row)
-- app_users.league_id the league a president / VP / treasurer runs
-- =============================================================================

-- A legacy, empty "leagues" table (contact_email, fields, location, logo_url...) predates
-- this design and has no id column. Old tables still point at it, so it is moved aside
-- (leagues_legacy) instead of dropped. Only runs when that table is empty.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'leagues')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leagues' and column_name = 'id')
     and (select count(*) from public.leagues) = 0 then
    alter table public.leagues rename to leagues_legacy;
  end if;
end $$;

create table if not exists public.leagues (
    id          uuid default uuid_generate_v4() primary key,
    name        text not null unique,
    city        text,
    state       text,
    country     text default 'México',
    address     text,
    notes       text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);
alter table public.leagues add column if not exists state   text;
alter table public.leagues add column if not exists country text default 'México';
alter table public.leagues add column if not exists address text;
alter table public.leagues add column if not exists notes   text;
alter table public.leagues add column if not exists updated_at timestamptz default now();

create table if not exists public.stadiums (
    id          uuid default uuid_generate_v4() primary key,
    league_id   uuid not null references public.leagues(id) on delete cascade,
    name        text not null,
    city        text,
    state       text,
    country     text,
    address     text,
    notes       text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    unique (league_id, name)
);
create index if not exists idx_stadiums_league on public.stadiums(league_id);

create table if not exists public.league_officers (
    id           uuid default uuid_generate_v4() primary key,
    league_id    uuid not null references public.leagues(id) on delete cascade,
    app_user_id  uuid not null references public.app_users(id) on delete cascade,
    office       text not null check (office in ('president', 'vice_president', 'treasurer', 'secretary', 'commissioner', 'other')),
    title        text,                                   -- free label, e.g. "Coordinador de campos"
    created_at   timestamptz default now(),
    unique (league_id, app_user_id, office)
);
create index if not exists idx_league_officers_league on public.league_officers(league_id);

alter table public.teams     add column if not exists league_id  uuid references public.leagues(id)  on delete set null;
alter table public.app_users add column if not exists team_id    uuid references public.teams(id)    on delete set null;
alter table public.app_users add column if not exists league_id  uuid references public.leagues(id)  on delete set null;
alter table public.games     add column if not exists stadium_id uuid references public.stadiums(id) on delete set null;
create index if not exists idx_teams_league on public.teams(league_id);
create index if not exists idx_games_stadium on public.games(stadium_id);

drop trigger if exists update_leagues_updated_at on public.leagues;
create trigger update_leagues_updated_at before update on public.leagues
    for each row execute function update_updated_at_column();
drop trigger if exists update_stadiums_updated_at on public.stadiums;
create trigger update_stadiums_updated_at before update on public.stadiums
    for each row execute function update_updated_at_column();

-- Who may manage a league's stadiums and officers: super admins, or an active
-- president / VP / treasurer (role board) assigned to that league.
create or replace function public.manages_league(l uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.app_users u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.active
      and u.role = 'board'
      and u.league_id = l
  )
$$;

alter table public.leagues         enable row level security;
alter table public.stadiums        enable row level security;
alter table public.league_officers enable row level security;

drop policy if exists "leagues readable by signed-in"  on public.leagues;
drop policy if exists "leagues insert by super admins" on public.leagues;
drop policy if exists "leagues update by managers"     on public.leagues;
drop policy if exists "leagues delete by super admins" on public.leagues;
create policy "leagues readable by signed-in"  on public.leagues for select to authenticated using (true);
create policy "leagues insert by super admins" on public.leagues for insert to authenticated with check (public.is_super_admin());
create policy "leagues update by managers"     on public.leagues for update to authenticated using (public.manages_league(id)) with check (public.manages_league(id));
create policy "leagues delete by super admins" on public.leagues for delete to authenticated using (public.is_super_admin());

drop policy if exists "stadiums readable by signed-in" on public.stadiums;
drop policy if exists "stadiums managed by league"     on public.stadiums;
create policy "stadiums readable by signed-in" on public.stadiums for select to authenticated using (true);
create policy "stadiums managed by league"     on public.stadiums for all to authenticated using (public.manages_league(league_id)) with check (public.manages_league(league_id));

drop policy if exists "officers readable by signed-in" on public.league_officers;
drop policy if exists "officers managed by league"     on public.league_officers;
create policy "officers readable by signed-in" on public.league_officers for select to authenticated using (true);
create policy "officers managed by league"     on public.league_officers for all to authenticated using (public.manages_league(league_id)) with check (public.manages_league(league_id));

-- Verify
select table_name, column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name in ('teams', 'app_users') and column_name in ('league_id', 'team_id'))
     or (table_name = 'games' and column_name = 'stadium_id')
     or (table_name in ('leagues', 'stadiums', 'league_officers') and column_name = 'id'))
 order by 1, 2;
