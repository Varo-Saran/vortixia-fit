begin;

-- Batch 1C-0 closes browser writes to protected public.users fields while
-- preserving the profile, preference, readiness, and notification flows used
-- by the current application.
--
-- Execution of increment_user_xp is intentionally not revoked here because
-- workout undo and reward claims have not yet moved to server-authoritative
-- mutation paths. The deferred pending-security migration remains untouched
-- and must not be applied as part of this batch.

-- Remove table-wide browser write privileges.
revoke insert, update on table public.users
  from PUBLIC, anon, authenticated;

-- Permit authenticated profile bootstrap using database defaults for
-- server-owned fields.
grant insert (
  id,
  username,
  full_name,
  avatar_url
) on table public.users
  to authenticated;

-- Permit only currently shipped profile, preference, readiness, and
-- notification-state updates.
grant update (
  username,
  full_name,
  weight_unit,
  height_unit,
  time_format,
  notify_workouts,
  notify_social,
  notify_inactivity,
  cns_readiness,
  timezone,
  read_notifications,
  dismissed_notifications
) on table public.users
  to authenticated;

-- Lock resolution without revoking the legacy RPC yet.
alter function public.increment_user_xp(uuid, integer)
  set search_path = pg_catalog, public;

commit;
