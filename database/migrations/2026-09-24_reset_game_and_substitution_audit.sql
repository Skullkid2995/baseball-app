-- A reset must discard the previous game's substitutions and pitching history.
begin;

alter table public.scorecard_player_changes
  add column if not exists created_by uuid,
  add column if not exists change_source text;

-- Leave historical actors unknown; never infer who made an old substitution.
create or replace function public.audit_scorecard_player_change() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.change_source := case when auth.uid() is not null then 'authenticated_user'
    when auth.role() = 'service_role' then 'service_role' else 'database' end;
  return new;
end;
$$;
create or replace trigger audit_scorecard_player_change
before insert on public.scorecard_player_changes
for each row execute function public.audit_scorecard_player_change();

-- Only administrators may perform this destructive reset. No direct delete
-- permission is added to the append-only substitution table.
create or replace function public.reset_scorecard_game(p_game_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to reset a game.'; end if;
  if not public.is_super_admin() then raise exception 'Administrator access required to reset a game.'; end if;
  perform 1 from public.games where id = p_game_id for update;
  if not found then raise exception 'Game not found or access denied.'; end if;

  -- Remove references to at-bats before removing the at-bats themselves.
  delete from public.scorecard_player_changes where game_id = p_game_id;
  if exists (select 1 from public.scorecard_player_changes where game_id = p_game_id) then
    raise exception 'Could not clear substitutions. Reset cancelled.';
  end if;
  delete from public.runner_events where game_id = p_game_id;
  delete from public.game_pitchers where game_id = p_game_id;
  delete from public.scorecard_ink where game_id = p_game_id;
  delete from public.player_stats where game_id = p_game_id;
  delete from public.at_bats where game_id = p_game_id;
  if exists (select 1 from public.runner_events where game_id = p_game_id)
    or exists (select 1 from public.game_pitchers where game_id = p_game_id)
    or exists (select 1 from public.scorecard_ink where game_id = p_game_id)
    or exists (select 1 from public.player_stats where game_id = p_game_id)
    or exists (select 1 from public.at_bats where game_id = p_game_id) then
    raise exception 'Could not clear all scoring data. Reset cancelled.';
  end if;
  update public.games set our_score = 0, opponent_score = 0, innings_played = 0,
    game_status = 'scheduled', lineup_template_id = null,
    opponent_lineup_template_id = null, batting_first = null
    where id = p_game_id;
  if not found then raise exception 'Could not reset game.'; end if;
end;
$$;
revoke all on function public.reset_scorecard_game(uuid) from public, anon;
grant execute on function public.reset_scorecard_game(uuid) to authenticated;
commit;
