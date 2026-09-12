-- =============================================================================
-- Baseball App - complete schema for a BRAND-NEW Supabase project
-- =============================================================================
-- Consolidated on 2026-09-11 from every file in this folder:
--   schema.sql + simplified_games_schema.sql + all add_* / remove_* / update_* migrations
--   + setup_storage_policies.sql
-- It reproduces the final state the app expects (see the interfaces in components/*.tsx).
--
-- HOW TO USE: Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
-- Run it ONCE on an EMPTY project. Do NOT run it on a project that already has data.
-- views.sql is intentionally NOT included: it references tables (leagues, seasons,
-- pitch_events, ...) that this app never created or uses.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- Shared trigger function: keeps updated_at current
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- TEAMS
-- -----------------------------------------------------------------------------
create table if not exists teams (
    id            uuid default uuid_generate_v4() primary key,
    name          varchar(100) not null,
    city          varchar(100) not null,
    manager       varchar(100),
    coach         varchar(100),
    founded_year  integer,
    stadium       varchar(100),
    logo_url      text,                       -- add_team_logo.sql
    lineup        uuid[] default '{}',        -- add_lineup_field.sql (legacy batting order; templates supersede it)
    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
);
comment on column teams.lineup is 'Array of player IDs representing the batting order (legacy; lineup_templates is the current mechanism)';
create index if not exists idx_teams_lineup on teams using gin (lineup);

-- -----------------------------------------------------------------------------
-- PLAYERS
-- -----------------------------------------------------------------------------
create table if not exists players (
    id                      uuid default uuid_generate_v4() primary key,
    first_name              varchar(50) not null,
    last_name               varchar(50) not null,
    date_of_birth           date not null,
    team_id                 uuid references teams(id) on delete set null,
    positions               text[] not null,
    handedness              varchar(10) not null check (handedness in ('Righty', 'Lefty', 'Switch')),
    contact_number          varchar(20),
    emergency_number        varchar(20),
    emergency_contact_name  varchar(100),
    jersey_number           integer,
    height_inches           integer,
    weight_lbs              integer,
    batting_hand            varchar(1) check (batting_hand in ('L', 'R', 'S')),
    throwing_hand           varchar(1) check (throwing_hand in ('L', 'R')),
    debut_date              date,
    photo_url               text,             -- add_player_photo.sql
    is_active               boolean default true,
    created_at              timestamptz default now(),
    updated_at              timestamptz default now()
);
comment on column players.photo_url is 'URL to player photo stored in Supabase Storage (bucket player-photos)';
create index if not exists idx_players_team_id on players(team_id);
create index if not exists idx_players_active  on players(is_active);

-- -----------------------------------------------------------------------------
-- LINEUP TEMPLATES (one template per team)  - update_lineup_templates_for_teams.sql
-- -----------------------------------------------------------------------------
create table if not exists lineup_templates (
    id          uuid default uuid_generate_v4() primary key,
    team_id     uuid not null references teams(id) on delete cascade,
    name        varchar(100) not null default 'Default Lineup',
    description text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),
    unique (team_id)
);

create table if not exists lineup_template_players (
    id            uuid default uuid_generate_v4() primary key,
    template_id   uuid not null references lineup_templates(id) on delete cascade,
    player_id     uuid not null references players(id) on delete cascade,
    batting_order integer not null check (batting_order >= 1 and batting_order <= 10),
    position      varchar(20) not null check (position in ('P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH')),
    -- add_batting_for_to_lineup_templates.sql. Deliberately NOT a foreign key: a second FK to
    -- players would make PostgREST's "players (...)" embed ambiguous and break the app's queries.
    batting_for   uuid,
    created_at    timestamptz default now()
);
comment on column lineup_template_players.batting_for is 'Player the DH bats for (usually the pitcher). Only set when position = DH.';
create index        if not exists idx_lineup_templates_team            on lineup_templates(team_id);
create index        if not exists idx_lineup_template_players_template on lineup_template_players(template_id);
create index        if not exists idx_lineup_template_players_player   on lineup_template_players(player_id);
create unique index if not exists idx_unique_batting_order             on lineup_template_players(template_id, batting_order);
create unique index if not exists idx_unique_position                  on lineup_template_players(template_id, position);

-- -----------------------------------------------------------------------------
-- GAMES (single-team offensive tracking)  - simplified_games_schema.sql + later adds
-- -----------------------------------------------------------------------------
create table if not exists games (
    id                          uuid default uuid_generate_v4() primary key,
    opponent                    varchar(100) not null,
    game_date                   date not null,
    game_time                   time,
    stadium                     varchar(100),
    weather_conditions          varchar(100),
    our_score                   integer default 0,
    opponent_score              integer default 0,
    innings_played              integer default 0,
    game_status                 varchar(20) default 'scheduled'
                                check (game_status in ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
    team_id                     uuid references teams(id) on delete cascade,          -- add_team_id_to_games.sql
    lineup_template_id          uuid references lineup_templates(id),                 -- our lineup (NULL = not chosen yet)
    opponent_lineup_template_id uuid references lineup_templates(id),                 -- add_opponent_lineup_and_team_tracking.sql
    batting_first               varchar(10) check (batting_first in ('home', 'opponent')), -- add_batting_first_column.sql
    created_at                  timestamptz default now(),
    updated_at                  timestamptz default now()
);
comment on column games.team_id is 'Team whose offensive stats are tracked in this game';
comment on column games.batting_first is 'Which team bats first: home (our team) or opponent';
create index if not exists idx_games_date    on games(game_date);
create index if not exists idx_games_status  on games(game_status);
create index if not exists idx_games_team_id on games(team_id);

-- -----------------------------------------------------------------------------
-- AT BATS  - simplified_games_schema.sql + add_* migrations
-- -----------------------------------------------------------------------------
create table if not exists at_bats (
    id               uuid default uuid_generate_v4() primary key,
    game_id          uuid not null references games(id) on delete cascade,
    player_id        uuid not null references players(id) on delete cascade,
    inning           integer not null,
    at_bat_number    integer not null,
    -- Values written by TraditionalScorebook.tsx: single, double, triple, home_run, walk,
    -- strikeout, ground_out, fly_out, line_out, pop_out, error, hit_by_pitch,
    -- sacrifice_fly, sacrifice_bunt.
    result           varchar(50) not null
                     check (result in ('single', 'double', 'triple', 'home_run', 'walk', 'strikeout',
                                       'ground_out', 'fly_out', 'line_out', 'pop_out', 'error',
                                       'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt', 'fielders_choice')),
    rbi              integer default 0,
    runs_scored      integer default 0,
    stolen_bases     integer default 0,
    base_runners     jsonb default '{"first": false, "second": false, "third": false, "home": false}',
    base_runner_outs jsonb default '{"first": false, "second": false, "third": false, "home": false}',
    out_type         varchar(50) default '',   -- TAGGED_OUT, CAUGHT_STEALING, FORCE_OUT
    notation         varchar(50) default '',   -- original notation e.g. 6-3, K, BB, F-8
    field_area       varchar(50) default '',
    field_zone       varchar(50) default '',
    hit_distance     varchar(20) default '',   -- SHORT, MEDIUM, DEEP
    hit_angle        varchar(20) default '',   -- PULL, CENTER, OPPO
    team_side        varchar(10) default 'home' check (team_side in ('home', 'opponent')),
    created_at       timestamptz default now()
);
create index if not exists idx_at_bats_game      on at_bats(game_id);
create index if not exists idx_at_bats_player    on at_bats(player_id);
create index if not exists idx_at_bats_inning    on at_bats(inning);
create index if not exists idx_at_bats_team_side on at_bats(game_id, team_side, inning);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists update_teams_updated_at            on teams;
drop trigger if exists update_players_updated_at          on players;
drop trigger if exists update_games_updated_at            on games;
drop trigger if exists update_lineup_templates_updated_at on lineup_templates;
create trigger update_teams_updated_at            before update on teams            for each row execute function update_updated_at_column();
create trigger update_players_updated_at          before update on players          for each row execute function update_updated_at_column();
create trigger update_games_updated_at            before update on games            for each row execute function update_updated_at_column();
create trigger update_lineup_templates_updated_at before update on lineup_templates for each row execute function update_updated_at_column();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Every page of the app sits behind Google login (middleware.ts), so the browser
-- always queries as the "authenticated" role. These policies give logged-in users
-- full access and block the bare anon key from reading anything.
-- -----------------------------------------------------------------------------
alter table teams                   enable row level security;
alter table players                 enable row level security;
alter table games                   enable row level security;
alter table at_bats                 enable row level security;
alter table lineup_templates        enable row level security;
alter table lineup_template_players enable row level security;

drop policy if exists "authenticated full access" on teams;
drop policy if exists "authenticated full access" on players;
drop policy if exists "authenticated full access" on games;
drop policy if exists "authenticated full access" on at_bats;
drop policy if exists "authenticated full access" on lineup_templates;
drop policy if exists "authenticated full access" on lineup_template_players;

create policy "authenticated full access" on teams                   for all to authenticated using (true) with check (true);
create policy "authenticated full access" on players                 for all to authenticated using (true) with check (true);
create policy "authenticated full access" on games                   for all to authenticated using (true) with check (true);
create policy "authenticated full access" on at_bats                 for all to authenticated using (true) with check (true);
create policy "authenticated full access" on lineup_templates        for all to authenticated using (true) with check (true);
create policy "authenticated full access" on lineup_template_players for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- STORAGE: player photos / team logos bucket  - setup_storage_policies.sql
-- -----------------------------------------------------------------------------
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

-- Done. Next: Authentication -> Providers -> Google (see RECONNECT_SUPABASE.md).
