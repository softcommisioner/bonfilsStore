-- =============================================================================
-- 0001_create_profiles
--
-- Creates the BONFILS STORE `profiles` table and nothing else.
-- Idempotent: safe to re-run.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

-- gen_random_uuid() lives in pgcrypto on older Postgres; built in from 13.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id         uuid        primary key default gen_random_uuid(),
  full_name  text        not null,
  email      text        not null,
  phone      text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A name of only spaces should not pass.
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  -- Deliberately permissive: rejects obvious rubbish, does not attempt to
  -- validate deliverability.
  constraint profiles_email_format     check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- No format check on phone: international numbering varies too much.
  constraint profiles_phone_length     check (char_length(phone) <= 32)
);

-- Case-insensitive uniqueness, matching the existing convention in
-- server/db/schema.ts (users_email_lower_key). Keeps Seller, Super Admin and
-- customer emails from colliding on capitalisation.
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

-- Keeps updated_at honest instead of trusting every caller to remember it.
-- This adds one trigger function (not a table).
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- Secure default. With RLS enabled and no policies yet, the anon and
-- authenticated roles see zero rows and can write nothing, so this table is
-- not reachable through PostgREST with the browser anon key. Access policies
-- are a separate, deliberate step.
alter table public.profiles enable row level security;

commit;
