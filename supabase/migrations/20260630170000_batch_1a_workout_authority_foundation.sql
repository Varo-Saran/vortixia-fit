begin;

-- Preserve legacy workout inserts while retaining routine context for the new
-- server-authoritative completion path.
alter table public.workout_sessions
  add column if not exists routine_name text not null default 'Workout';

alter table public.workout_sessions
  add constraint workout_sessions_routine_name_length
  check (char_length(btrim(routine_name)) between 1 and 120);

-- Completed operation records provide durable idempotency. No processing row
-- is committed: the transaction-level advisory lock serializes matching
-- operations, and this row is inserted only after every mutation succeeds.
create table public.workout_completion_operations (
  user_id uuid not null references public.users(id) on delete cascade,
  operation_id uuid not null,
  request_payload jsonb not null,
  result_payload jsonb not null,
  status text not null default 'completed'
    check (status in ('completed', 'reversed')),
  workout_session_id uuid
    references public.workout_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  primary key (user_id, operation_id),
  unique (workout_session_id),
  check (jsonb_typeof(request_payload) = 'object'),
  check (jsonb_typeof(result_payload) = 'object')
);

create index workout_completion_operations_user_created_idx
  on public.workout_completion_operations (user_id, created_at desc);

-- Append-only XP event source. Reversals are separate signed events and may
-- reference an earlier event; complete_workout_v1 only creates positive
-- workout_completion events.
create table public.xp_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'workout_completion',
      'workout_reversal',
      'reward_claim'
    )),
  source_id uuid not null,
  workout_session_id uuid
    references public.workout_sessions(id) on delete set null,
  amount integer not null
    check (amount <> 0 and amount between -100000 and 100000),
  reverses_event_id uuid references public.xp_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, source_id)
);

create index xp_events_user_created_idx
  on public.xp_events (user_id, created_at desc);

create index xp_events_workout_session_idx
  on public.xp_events (workout_session_id);

create unique index xp_events_one_reversal_idx
  on public.xp_events (reverses_event_id)
  where reverses_event_id is not null;

alter table public.workout_completion_operations enable row level security;
alter table public.xp_events enable row level security;

revoke all on table public.workout_completion_operations
  from public, anon, authenticated;
revoke all on table public.xp_events
  from public, anon, authenticated;

