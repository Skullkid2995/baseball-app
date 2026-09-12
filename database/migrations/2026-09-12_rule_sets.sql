-- =============================================================================
-- Editable rule sets (league / default). Safe to re-run.
-- =============================================================================
create table if not exists public.rule_sets (
    id          uuid default uuid_generate_v4() primary key,
    name        varchar(80) not null unique,   -- 'default' for now; one per league later
    rules       jsonb not null default '{}',   -- partial RuleSet; merged over DEFAULT_RULES in lib/rules/config.ts
    updated_at  timestamptz default now()
);
drop trigger if exists update_rule_sets_updated_at on public.rule_sets;
create trigger update_rule_sets_updated_at before update on public.rule_sets
    for each row execute function update_updated_at_column();

alter table public.rule_sets enable row level security;
drop policy if exists "authenticated full access" on public.rule_sets;
create policy "authenticated full access" on public.rule_sets
  for all to authenticated using (true) with check (true);

select count(*) as rule_sets from public.rule_sets;
