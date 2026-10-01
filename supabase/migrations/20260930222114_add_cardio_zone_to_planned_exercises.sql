begin;

-- D2D-A is additive. No routine reset, child recreation or payload execution
-- occurs while applying this migration. The existing RPC's atomic replacement
-- algorithm below is unchanged and runs only on an authenticated save call.
alter table public.planned_exercises
  add column cardio_zone smallint;

alter table public.planned_exercises
  add constraint planned_exercises_cardio_zone_valid
  check (cardio_zone is null or cardio_zone between 1 and 5);

-- Internal compatibility helper, not an additional client API. This ONE bounded
-- allowlist is shared by the backfill and old-client RPC fallback.
-- Reviewed against the canonical resolver + built-in references at D2C:
-- 9001 Walking; 9003 Stationary Bike; 3666 Incline Treadmill Walk; 2141 Elliptical.
-- Canonical bodyPart=cardio for these imported IDs; not names/equipment or mode.
-- Other cardio IDs require separate review before joining this legacy allowlist.
create function public.routine_legacy_cardio_zone_v1(
  p_exercise_id text,
  p_target_value text,
  p_note text
)
returns smallint
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $legacy_zone$
declare
  v_match text[];
  v_zone smallint := null;
begin
  if p_exercise_id is null
    or p_exercise_id not in ('9001', '9003', '3666', '2141')
  then
    return null;
  end if;

  -- Whole-word, whitespace-separated explicit numeric tokens only. Repetition
  -- of the same Zone is unambiguous. Different Zones, unsupported numbers,
  -- decimals and numeric ranges leave NULL; no natural-language inference.
  for v_match in
    select pg_catalog.regexp_matches(
      source.value,
      '\mzone[[:space:]]+([0-9]+)\M([[:space:]]*(?:[.\-–/][[:space:]]*[0-9]+|to[[:space:]]+[0-9]+))?',
      'gi'
    )
    from pg_catalog.unnest(array[p_target_value, p_note]) as source(value)
  loop
    if v_match[1] not in ('1', '2', '3', '4', '5')
      or coalesce(v_match[2], '') <> ''
    then
      return null;
    end if;
    if v_zone is not null and v_zone <> v_match[1]::smallint then
      return null;
    end if;
    v_zone := v_match[1]::smallint;
  end loop;
  return v_zone;
end;
$legacy_zone$;

alter function public.routine_legacy_cardio_zone_v1(text, text, text) owner to postgres;
revoke all on function public.routine_legacy_cardio_zone_v1(text, text, text)
  from PUBLIC, anon, authenticated;

-- Update only the new column on qualifying NULL rows. Every identity, note,
-- timestamp, order and other programming column remains byte-for-byte intact.
-- This migration is one-shot: do not rerun backfill after clients can clear Zone.
with candidates as materialized (
  select id, public.routine_legacy_cardio_zone_v1(
    exercise_id, target_reps, note
  ) as zone
  from public.planned_exercises
  where cardio_zone is null
)
update public.planned_exercises as occurrence
set cardio_zone = candidates.zone
from candidates
where occurrence.id = candidates.id
  and candidates.zone is not null
  and occurrence.cardio_zone is null;

-- CREATE OR REPLACE retains the existing function owner/ACL. Its signature,
-- auth.uid() ownership preflight, SECURITY DEFINER boundary, pg_catalog-only
-- search_path, generic errors and atomic child replacement are preserved.

