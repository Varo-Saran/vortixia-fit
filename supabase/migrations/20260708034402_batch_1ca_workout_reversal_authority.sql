begin;

-- Preserve the original completion payload while storing a separate durable
-- reversal identity and result. The non-FK reversed_session_id intentionally
-- survives the hard deletion of the workout session.
alter table public.workout_completion_operations
  add column reversal_operation_id uuid,
  add column reversed_session_id uuid,
  add column reversal_result_payload jsonb;

create unique index workout_completion_operations_user_reversal_operation_idx
  on public.workout_completion_operations (user_id, reversal_operation_id)
  where reversal_operation_id is not null;

create unique index workout_completion_operations_user_reversed_session_idx
  on public.workout_completion_operations (user_id, reversed_session_id)
  where reversed_session_id is not null;

alter table public.workout_completion_operations
  add constraint workout_completion_operations_reversal_metadata_check
  check (
    (
      status = 'completed'
      and reversed_at is null
      and reversal_operation_id is null
      and reversed_session_id is null
      and reversal_result_payload is null
    )
    or
    (
      status = 'reversed'
      and reversed_at is not null
      and reversal_operation_id is not null
      and reversed_session_id is not null
      and reversal_result_payload is not null
      and pg_catalog.jsonb_typeof(reversal_result_payload) = 'object'
    )
  );

-- Reverse exactly one server-authoritative workout completion. This function
-- never accepts an XP amount or user ID, never infers XP from legacy session
-- data, and never reads or writes duel tables.
create or replace function public.reverse_workout_v1(
  p_operation_id uuid,
  p_workout_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing_operation_id uuid;
  v_existing_session_id uuid;
  v_existing_result jsonb;
  v_completion_operation_id uuid;
  v_completion_status text;
  v_completion_event_id uuid;
  v_xp_awarded integer;
  v_total_xp integer;
  v_result jsonb;
  v_rows_affected integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'WORKOUT_REVERSAL_AUTH_REQUIRED';
  end if;

  if p_operation_id is null
    or p_workout_session_id is null
    or p_operation_id = '00000000-0000-0000-0000-000000000000'::uuid
    or p_workout_session_id = '00000000-0000-0000-0000-000000000000'::uuid
  then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_VALIDATION_FAILED';
  end if;

  -- The namespaces keep operation and session locks distinct. The fixed lock
  -- order prevents duplicate or conflicting concurrent reversals.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
        || ':workout-reversal-operation:'
        || p_operation_id::text,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
        || ':workout-reversal-session:'
        || p_workout_session_id::text,
      0
    )
  );

  -- An identical operation returns its immutable stored result. Reusing the
  -- operation ID for another session is a terminal conflict.
  select
    operation.reversed_session_id,
    operation.reversal_result_payload
  into
    v_existing_session_id,
    v_existing_result
  from public.workout_completion_operations as operation
  where operation.user_id = v_user_id
    and operation.reversal_operation_id = p_operation_id
  for update;

  if found then
    if v_existing_session_id is distinct from p_workout_session_id then
      raise exception using
        errcode = '22023',
        message = 'WORKOUT_REVERSAL_OPERATION_CONFLICT';
    end if;

    return v_existing_result
      || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  -- A session can be reversed only once, even if a caller supplies another
  -- otherwise-valid operation ID.
  select
    operation.reversal_operation_id,
    operation.reversal_result_payload
  into
    v_existing_operation_id,
    v_existing_result
  from public.workout_completion_operations as operation
  where operation.user_id = v_user_id
    and operation.reversed_session_id = p_workout_session_id
  for update;

  if found then
    if v_existing_operation_id = p_operation_id then
      return v_existing_result
        || pg_catalog.jsonb_build_object('replayed', true);
    end if;

    raise exception using
      errcode = '22023',
      message = 'WORKOUT_ALREADY_REVERSED';
  end if;

  -- Scope ownership to auth.uid(). A missing and a cross-user session are
  -- deliberately indistinguishable to callers.
  perform 1
  from public.workout_sessions as session
  where session.id = p_workout_session_id
    and session.user_id = v_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'WORKOUT_NOT_FOUND';
  end if;

  select
    operation.operation_id,
    operation.status
  into
    v_completion_operation_id,
    v_completion_status
  from public.workout_completion_operations as operation
  where operation.user_id = v_user_id
    and operation.workout_session_id = p_workout_session_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_UNSUPPORTED';
  end if;

  if v_completion_status <> 'completed' then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_ALREADY_REVERSED';
  end if;

  select
    event.id,
    event.amount
  into
    v_completion_event_id,
    v_xp_awarded
  from public.xp_events as event
  where event.user_id = v_user_id
    and event.event_type = 'workout_completion'
    and event.source_id = v_completion_operation_id
    and event.workout_session_id = p_workout_session_id
    and event.amount > 0
    and event.reverses_event_id is null
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_UNSUPPORTED';
  end if;

  -- Fail closed if ledger state and operation state disagree.
  perform 1
  from public.xp_events as reversal
  where reversal.reverses_event_id = v_completion_event_id
  for update;

  if found then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_ALREADY_REVERSED';
  end if;

  update public.users
  set total_xp = total_xp - v_xp_awarded
  where id = v_user_id
    and total_xp is not null
    and total_xp >= v_xp_awarded
  returning total_xp into v_total_xp;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_XP_INVALID';
  end if;

  insert into public.xp_events (
    user_id,
    event_type,
    source_id,
    workout_session_id,
    amount,
    reverses_event_id
  ) values (
    v_user_id,
    'workout_reversal',
    p_operation_id,
    p_workout_session_id,
    -v_xp_awarded,
    v_completion_event_id
  );

  v_result := pg_catalog.jsonb_build_object(
    'success', true,
    'operationId', p_operation_id,
    'sessionId', p_workout_session_id,
    'deleted', true,
    'xpReversed', v_xp_awarded,
    'totalXp', v_total_xp,
    'replayed', false
  );

  update public.workout_completion_operations
  set status = 'reversed',
      reversed_at = pg_catalog.clock_timestamp(),
      reversal_operation_id = p_operation_id,
      reversed_session_id = p_workout_session_id,
      reversal_result_payload = v_result
  where user_id = v_user_id
    and operation_id = v_completion_operation_id
    and status = 'completed';

  get diagnostics v_rows_affected = row_count;
  if v_rows_affected <> 1 then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_STATE_CONFLICT';
  end if;

  delete from public.workout_sessions
  where id = p_workout_session_id
    and user_id = v_user_id;

  get diagnostics v_rows_affected = row_count;
  if v_rows_affected <> 1 then
    raise exception using
      errcode = '22023',
      message = 'WORKOUT_REVERSAL_STATE_CONFLICT';
  end if;

  return v_result;
end;
$function$;

-- Keep this mutation available only to authenticated user context. The
-- cookie-backed server route will call it without a service-role client.
revoke execute on function public.reverse_workout_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reverse_workout_v1(uuid, uuid)
  to authenticated;

-- increment_user_xp execution and direct workout table grants intentionally
-- remain unchanged until the undo/reward client cutovers are complete.
commit;
