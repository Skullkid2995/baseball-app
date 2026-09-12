-- =============================================================================
-- Handwriting lab: sample strokes for scorecard notation tokens
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
-- =============================================================================
create table if not exists public.handwriting_samples (
    id            uuid default uuid_generate_v4() primary key,
    writer        varchar(80) not null,            -- volunteer's name or nickname
    symbol        varchar(10) not null,            -- token prompted, e.g. '6-3', 'K', 'BB'
    strokes       jsonb not null,                  -- [[[x,y],[x,y],...], ...] in 0-100 box units
    recognized    varchar(10),                     -- what the recognizer guessed at save time
    correct       boolean,                         -- recognized = symbol
    pointer_type  varchar(10),                     -- pen | touch | mouse
    device        varchar(120),                    -- short user agent
    created_at    timestamptz default now()
);
create index if not exists idx_handwriting_samples_symbol on public.handwriting_samples(symbol);
create index if not exists idx_handwriting_samples_writer on public.handwriting_samples(writer);

alter table public.handwriting_samples enable row level security;
drop policy if exists "authenticated full access" on public.handwriting_samples;
create policy "authenticated full access" on public.handwriting_samples
  for all to authenticated using (true) with check (true);

select count(*) as samples from public.handwriting_samples;
