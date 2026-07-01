begin;

-- The existing SECURITY DEFINER function accepts arbitrary user IDs and XP
-- values. Keep it available only to the server-only service role until a
-- server-authoritative XP award flow replaces it.
revoke execute on function public.increment_user_xp(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.increment_user_xp(uuid, integer)
  to service_role;

-- Resolve mutable search_path warnings without changing function behavior.
alter function public.increment_user_xp(uuid, integer)
  set search_path = pg_catalog, public;
alter function public.get_users_needing_reminders()
  set search_path = pg_catalog, public;

-- Remove broad client writes, then restore only the fields used by legitimate
-- profile, preference, notification-state, and readiness flows. RLS continues
-- to restrict these operations to the authenticated user's own row.
revoke insert, update on table public.users from anon, authenticated;

grant insert (id, username, full_name, avatar_url)
  on table public.users to authenticated;

grant update (
  username,
  full_name,
  avatar_url,
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
) on table public.users to authenticated;

commit;