create or replace function public.save_active_routine_v1(p_routine jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing_routine_user_id uuid;
  v_routine_id uuid;
  v_routine_name text;
  v_days jsonb;
  v_day jsonb;
  v_exercise jsonb;
  v_day_id uuid;
  v_occurrence_id uuid;
  v_weekday text;
  v_title text;
  v_kind text;
  v_exercise_id text;
  v_exercise_name text;
  v_target_muscle text;
  v_section text;
  v_order integer;
  v_target_sets integer;
  v_target_value text;
  v_tracking_type text;
  v_weight_unit text;
  v_rest_seconds integer;
  v_note text;
  v_cardio_zone smallint;
  v_seen_weekdays text[] := array[]::text[];
  v_seen_day_ids uuid[] := array[]::uuid[];
  v_seen_occurrence_ids uuid[] := array[]::uuid[];
  v_seen_orders integer[];
  v_exercise_count integer;
  v_index integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'ROUTINE_AUTH_REQUIRED';
  end if;

  if p_routine is null or pg_catalog.jsonb_typeof(p_routine) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'ROUTINE_VALIDATION_FAILED';
  end if;

  if pg_catalog.jsonb_typeof(p_routine -> 'id') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_routine -> 'name') is distinct from 'string'
    or p_routine ? 'user_id'
  then
    raise exception using
      errcode = '22023',
      message = 'ROUTINE_VALIDATION_FAILED';
  end if;

  begin
    v_routine_id := nullif(p_routine ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception using
      errcode = '22023',
      message = 'ROUTINE_VALIDATION_FAILED';
  end;

  v_routine_name := pg_catalog.btrim(coalesce(p_routine ->> 'name', ''));
  v_days := p_routine -> 'days';
  if v_routine_id is null
    or pg_catalog.char_length(v_routine_name) not between 1 and 80
    or v_days is null
    or pg_catalog.jsonb_typeof(v_days) <> 'array'
    or pg_catalog.jsonb_array_length(v_days) <> 7
  then
    raise exception using
      errcode = '22023',
      message = 'ROUTINE_VALIDATION_FAILED';
  end if;

  -- Validate the complete graph before issuing any DML.
  for v_day in
    select value from pg_catalog.jsonb_array_elements(v_days)
  loop
    if pg_catalog.jsonb_typeof(v_day) <> 'object' then
      raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
    end if;

    if pg_catalog.jsonb_typeof(v_day -> 'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_day -> 'weekday') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_day -> 'title') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_day -> 'kind') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_day -> 'exercises') is distinct from 'array'
    then
      raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
    end if;

    begin
      v_day_id := nullif(v_day ->> 'id', '')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
    end;
    v_weekday := pg_catalog.lower(pg_catalog.btrim(coalesce(v_day ->> 'weekday', '')));
    v_title := pg_catalog.btrim(coalesce(v_day ->> 'title', ''));
    v_kind := pg_catalog.lower(pg_catalog.btrim(coalesce(v_day ->> 'kind', '')));

    if v_day_id is null
      or v_day_id = any(v_seen_day_ids)
      or v_weekday not in (
        'monday', 'tuesday', 'wednesday', 'thursday',
        'friday', 'saturday', 'sunday'
      )
      or v_weekday = any(v_seen_weekdays)
      or pg_catalog.char_length(v_title) not between 1 and 60
      or v_kind not in ('training', 'rest', 'recovery')
      or v_day -> 'exercises' is null
      or pg_catalog.jsonb_typeof(v_day -> 'exercises') <> 'array'
      or pg_catalog.jsonb_array_length(v_day -> 'exercises') > 200
    then
      raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
    end if;

    v_seen_day_ids := pg_catalog.array_append(v_seen_day_ids, v_day_id);
    v_seen_weekdays := pg_catalog.array_append(v_seen_weekdays, v_weekday);
    v_exercise_count := pg_catalog.jsonb_array_length(v_day -> 'exercises');
    if v_kind = 'rest' and v_exercise_count > 0 then
      raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
    end if;

    v_seen_orders := array[]::integer[];
    for v_exercise in
      select value from pg_catalog.jsonb_array_elements(v_day -> 'exercises')
    loop
      if pg_catalog.jsonb_typeof(v_exercise) <> 'object' then
        raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
      end if;

      if pg_catalog.jsonb_typeof(v_exercise -> 'id') is distinct from 'string'
        or (
          v_exercise -> 'exercise_id' is not null
          and pg_catalog.jsonb_typeof(v_exercise -> 'exercise_id') not in ('string', 'null')
        )
        or pg_catalog.jsonb_typeof(v_exercise -> 'name') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_exercise -> 'target_muscle') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_exercise -> 'section') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_exercise -> 'order') is distinct from 'number'
        or pg_catalog.jsonb_typeof(v_exercise -> 'target_sets') is distinct from 'number'
        or pg_catalog.jsonb_typeof(v_exercise -> 'target_value') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_exercise -> 'tracking_type') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_exercise -> 'weight_unit') is distinct from 'string'
        or (
          v_exercise -> 'rest_seconds' is not null
          and pg_catalog.jsonb_typeof(v_exercise -> 'rest_seconds') not in ('number', 'null')
        )
        or (
          v_exercise -> 'note' is not null
          and pg_catalog.jsonb_typeof(v_exercise -> 'note') not in ('string', 'null')
        )
      then
        raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
      end if;

      begin
        v_occurrence_id := nullif(v_exercise ->> 'id', '')::uuid;
        v_order := (v_exercise ->> 'order')::integer;
        v_target_sets := (v_exercise ->> 'target_sets')::integer;
        v_rest_seconds := case
          when v_exercise -> 'rest_seconds' is null
            or pg_catalog.jsonb_typeof(v_exercise -> 'rest_seconds') = 'null'
          then null
          else (v_exercise ->> 'rest_seconds')::integer
        end;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
      end;

      v_exercise_id := case
        when v_exercise -> 'exercise_id' is null
          or pg_catalog.jsonb_typeof(v_exercise -> 'exercise_id') = 'null'
        then null
        else pg_catalog.btrim(v_exercise ->> 'exercise_id')
      end;
      v_exercise_name := pg_catalog.btrim(coalesce(v_exercise ->> 'name', ''));
      v_target_muscle := pg_catalog.btrim(coalesce(v_exercise ->> 'target_muscle', ''));
      v_section := pg_catalog.lower(pg_catalog.btrim(coalesce(v_exercise ->> 'section', '')));
      v_target_value := pg_catalog.btrim(coalesce(v_exercise ->> 'target_value', ''));
      v_tracking_type := pg_catalog.lower(pg_catalog.btrim(coalesce(v_exercise ->> 'tracking_type', '')));
      v_weight_unit := pg_catalog.lower(pg_catalog.btrim(coalesce(v_exercise ->> 'weight_unit', '')));
      v_note := case
        when v_exercise -> 'note' is null
          or pg_catalog.jsonb_typeof(v_exercise -> 'note') = 'null'
        then null
        else pg_catalog.btrim(v_exercise ->> 'note')
      end;

      if v_occurrence_id is null
        or v_occurrence_id = any(v_seen_occurrence_ids)
        or (v_exercise_id is not null and pg_catalog.char_length(v_exercise_id) not between 1 and 160)
        or pg_catalog.char_length(v_exercise_name) not between 1 and 160
        or pg_catalog.char_length(v_target_muscle) not between 1 and 80
        or v_section not in ('warmup', 'main')
        or v_order < 0 or v_order > 999
        or v_order = any(v_seen_orders)
        or v_target_sets < 1 or v_target_sets > 100
        or pg_catalog.char_length(v_target_value) not between 1 and 80
        or v_tracking_type not in (
          'reps_weight', 'time_weight', 'time_only', 'cardio_hr', 'reps_only'
        )
        or v_weight_unit not in ('kg', 'lbs', 'plates', 'unitless')
        or (v_rest_seconds is not null and (v_rest_seconds <= 0 or v_rest_seconds > 3600))
        or (v_note is not null and pg_catalog.char_length(v_note) > 1000)
      then
        raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
      end if;


      -- JSONB key presence is deliberate: explicit null never falls back.
      -- Numeric validation precedes all DML and the smallint cast.
      if v_exercise ? 'cardioZone'
        and pg_catalog.jsonb_typeof(v_exercise -> 'cardioZone') <> 'null'
      then
        if pg_catalog.jsonb_typeof(v_exercise -> 'cardioZone') <> 'number' then
          raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
        end if;
        if (v_exercise ->> 'cardioZone')::numeric not between 1 and 5
          or (v_exercise ->> 'cardioZone')::numeric
            <> pg_catalog.trunc((v_exercise ->> 'cardioZone')::numeric)
        then
          raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
        end if;
      end if;

      v_seen_occurrence_ids := pg_catalog.array_append(v_seen_occurrence_ids, v_occurrence_id);
      v_seen_orders := pg_catalog.array_append(v_seen_orders, v_order);
    end loop;

    if v_exercise_count > 0 then
      for v_index in 0..(v_exercise_count - 1) loop
        if not (v_index = any(v_seen_orders)) then
          raise exception using errcode = '22023', message = 'ROUTINE_VALIDATION_FAILED';
        end if;
      end loop;
    end if;
  end loop;

  -- SECURITY DEFINER UUID preflight. These checks run with complete table
  -- visibility and intentionally return one generic conflict for every
  -- cross-owner or cross-graph collision. The routine row is locked only after
  -- its ownership has been established, serializing saves to an existing root.
  select routine.user_id
  into v_existing_routine_user_id
  from public.routines as routine
  where routine.id = v_routine_id;

  if found and v_existing_routine_user_id <> v_user_id then
    raise exception using
      errcode = '23505',
      message = 'ROUTINE_GRAPH_ID_CONFLICT';
  end if;

  if v_existing_routine_user_id is not null then
    perform 1
    from public.routines as routine
    where routine.id = v_routine_id
      and routine.user_id = v_user_id
    for update;
  end if;

  if exists (
    select 1
    from public.routine_days as routine_day
    join public.routines as routine
      on routine.id = routine_day.routine_id
    where routine_day.id = any(v_seen_day_ids)
      and (
        routine.user_id <> v_user_id
        or routine_day.routine_id <> v_routine_id
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'ROUTINE_GRAPH_ID_CONFLICT';
  end if;

  if exists (
    select 1
    from public.planned_exercises as planned_exercise
    join public.routine_days as routine_day
      on routine_day.id = planned_exercise.routine_day_id
    join public.routines as routine
      on routine.id = routine_day.routine_id
    where planned_exercise.id = any(v_seen_occurrence_ids)
      and (
        routine.user_id <> v_user_id
        or routine_day.routine_id <> v_routine_id
        or not (routine_day.id = any(v_seen_day_ids))
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'ROUTINE_GRAPH_ID_CONFLICT';
  end if;

  -- Keep exactly one active routine per authenticated owner. Ownership is never
  -- accepted from the payload; every row uses auth.uid().
  update public.routines
  set is_active = false
  where user_id = v_user_id
    and id <> v_routine_id
    and is_active;

  insert into public.routines as existing_routine (id, user_id, name, is_active)
  values (v_routine_id, v_user_id, v_routine_name, true)
  on conflict (id) do update
    set name = excluded.name,
        is_active = true
    where existing_routine.user_id = v_user_id;

  if not found then
    raise exception using
      errcode = '23505',
      message = 'ROUTINE_GRAPH_ID_CONFLICT';
  end if;

  -- Full child replacement is atomic and reuses the same caller-supplied UUIDs.
  -- Any validation, RLS, constraint, or insert failure rolls this entire function
  -- call back, including these deletes.
  delete from public.routine_days
  where routine_id = v_routine_id;

  for v_day in
    select value from pg_catalog.jsonb_array_elements(v_days)
  loop
    v_day_id := (v_day ->> 'id')::uuid;
    v_weekday := pg_catalog.lower(v_day ->> 'weekday');
    v_title := pg_catalog.btrim(v_day ->> 'title');
    v_kind := pg_catalog.lower(v_day ->> 'kind');

    insert into public.routine_days (
      id,
      routine_id,
      day_name,
      short_day,
      type,
      title
    ) values (
      v_day_id,
      v_routine_id,
      pg_catalog.initcap(v_weekday),
      pg_catalog.upper(pg_catalog.left(v_weekday, 1)),
      v_kind,
      v_title
    );

    for v_exercise in
      select value from pg_catalog.jsonb_array_elements(v_day -> 'exercises')
    loop
      v_occurrence_id := (v_exercise ->> 'id')::uuid;
      v_exercise_id := case
        when v_exercise -> 'exercise_id' is null
          or pg_catalog.jsonb_typeof(v_exercise -> 'exercise_id') = 'null'
        then null
        else pg_catalog.btrim(v_exercise ->> 'exercise_id')
      end;
      v_exercise_name := pg_catalog.btrim(v_exercise ->> 'name');
      v_target_muscle := pg_catalog.btrim(v_exercise ->> 'target_muscle');
      v_section := pg_catalog.lower(v_exercise ->> 'section');
      v_order := (v_exercise ->> 'order')::integer;
      v_target_sets := (v_exercise ->> 'target_sets')::integer;
      v_target_value := pg_catalog.btrim(v_exercise ->> 'target_value');
      v_tracking_type := pg_catalog.lower(v_exercise ->> 'tracking_type');
      v_weight_unit := pg_catalog.lower(v_exercise ->> 'weight_unit');
      v_rest_seconds := case
        when v_exercise -> 'rest_seconds' is null
          or pg_catalog.jsonb_typeof(v_exercise -> 'rest_seconds') = 'null'
        then null
        else (v_exercise ->> 'rest_seconds')::integer
      end;
      v_note := case
        when v_exercise -> 'note' is null
          or pg_catalog.jsonb_typeof(v_exercise -> 'note') = 'null'
        then null
        else pg_catalog.btrim(v_exercise ->> 'note')
      end;


      v_cardio_zone := case
        when v_exercise ? 'cardioZone'
          then (v_exercise ->> 'cardioZone')::numeric::smallint
        else public.routine_legacy_cardio_zone_v1(
          v_exercise_id, v_target_value, v_note
        )
      end;

      insert into public.planned_exercises (
        id,
        routine_day_id,
        exercise_id,
        name,
        type,
        tracking_style,
        weight_unit,
        target_sets,
        target_reps,
        rest_seconds,
        cardio_zone,
        note,
        is_warmup,
        order_index
      ) values (
        v_occurrence_id,
        v_day_id,
        v_exercise_id,
        v_exercise_name,
        v_target_muscle,
        v_tracking_type,
        v_weight_unit,
        v_target_sets,
        v_target_value,
        v_rest_seconds,
        v_cardio_zone,
        v_note,
        v_section = 'warmup',
        v_order
      );
    end loop;
  end loop;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'routineId', v_routine_id
  );
exception
  when unique_violation then
    -- A UUID or unique-order race after preflight must remain non-enumerating.
    -- Raising from this block rolls the entire function statement back.
    raise exception using
      errcode = '23505',
      message = 'ROUTINE_GRAPH_ID_CONFLICT';
end;
$function$;


commit;
