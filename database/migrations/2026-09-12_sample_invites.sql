-- =============================================================================
-- Public handwriting collection links
-- Anyone with a link (/write/<code>) can write sessions of samples without an
-- account. Samples land in handwriting_samples tagged with the invite code and a
-- session id, so every writer's hand helps the fine-tuning.
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
-- =============================================================================

create table if not exists public.sample_invites (
    id             uuid default uuid_generate_v4() primary key,
    code           text not null unique,             -- the part of the link: /write/<code>
    label          text not null,                    -- who it is for, e.g. "Papás del equipo"
    session_size   smallint not null default 25,     -- samples per session
    sample_set     text not null default 'mixed' check (sample_set in ('notation', 'letters', 'mixed')),
    active         boolean not null default true,
    created_by     text,
    created_at     timestamptz default now()
);

alter table public.handwriting_samples add column if not exists invite_code text;
alter table public.handwriting_samples add column if not exists session_id  text;
create index if not exists idx_handwriting_samples_invite on public.handwriting_samples(invite_code);

-- Is this a live link? (security definer: anonymous visitors never read the table itself)
create or replace function public.sample_invite_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sample_invites i where i.code = p_code and i.active)
$$;

-- What the public page needs to know about a link (label, size, set, progress so far)
create or replace function public.sample_invite_info(p_code text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'label', i.label,
    'active', i.active,
    'session_size', i.session_size,
    'sample_set', i.sample_set,
    'samples', (select count(*) from public.handwriting_samples s where s.invite_code = i.code),
    'writers', (select count(distinct s.writer) from public.handwriting_samples s where s.invite_code = i.code)
  )
  from public.sample_invites i where i.code = p_code
$$;
grant execute on function public.sample_invite_valid(text) to anon, authenticated;
grant execute on function public.sample_invite_info(text) to anon, authenticated;

-- Row Level Security
alter table public.sample_invites enable row level security;
drop policy if exists "sample_invites by signed-in" on public.sample_invites;
create policy "sample_invites by signed-in" on public.sample_invites for all to authenticated using (true) with check (true);

-- Anonymous writers may only INSERT samples that carry a live invite code (never read or change anything)
drop policy if exists "anon insert with live invite" on public.handwriting_samples;
create policy "anon insert with live invite" on public.handwriting_samples
  for insert to anon
  with check (invite_code is not null and public.sample_invite_valid(invite_code));

-- Verify
select code, label, session_size, sample_set, active from public.sample_invites order by created_at;
