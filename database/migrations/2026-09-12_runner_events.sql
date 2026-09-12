-- =============================================================================
-- Runner events during an at-bat: stolen bases (with / without throw), caught
-- stealing, pickoffs (with the fielders involved), wild pitches, passed balls,
-- balks. Each event also updates the runner's own at_bats row (base_runners /
-- base_runner_outs), so the sheet and the outs stay right.
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
-- =============================================================================

create table if not exists public.runner_events (
    id                uuid default uuid_generate_v4() primary key,
    game_id           uuid not null references public.games(id) on delete cascade,
    team_side         varchar(10) not null check (team_side in ('home', 'opponent')),
    inning            smallint not null,
    runner_at_bat_id  uuid references public.at_bats(id) on delete cascade,   -- the runner's own box
    runner_player_id  uuid references public.players(id) on delete set null,
    during_at_bat_id  uuid references public.at_bats(id) on delete set null,  -- the batter's plate appearance (null if not saved yet)
    batter_player_id  uuid references public.players(id) on delete set null,
    pitcher_id        uuid,                                                    -- players.id (no FK: keeps embeds unambiguous)
    event_type        text not null check (event_type in ('SB', 'CS', 'PK', 'WP', 'PB', 'BK', 'ADV')),
    from_base         text check (from_base in ('first', 'second', 'third')),
    to_base           text check (to_base in ('second', 'third', 'home')),
    is_out            boolean not null default false,
    throw             boolean,          -- SB: true = with throw, false = no throw
    fielders          text,             -- positions involved, e.g. '1-3-6' (pickoff) or '2-6' (caught stealing)
    entered_via       varchar(10) default 'digital' check (entered_via in ('classic', 'digital')),
    created_at        timestamptz default now()
);
create index if not exists idx_runner_events_game on public.runner_events(game_id, team_side, inning);
create index if not exists idx_runner_events_runner on public.runner_events(runner_player_id);
create index if not exists idx_runner_events_pitcher on public.runner_events(pitcher_id);

alter table public.runner_events enable row level security;
drop policy if exists "authenticated full access" on public.runner_events;
create policy "authenticated full access" on public.runner_events for all to authenticated using (true) with check (true);

-- Runner outs on the sheet can now also be these
alter table public.at_bats drop constraint if exists at_bats_out_type_check;

-- Verify
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'runner_events' order by ordinal_position;
