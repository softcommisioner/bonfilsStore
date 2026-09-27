-- =============================================================================
-- 0002_create_roles
--
-- Creates the BONFILS STORE `roles` reference table and seeds the four roles
-- the application recognises. Creates nothing else and does not touch
-- public.profiles.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.roles (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now(),

  constraint roles_name_key    unique (name),
  constraint roles_name_not_blank check (char_length(btrim(name)) between 1 and 64)
);

-- Seed the four roles the app checks for. ON CONFLICT makes this re-runnable.
-- No CHECK constraint restricts name to these four values: the point of a
-- lookup table is that a new role can be added later without altering it.
insert into public.roles (name) values
  ('customer'),
  ('seller'),
  ('staff'),
  ('super_admin')
on conflict (name) do nothing;

-- Secure default, consistent with 0001. RLS enabled with no policies means the
-- anon and authenticated roles see zero rows and can write nothing, so this
-- table is not readable through PostgREST with the browser anon key. Granting
-- read access to this reference data is a separate, deliberate step.
alter table public.roles enable row level security;

commit;
