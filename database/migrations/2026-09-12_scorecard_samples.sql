-- =============================================================================
-- Scorecard lab: complete plate-appearance samples drawn in the classic box
-- Safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
-- =============================================================================
create table if not exists public.scorecard_samples (
    id             uuid default uuid_generate_v4() primary key,
    writer         varchar(80) not null,
    scenario       varchar(40) not null,           -- key from lib/scorecard/scenarios.ts
    actions        jsonb not null,                 -- ordered strokes and taps in box units
    interpreted    jsonb not null,                 -- what the interpreter read
    expected       jsonb not null,                 -- what the scenario expected
    field_results  jsonb not null,                 -- { token: bool, bases: bool, out: bool, ... }
    all_correct    boolean not null default false,
    pointer_type   varchar(10),
    device         varchar(120),
    created_at     timestamptz default now()
);
create index if not exists idx_scorecard_samples_scenario on public.scorecard_samples(scenario);
create index if not exists idx_scorecard_samples_writer on public.scorecard_samples(writer);

alter table public.scorecard_samples enable row level security;
drop policy if exists "authenticated full access" on public.scorecard_samples;
create policy "authenticated full access" on public.scorecard_samples
  for all to authenticated using (true) with check (true);

select count(*) as scorecard_samples from public.scorecard_samples;
