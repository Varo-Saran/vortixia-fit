begin;

-- No remaining application, database, Edge Function, or service-role caller
-- requires this legacy arbitrary-delta XP function. Leave it owner-only
-- temporarily before later removal.
revoke execute on function public.increment_user_xp(uuid, integer)
  from PUBLIC, anon, authenticated, service_role;

commit;