create or replace function public.complete_workout_v1(
  p_operation_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_routine_name text,
  p_sets jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_routine_name text;
  v_normalized_sets jsonb;
  v_request_payload jsonb;
  v_existing_request jsonb;
  v_existing_result jsonb;
  v_session_id uuid;
  v_total_sets integer;
  v_total_volume numeric;
  v_duration_minutes integer;
  v_xp_awarded integer;
  v_total_xp integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'WORKOUT_AUTH_REQUIRED';
  end if;

  if p_operation_id is null then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  if p_start_time is null
    or p_end_time is null
    or p_end_time < p_start_time
    or p_end_time - p_start_time > interval '24 hours'
    or p_end_time > pg_catalog.clock_timestamp() + interval '5 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  v_routine_name := coalesce(
    nullif(pg_catalog.btrim(p_routine_name), ''),
    'Workout'
  );

  if pg_catalog.char_length(v_routine_name) > 120 then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  if p_sets is null or pg_catalog.jsonb_typeof(p_sets) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  if pg_catalog.jsonb_array_length(p_sets) < 1
    or pg_catalog.jsonb_array_length(p_sets) > 200
  then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_sets) as raw_set(value)
    where pg_catalog.jsonb_typeof(raw_set.value) <> 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'exerciseName', pg_catalog.btrim(parsed."exerciseName"),
      'setNumber', parsed."setNumber",
      'weight', parsed.weight,
      'reps', parsed.reps,
      'weightUnit', pg_catalog.lower(coalesce(
        nullif(pg_catalog.btrim(parsed."weightUnit"), ''),
        'kg'
      )),
      'trackingType', pg_catalog.lower(coalesce(
        nullif(pg_catalog.btrim(parsed."trackingType"), ''),
        'reps_weight'
      )),
      'isWarmup', coalesce(parsed."isWarmup", false)
    ) order by raw_set.ordinality
  )
  into v_normalized_sets
  from pg_catalog.jsonb_array_elements(p_sets) with ordinality
    as raw_set(value, ordinality)
  cross join lateral pg_catalog.jsonb_to_record(raw_set.value) as parsed(
    "exerciseName" text,
    "setNumber" integer,
    weight numeric,
    reps integer,
    "weightUnit" text,
    "trackingType" text,
    "isWarmup" boolean
  );

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(v_normalized_sets) as normalized(
      "exerciseName" text,
      "setNumber" integer,
      weight numeric,
      reps integer,
      "weightUnit" text,
      "trackingType" text,
      "isWarmup" boolean
    )
    where normalized."exerciseName" is null
      or pg_catalog.char_length(normalized."exerciseName") < 1
      or pg_catalog.char_length(normalized."exerciseName") > 160
      or normalized."setNumber" is null
      or normalized."setNumber" < 1
      or normalized."setNumber" > 1000
      or normalized.weight is null
      or normalized.weight < 0
      or normalized.weight > 5000
      or normalized.reps is null
      or normalized.reps < 0
      or normalized.reps > 86400
      or normalized."weightUnit" not in ('kg', 'lbs', 'plates', 'unitless')
      or normalized."trackingType" not in (
        'reps_weight',
        'time_weight',
        'time_only',
        'cardio_hr',
        'reps_only'
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  v_request_payload := pg_catalog.jsonb_build_object(
    'startTimeEpochMicros',
      (extract(epoch from p_start_time) * 1000000)::bigint,
    'endTimeEpochMicros',
      (extract(epoch from p_end_time) * 1000000)::bigint,
    'routineName', v_routine_name,
    'sets', v_normalized_sets
  );

  -- Serialize matching user/operation pairs. A concurrent identical request
  -- waits for the first transaction, then observes its committed result. If
  -- the first transaction rolls back, the waiter safely performs the work.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text || ':' || p_operation_id::text,
      0
    )
  );

  select operation.request_payload, operation.result_payload
  into v_existing_request, v_existing_result
  from public.workout_completion_operations as operation
  where operation.user_id = v_user_id
    and operation.operation_id = p_operation_id;

  if found then
    if v_existing_request is distinct from v_request_payload then
      raise exception using
        errcode = '22023',
        message = 'WORKOUT_OPERATION_CONFLICT';
    end if;

    return v_existing_result
      || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  select
    pg_catalog.count(*)::integer,
    coalesce(pg_catalog.sum(normalized.weight * normalized.reps), 0)
  into v_total_sets, v_total_volume
  from pg_catalog.jsonb_to_recordset(v_normalized_sets) as normalized(
    "exerciseName" text,
    "setNumber" integer,
    weight numeric,
    reps integer,
    "weightUnit" text,
    "trackingType" text,
    "isWarmup" boolean
  );

  v_duration_minutes := pg_catalog.round(
    (extract(epoch from (p_end_time - p_start_time)) / 60.0)::numeric
  )::integer;

  v_xp_awarded := pg_catalog.round(
    (v_total_sets * 50)::numeric + (v_total_volume * 0.1)
  )::integer;

  if v_xp_awarded < 1 or v_xp_awarded > 100000 then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_VALIDATION_FAILED';
  end if;

  insert into public.workout_sessions (
    user_id,
    start_time,
    end_time,
    total_volume_kg,
    prs_broken,
    routine_name
  ) values (
    v_user_id,
    p_start_time,
    p_end_time,
    v_total_volume,
    0,
    v_routine_name
  )
  returning id into v_session_id;

  insert into public.workout_sets (
    session_id,
    exercise_name,
    set_number,
    weight,
    reps,
    weight_unit,
    tracking_type,
    is_warmup
  )
  select
    v_session_id,
    normalized."exerciseName",
    normalized."setNumber",
    normalized.weight,
    normalized.reps,
    normalized."weightUnit",
    normalized."trackingType",
    normalized."isWarmup"
  from pg_catalog.jsonb_to_recordset(v_normalized_sets) as normalized(
    "exerciseName" text,
    "setNumber" integer,
    weight numeric,
    reps integer,
    "weightUnit" text,
    "trackingType" text,
    "isWarmup" boolean
  );

  insert into public.xp_events (
    user_id,
    event_type,
    source_id,
    workout_session_id,
    amount
  ) values (
    v_user_id,
    'workout_completion',
    p_operation_id,
    v_session_id,
    v_xp_awarded
  );

  update public.users
  set total_xp = total_xp + v_xp_awarded
  where id = v_user_id
    and total_xp is not null
    and total_xp >= 0
  returning total_xp into v_total_xp;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_PROFILE_XP_INVALID';
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'success', true,
    'operationId', p_operation_id,
    'sessionId', v_session_id,
    'replayed', false,
    'totalSets', v_total_sets,
    'totalVolume', v_total_volume,
    'durationMinutes', v_duration_minutes,
    'xpAwarded', v_xp_awarded,
    'totalXp', v_total_xp
  );

  insert into public.workout_completion_operations (
    user_id,
    operation_id,
    request_payload,
    result_payload,
    status,
    workout_session_id
  ) values (
    v_user_id,
    p_operation_id,
    v_request_payload,
    v_result,
    'completed',
    v_session_id
  );

  return v_result;
end;
$function$;

revoke execute on function public.complete_workout_v1(
  uuid, timestamptz, timestamptz, text, jsonb
) from public, anon;

grant execute on function public.complete_workout_v1(
  uuid, timestamptz, timestamptz, text, jsonb
) to authenticated;

commit;
