-- Selected bench and bullpen belong to this game, independently of reusable batting templates.
alter table public.games add column if not exists roster_reserves jsonb not null default '{}'::jsonb;
comment on column public.games.roster_reserves is 'Per side (home/opponent): bench and bullpen player UUID arrays. Missing side retains legacy full-roster availability; explicit empty arrays mean no selected reserves.';
notify pgrst, 'reload schema';
