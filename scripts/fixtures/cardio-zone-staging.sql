-- Synthetic, disposable PostgreSQL fixture for Supabase routine-authority tests.
-- Never apply this fixture to a linked/remote database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $auth$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$auth$;
grant usage on schema public, auth to anon, authenticated, service_role;

create table public.users (id uuid primary key);
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  is_active boolean default false,
  created_at timestamptz default now()
);
create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid references public.routines(id) on delete cascade,
  day_name text not null,
  short_day text not null,
  type text not null,
  title text not null,
  created_at timestamptz default now()
);
create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid references public.routine_days(id) on delete cascade,
  name text not null,
  type text not null,
  tracking_style text not null,
  target_sets integer not null,
  target_reps text not null,
  note text,
  is_warmup boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz default now()
);

alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.planned_exercises enable row level security;
-- Match the existing Production ownership policy structure. D1 revokes browser
-- DML separately; an ALL policy does not grant table privileges.
create policy "Users can manage their own routines" on public.routines
  using (auth.uid() = user_id);
create policy "Users can manage their own routine days" on public.routine_days
  using (exists (select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()));
create policy "Users can manage their own planned exercises" on public.planned_exercises
  using (exists (select 1 from public.routine_days d
    join public.routines r on r.id = d.routine_id
    where d.id = routine_day_id and r.user_id = auth.uid()));
grant all on public.routines, public.routine_days, public.planned_exercises
  to anon, authenticated, service_role;

-- Sentinel history tables demonstrate that migration/RPC never touch them.
create table public.workout_sessions (id integer primary key);
create table public.workout_sets (id integer primary key);
create table public.workout_completion_operations (id integer primary key);
create table public.xp_events (id integer primary key);
insert into public.workout_sessions values (1);
insert into public.workout_sets values (1);
insert into public.workout_completion_operations values (1);
insert into public.xp_events values (1);
