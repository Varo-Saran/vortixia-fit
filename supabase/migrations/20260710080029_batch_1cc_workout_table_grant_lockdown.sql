begin;

-- Workout completion and reversal now run through authenticated,
-- server-authoritative SECURITY DEFINER functions. Remove every inherited or
-- browser-facing table privilege before explicitly restoring required reads.
-- service_role is intentionally excluded and remains unchanged.
revoke all privileges on table public.workout_sessions
  from PUBLIC, anon, authenticated;

revoke all privileges on table public.workout_sets
  from PUBLIC, anon, authenticated;

-- Authenticated users still read their RLS-visible workout history for the
-- dashboard, analytics, history, and social indicators.
grant select on table public.workout_sessions
  to authenticated;

grant select on table public.workout_sets
  to authenticated;

-- Temporary compatibility grant: the current push cron route uses the
-- cookie-backed anon-key client and directly reads workout_sessions for
-- inactivity and CNS-recovery checks when no Supabase user session exists.
-- Existing RLS remains the row boundary. workout_sets is not queried by that
-- route and intentionally receives no anon grant. Remove this grant after the
-- cron path moves to a trusted server-side data boundary.
grant select on table public.workout_sessions
  to anon;

commit;
