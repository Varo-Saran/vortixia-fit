begin;

-- =============================================================================
-- ROUTINE CONFIGURATION RESET — DESTRUCTIVE, REVIEW BEFORE APPLYING
-- =============================================================================
-- This is the only data-deleting statement executed by the migration itself.
-- Deleting routines cascades only to routine_days and planned_exercises through
-- their existing foreign keys. The save RPC defined later contains its reviewed
-- atomic child-replacement DELETE, but creating the function does not execute it.
-- This migration contains no statement against any workout history, XP ledger,
-- user, profile, or settings table.
--
-- DO NOT APPLY THIS MIGRATION UNTIL THE ROUTINE-ONLY RESET IS APPROVED.
delete from public.routines;

-- Routine identity and ownership hardening.
alter table public.routines
  alter column user_id set not null,
  alter column is_active set not null;

alter table public.routines
  add constraint routines_name_valid
  check (
    name = pg_catalog.btrim(name)
    and pg_catalog.char_length(name) between 1 and 80
  );

create index routines_user_idx
  on public.routines (user_id);

create unique index routines_one_active_per_user_idx
  on public.routines (user_id)
  where is_active;

-- A routine remains a fixed Monday-Sunday plan. The existing type column now
-- stores the structured day kind; short_day remains a derived compatibility
-- field until a later physical-column cleanup.
alter table public.routine_days
  alter column routine_id set not null;

alter table public.routine_days
  add constraint routine_days_weekday_valid
  check (day_name in (
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  )),
  add constraint routine_days_short_day_valid
  check (short_day = pg_catalog.upper(pg_catalog.left(day_name, 1))),
  add constraint routine_days_kind_valid
  check (type in ('training', 'rest', 'recovery')),
  add constraint routine_days_title_valid
  check (
    title = pg_catalog.btrim(title)
    and pg_catalog.char_length(title) between 1 and 60
  );

create unique index routine_days_one_weekday_idx
  on public.routine_days (routine_id, day_name);

-- Planned-exercise additions required for stable catalog identity, exact unit
-- round-tripping, and optional per-exercise rest overrides.
alter table public.planned_exercises
  add column exercise_id text,
  add column weight_unit text,
  add column rest_seconds integer;

alter table public.planned_exercises
  alter column routine_day_id set not null,
  alter column is_warmup set not null,
  alter column weight_unit set not null;

alter table public.planned_exercises
  add constraint planned_exercises_catalog_id_valid
  check (
    exercise_id is null
    or (
      exercise_id = pg_catalog.btrim(exercise_id)
      and pg_catalog.char_length(exercise_id) between 1 and 160
    )
  ),
  add constraint planned_exercises_name_valid
  check (
    name = pg_catalog.btrim(name)
    and pg_catalog.char_length(name) between 1 and 160
  ),
  add constraint planned_exercises_target_muscle_valid
  check (
    type = pg_catalog.btrim(type)
    and pg_catalog.char_length(type) between 1 and 80
  ),
  add constraint planned_exercises_tracking_style_valid
  check (tracking_style in (
    'reps_weight',
    'time_weight',
    'time_only',
    'cardio_hr',
    'reps_only'
  )),
  add constraint planned_exercises_weight_unit_valid
  check (weight_unit in ('kg', 'lbs', 'plates', 'unitless')),
  add constraint planned_exercises_target_sets_valid
  check (target_sets between 1 and 100),
  add constraint planned_exercises_target_value_valid
  check (
    target_reps = pg_catalog.btrim(target_reps)
    and pg_catalog.char_length(target_reps) between 1 and 80
  ),
  add constraint planned_exercises_rest_seconds_valid
  check (
    rest_seconds is null
    or (rest_seconds > 0 and rest_seconds <= 3600)
  ),
  add constraint planned_exercises_order_index_valid
  check (order_index between 0 and 999),
  add constraint planned_exercises_note_valid
  check (note is null or pg_catalog.char_length(note) <= 1000);

create unique index planned_exercises_day_order_idx
  on public.planned_exercises (routine_day_id, order_index);

-- Browser clients may read their owner-scoped graph through RLS, but all writes
-- cross the single validated SECURITY DEFINER boundary below. Remove inherited
-- and direct table privileges first, then restore SELECT only to authenticated.
revoke all privileges on table public.routines
  from PUBLIC, anon, authenticated;
revoke all privileges on table public.routine_days
  from PUBLIC, anon, authenticated;
revoke all privileges on table public.planned_exercises
  from PUBLIC, anon, authenticated;

grant select on table public.routines to authenticated;
grant select on table public.routine_days to authenticated;
grant select on table public.planned_exercises to authenticated;

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

-- Match the existing protected workout-authority convention. The definer must
-- be a reviewed database owner capable of complete UUID visibility and writes.
alter function public.save_active_routine_v1(jsonb) owner to postgres;

revoke execute on function public.save_active_routine_v1(jsonb)
  from PUBLIC, anon;

grant execute on function public.save_active_routine_v1(jsonb)
  to authenticated;

commit;
