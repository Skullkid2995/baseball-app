-- Apply in Supabase SQL Editor before using in-game player changes.
-- Saved lineup templates and previous at-bats are never rewritten.
create table if not exists public.scorecard_player_changes (
  id uuid primary key default uuid_generate_v4(),
  sequence bigint generated always as identity unique,
  game_id uuid not null references public.games(id) on delete cascade,
  team_side text not null check (team_side in ('home', 'opponent')),
  kind text not null check (kind in ('pinch_hitter', 'pinch_runner', 'defensive', 'position')),
  out_player_id uuid not null references public.players(id),
  in_player_id uuid not null references public.players(id),
  position text not null check (position in ('P','C','1B','2B','3B','SS','LF','CF','RF','DH')),
  incoming jsonb not null,
  previous_change_id uuid references public.scorecard_player_changes(id),
  runner_at_bat_id uuid references public.at_bats(id),
  new_pitcher_id uuid references public.players(id),
  inning smallint not null check (inning > 0),
  created_at timestamptz not null default now(),
  check ((kind = 'position') = (out_player_id = in_player_id)),
  check ((kind = 'pinch_runner') = (runner_at_bat_id is not null))
);
create index if not exists scorecard_player_changes_game on public.scorecard_player_changes(game_id, sequence);
alter table public.scorecard_player_changes enable row level security;
drop policy if exists "read player changes" on public.scorecard_player_changes;
create policy "read player changes" on public.scorecard_player_changes for select to authenticated using (true);
drop policy if exists "record player changes" on public.scorecard_player_changes;
create policy "record player changes" on public.scorecard_player_changes for insert to authenticated with check (true);

-- The pitching record and substitution commit together. Serialize changes per game.
create or replace function public.record_scorecard_player_change() returns trigger
language plpgsql security invoker set search_path = public as $$
declare status text; previous_id uuid;
begin
  select game_status into status from public.games where id = new.game_id for update;
  if status is null or status = 'completed' then
    raise exception 'This game is unavailable or locked.';
  end if;
  select id into previous_id from public.scorecard_player_changes
    where game_id = new.game_id and team_side = new.team_side order by sequence desc limit 1;
  if previous_id is distinct from new.previous_change_id then
    raise exception 'The lineup changed. Reload the scorecard before making another change.';
  end if;
  select jsonb_build_object('id', id, 'first_name', first_name, 'last_name', last_name,
    'jersey_number', jersey_number, 'positions', positions) into new.incoming
    from public.players where id = new.in_player_id;
  if new.kind = 'pinch_runner' and not exists (
    select 1 from public.at_bats where id = new.runner_at_bat_id and game_id = new.game_id
      and coalesce(team_side, 'home') = new.team_side
      and coalesce(runs_scored, 0) = 0
      and not coalesce((base_runners->>'home')::boolean, false)
      and (coalesce((base_runners->>'first')::boolean, false)
        or coalesce((base_runners->>'second')::boolean, false)
        or coalesce((base_runners->>'third')::boolean, false))
      and not (coalesce((base_runner_outs->>'first')::boolean, false)
        or coalesce((base_runner_outs->>'second')::boolean, false)
        or coalesce((base_runner_outs->>'third')::boolean, false)
        or coalesce((base_runner_outs->>'home')::boolean, false))
  ) then raise exception 'This runner is no longer on base.'; end if;
  if new.new_pitcher_id is not null then
    insert into public.game_pitchers(game_id, team_side, pitcher_id, sequence, from_inning)
    select new.game_id, new.team_side, new.new_pitcher_id, coalesce(max(sequence), 0) + 1, new.inning
      from public.game_pitchers where game_id = new.game_id and team_side = new.team_side;
  end if;
  return new;
end;
$$;
drop trigger if exists record_scorecard_player_change on public.scorecard_player_changes;
create trigger record_scorecard_player_change before insert on public.scorecard_player_changes
for each row execute function public.record_scorecard_player_change();
