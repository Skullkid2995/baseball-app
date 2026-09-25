-- Run in SQL Editor. All fixtures and writes are rolled back.
begin;
do $$
declare
  fixture uuid := gen_random_uuid();
  batter uuid;
  replacement uuid;
  appearance uuid := gen_random_uuid();
  first_change uuid;
  actor uuid := gen_random_uuid();
begin
  select id into batter from public.players order by id limit 1;
  select id into replacement from public.players where id <> batter order by id limit 1;
  insert into public.games(id, opponent, game_date, game_status, our_score)
    values(fixture, 'ROLLBACK ONLY reset regression', current_date, 'in_progress', 7);
  insert into public.at_bats(id, game_id, player_id, inning, at_bat_number, result, team_side, base_runners)
    values(appearance, fixture, batter, 1, 1, 'single', 'home', '{"first":true}');

  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'email', 'reset-test@example.invalid', 'role', 'authenticated')::text, true);
  begin
    perform public.reset_scorecard_game(fixture);
    raise exception 'TEST FAILED: non-admin reset allowed';
  exception when raise_exception then
    if sqlerrm <> 'Administrator access required to reset a game.' then raise; end if;
  end;
  if not exists (select 1 from public.at_bats where id = appearance) then
    raise exception 'TEST FAILED: rejected reset mutated data';
  end if;

  insert into public.scorecard_player_changes(game_id, team_side, kind, out_player_id, in_player_id, position, incoming, runner_at_bat_id, inning)
    values(fixture, 'home', 'pinch_runner', batter, replacement, 'RF', '{}', appearance, 1)
    returning id into first_change;
  insert into public.scorecard_player_changes(game_id, team_side, kind, out_player_id, in_player_id, position, incoming, previous_change_id, inning)
    values(fixture, 'home', 'position', replacement, replacement, 'CF', '{}', first_change, 1);
  if exists (select 1 from public.scorecard_player_changes where game_id = fixture
    and (created_by is distinct from actor or change_source is distinct from 'authenticated_user')) then
    raise exception 'TEST FAILED: missing substitution actor';
  end if;
  insert into public.game_pitchers(game_id, team_side, pitcher_id, sequence) values(fixture, 'home', batter, 1);
  insert into public.scorecard_ink(game_id, team_side, batting_slot, inning) values(fixture, 'home', 1, 1);

  -- Exercise the existing bootstrap-admin check inside this rolled-back fixture.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'email', 'skullkid2995@gmail.com', 'role', 'authenticated')::text, true);
  perform public.reset_scorecard_game(fixture);
  if exists(select 1 from public.at_bats where game_id = fixture)
    or exists(select 1 from public.scorecard_player_changes where game_id = fixture)
    or exists(select 1 from public.game_pitchers where game_id = fixture)
    or exists(select 1 from public.scorecard_ink where game_id = fixture)
    or not exists(select 1 from public.games where id = fixture and game_status = 'scheduled' and our_score = 0) then
    raise exception 'TEST FAILED: incomplete reset';
  end if;
end;
$$;
rollback;
select 'PASS: reset clears chained substitutions, runner references, pitchers and ink; actor recorded; non-admin denied; fixtures rolled back' as result;
