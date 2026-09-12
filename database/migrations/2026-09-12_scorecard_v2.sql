-- =============================================================================
-- Scorecard v2: pitcher on record, exact landing point, classic-sheet ink
-- Additive and safe to re-run. NOT applied yet (see docs/SCORECARD_SPEC.md).
-- Run in: Supabase Dashboard -> SQL Editor.
-- =============================================================================

-- 1. Plate appearance details -------------------------------------------------
alter table public.at_bats
  add column if not exists pitcher_id      uuid,                          -- players.id (no FK: keeps the players(...) embed unambiguous)
  add column if not exists hit_x           numeric(5,2),                  -- landing point, % of field width  (0-100)
  add column if not exists hit_y           numeric(5,2),                  -- landing point, % of field height (0-100)
  add column if not exists trajectory      varchar(10),                   -- ground | line | fly | popup | bunt
  add column if not exists contact_quality varchar(10),                   -- soft | medium | hard
  add column if not exists balls           smallint,
  add column if not exists strikes         smallint,
  add column if not exists fouls           smallint,
  add column if not exists pitches         smallint,
  add column if not exists out_number      smallint,                      -- 1..3 when this PA made an out
  add column if not exists batting_slot    smallint,                      -- 1..10, subs keep the slot they replaced
  add column if not exists entered_via     varchar(10) default 'digital'; -- classic | digital

alter table public.at_bats drop constraint if exists at_bats_trajectory_check;
alter table public.at_bats add constraint at_bats_trajectory_check
  check (trajectory is null or trajectory in ('ground', 'line', 'fly', 'popup', 'bunt'));
alter table public.at_bats drop constraint if exists at_bats_contact_quality_check;
alter table public.at_bats add constraint at_bats_contact_quality_check
  check (contact_quality is null or contact_quality in ('soft', 'medium', 'hard'));
alter table public.at_bats drop constraint if exists at_bats_out_number_check;
alter table public.at_bats add constraint at_bats_out_number_check
  check (out_number is null or out_number between 1 and 3);
alter table public.at_bats drop constraint if exists at_bats_entered_via_check;
alter table public.at_bats add constraint at_bats_entered_via_check
  check (entered_via in ('classic', 'digital'));

create index if not exists idx_at_bats_pitcher on public.at_bats(pitcher_id);
create index if not exists idx_at_bats_batter_pitcher on public.at_bats(player_id, pitcher_id);

-- 2. Pitching changes per game and side --------------------------------------
create table if not exists public.game_pitchers (
    id            uuid default uuid_generate_v4() primary key,
    game_id       uuid not null references public.games(id) on delete cascade,
    team_side     varchar(10) not null check (team_side in ('home', 'opponent')),
    pitcher_id    uuid not null references public.players(id) on delete cascade,
    sequence      smallint not null,              -- 1 = starter, 2 = first reliever, ...
    from_inning   smallint not null default 1,
    from_at_bat   smallint,                       -- at_bat_number where they entered (null = start of inning)
    created_at    timestamptz default now(),
    unique (game_id, team_side, sequence)
);
create index if not exists idx_game_pitchers_game on public.game_pitchers(game_id, team_side, sequence);

-- 3. Classic sheet ink: one row per box (visual only) --------------------------
create table if not exists public.scorecard_ink (
    id            uuid default uuid_generate_v4() primary key,
    game_id       uuid not null references public.games(id) on delete cascade,
    team_side     varchar(10) not null check (team_side in ('home', 'opponent')),
    batting_slot  smallint not null,
    inning        smallint not null,
    strokes       jsonb not null default '[]',    -- [{ "w": 2, "c": "#1f2937", "p": [[x,y],[x,y],...] }, ...] in box-relative 0-100 units
    updated_at    timestamptz default now(),
    unique (game_id, team_side, batting_slot, inning)
);
create index if not exists idx_scorecard_ink_game on public.scorecard_ink(game_id, team_side);

drop trigger if exists update_scorecard_ink_updated_at on public.scorecard_ink;
create trigger update_scorecard_ink_updated_at before update on public.scorecard_ink
    for each row execute function update_updated_at_column();

-- 4. Row Level Security for the new tables (same rule as the rest of the app)
alter table public.game_pitchers enable row level security;
alter table public.scorecard_ink enable row level security;
drop policy if exists "authenticated full access" on public.game_pitchers;
drop policy if exists "authenticated full access" on public.scorecard_ink;
create policy "authenticated full access" on public.game_pitchers for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.scorecard_ink  for all to authenticated using (true) with check (true);

-- 5. Verify
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'at_bats'
   and column_name in ('pitcher_id', 'hit_x', 'hit_y', 'trajectory', 'batting_slot', 'entered_via')
 order by 1;
