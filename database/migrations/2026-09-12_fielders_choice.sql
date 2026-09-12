-- =============================================================================
-- Fielder's choice is its own result (the batter is safe, a runner is out).
-- Until now FC was stored as ground_out, which painted an out on the batter's
-- box on top of the runner's out. Safe to re-run.
-- =============================================================================

-- Replace the result check constraint (whatever it is named) with one that allows fielders_choice
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.at_bats'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%(result)%'
  loop
    execute format('alter table public.at_bats drop constraint %I', c);
  end loop;
end $$;

alter table public.at_bats add constraint at_bats_result_check
  check (result in ('single', 'double', 'triple', 'home_run', 'walk', 'strikeout',
                    'ground_out', 'fly_out', 'line_out', 'pop_out', 'error',
                    'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt', 'fielders_choice'));

-- Plays already scored as FC keep their meaning
update public.at_bats set result = 'fielders_choice' where upper(notation) = 'FC' and result = 'ground_out';

-- Verify
select result, count(*) from public.at_bats group by 1 order by 1;
