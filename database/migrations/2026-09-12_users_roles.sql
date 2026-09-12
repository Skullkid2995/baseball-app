-- =============================================================================
-- Users, roles and per-feature permissions
-- Additive and safe to re-run. Run in: Supabase Dashboard -> SQL Editor.
--
-- app_users        who may sign in (by Google email), their role and optional player
-- role_permissions what each role can view / edit, per feature key (lib/permissions.ts)
--
-- Roles: super_admin (everything, always), coach (Coach / Manager),
--        board (President / VP / Treasurer), player (Player).
-- A feature with no row for a role is DISABLED for that role, so anything new
-- starts hidden for everyone except super admins.
-- =============================================================================

create table if not exists public.app_users (
    id            uuid default uuid_generate_v4() primary key,
    email         text not null unique,
    display_name  text,
    role          text not null default 'player'
                  check (role in ('super_admin', 'coach', 'board', 'player')),
    player_id     uuid references public.players(id) on delete set null,   -- optional link to a roster player
    active        boolean not null default true,
    created_by    text,
    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
);
create unique index if not exists idx_app_users_email_lower on public.app_users (lower(email));
create index if not exists idx_app_users_player on public.app_users (player_id);

create table if not exists public.role_permissions (
    role        text not null check (role in ('coach', 'board', 'player')),
    feature     text not null,
    can_view    boolean not null default false,
    can_edit    boolean not null default false,
    updated_at  timestamptz default now(),
    primary key (role, feature)
);

drop trigger if exists update_app_users_updated_at on public.app_users;
create trigger update_app_users_updated_at before update on public.app_users
    for each row execute function update_updated_at_column();
drop trigger if exists update_role_permissions_updated_at on public.role_permissions;
create trigger update_role_permissions_updated_at before update on public.role_permissions
    for each row execute function update_updated_at_column();

-- Who is a super admin: the bootstrap owners (also hard-coded in lib/auth.ts so the
-- owner can never be locked out) or an active app_users row with role super_admin.
-- security definer: reads app_users without going through its own RLS policies.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('jesus.contreras@group-u.com', 'skullkid2995@gmail.com')
    or exists (
      select 1 from public.app_users u
      where lower(u.email) = lower(auth.jwt() ->> 'email')
        and u.role = 'super_admin'
        and u.active
    ),
    false
  )
$$;

-- Row Level Security: every signed-in user can read (the app needs its own row
-- and the permission matrix); only super admins can change anything.
alter table public.app_users enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "app_users readable by signed-in"     on public.app_users;
drop policy if exists "app_users insert by super admins"    on public.app_users;
drop policy if exists "app_users update by super admins"    on public.app_users;
drop policy if exists "app_users delete by super admins"    on public.app_users;
create policy "app_users readable by signed-in"  on public.app_users for select to authenticated using (true);
create policy "app_users insert by super admins" on public.app_users for insert to authenticated with check (public.is_super_admin());
create policy "app_users update by super admins" on public.app_users for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "app_users delete by super admins" on public.app_users for delete to authenticated using (public.is_super_admin());

drop policy if exists "role_permissions readable by signed-in"  on public.role_permissions;
drop policy if exists "role_permissions insert by super admins" on public.role_permissions;
drop policy if exists "role_permissions update by super admins" on public.role_permissions;
drop policy if exists "role_permissions delete by super admins" on public.role_permissions;
create policy "role_permissions readable by signed-in"  on public.role_permissions for select to authenticated using (true);
create policy "role_permissions insert by super admins" on public.role_permissions for insert to authenticated with check (public.is_super_admin());
create policy "role_permissions update by super admins" on public.role_permissions for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "role_permissions delete by super admins" on public.role_permissions for delete to authenticated using (public.is_super_admin());

-- Bootstrap: the owner accounts are super admins
insert into public.app_users (email, display_name, role, created_by) values
  ('jesus.contreras@group-u.com', 'Jesus Contreras', 'super_admin', 'system'),
  ('skullkid2995@gmail.com',      'Jesus Contreras', 'super_admin', 'system')
on conflict (email) do update set role = 'super_admin', active = true;

-- Verify
select email, role, active from public.app_users order by created_at;
