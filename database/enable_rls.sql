-- =============================================================================
-- Align the EXISTING project with the app + enable Row Level Security
-- (safe to re-run; applied to project uzbupbtrmbmmmkztmrtl on 2026-09-11)
-- =============================================================================
-- Run in: Supabase Dashboard -> SQL Editor -> paste -> Run.

-- 1. Columns the code expects that were never migrated on this project
alter table public.games
  add column if not exists team_id uuid references public.teams(id) on delete cascade;
create index if not exists idx_games_team_id on public.games(team_id);

-- Existing games all belong to our only team
update public.games
   set team_id = (select id from public.teams where name = 'Dodgers' limit 1)
 where team_id is null;

-- Deliberately NOT a foreign key: a second FK to players would make PostgREST's
-- "players (...)" embed on lineup_template_players ambiguous and break the app.
alter table public.lineup_template_players
  add column if not exists batting_for uuid;

-- Which team was batting for each at-bat (scorebook, dashboard, statistics)
alter table public.at_bats
  add column if not exists team_side varchar(10) default 'home'
  check (team_side in ('home', 'opponent'));
create index if not exists idx_at_bats_team_side on public.at_bats(game_id, team_side, inning);

-- Legacy batting-order array still read by the lineup screen
alter table public.teams
  add column if not exists lineup uuid[] default '{}';

-- 2. RLS on every table in public: signed-in users get full access, anon gets nothing.
--    Every page of the app sits behind Google login (middleware.ts), so the browser
--    always talks to Supabase as the "authenticated" role.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('drop policy if exists "authenticated full access" on public.%I', t.tablename);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      t.tablename
    );
  end loop;
end $$;

-- 3. Storage: player photos / team logos
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Allow public read"           on storage.objects;
drop policy if exists "Allow authenticated updates" on storage.objects;
drop policy if exists "Allow authenticated deletes" on storage.objects;

create policy "Allow authenticated uploads" on storage.objects for insert to authenticated with check (bucket_id = 'player-photos');
create policy "Allow public read"           on storage.objects for select to public        using (bucket_id = 'player-photos');
create policy "Allow authenticated updates" on storage.objects for update to authenticated using (bucket_id = 'player-photos') with check (bucket_id = 'player-photos');
create policy "Allow authenticated deletes" on storage.objects for delete to authenticated using (bucket_id = 'player-photos');

-- 4. Verify: every row should show rls_enabled = true and policies = 1
select
  c.relname       as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
