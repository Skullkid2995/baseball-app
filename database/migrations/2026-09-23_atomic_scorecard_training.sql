-- One transaction for the diagnostic sample and its labeled handwriting examples.
-- Caller-provided IDs make retries after a lost response safe.
create or replace function public.save_scorecard_training(sample jsonb, training jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare saved public.scorecard_samples; item jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save training.'; end if;
  if nullif(trim(sample->>'writer'), '') is null
    or jsonb_typeof(sample->'actions') is distinct from 'array'
    or jsonb_typeof(training) is distinct from 'array'
    or jsonb_array_length(training) > 2 then
    raise exception 'Invalid training sample.';
  end if;
  insert into public.scorecard_samples(id, writer, scenario, actions, interpreted, expected,
    field_results, all_correct, pointer_type, device)
  values ((sample->>'id')::uuid, sample->>'writer', sample->>'scenario', sample->'actions',
    sample->'interpreted', sample->'expected', sample->'field_results',
    (sample->>'all_correct')::boolean, sample->>'pointer_type', sample->>'device')
  on conflict (id) do nothing returning * into saved;
  if saved.id is null then
    select * into saved from public.scorecard_samples where id = (sample->>'id')::uuid;
    if saved.writer is distinct from sample->>'writer' or saved.actions is distinct from sample->'actions'
      or saved.scenario is distinct from sample->>'scenario' then
      raise exception 'Sample ID already belongs to a different drawing.';
    end if;
    return to_jsonb(saved);
  end if;
  for item in select value from jsonb_array_elements(training) loop
    if nullif(item->>'symbol', '') is null or jsonb_typeof(item->'strokes') is distinct from 'array'
      or jsonb_array_length(item->'strokes') = 0 then raise exception 'Invalid handwriting example.'; end if;
    insert into public.handwriting_samples(id, writer, symbol, strokes, recognized, correct, pointer_type, device)
    values ((item->>'id')::uuid, saved.writer, item->>'symbol', item->'strokes', item->>'recognized',
      case when item->>'recognized' is null then null else upper(item->>'recognized') = upper(item->>'symbol') end,
      saved.pointer_type, saved.device);
  end loop;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_scorecard_training(jsonb, jsonb) from public, anon;
grant execute on function public.save_scorecard_training(jsonb, jsonb) to authenticated;
