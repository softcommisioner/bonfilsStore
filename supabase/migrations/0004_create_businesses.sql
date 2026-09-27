-- =============================================================================
-- 0004_create_businesses
--
-- Creates the BONFILS STORE `businesses` table (sellers / shops). Creates
-- nothing else and does not modify public.profiles, public.roles or
-- public.user_roles.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.businesses (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        references public.profiles (id) on delete set null,
  business_name text        not null,
  description   text        not null default '',
  phone         text        not null default '',
  email         text        not null default '',
  address       text        not null default '',
  status        text        not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint businesses_name_not_blank check (char_length(btrim(business_name)) between 1 and 200),
  -- Phone format is deliberately unconstrained: international numbering varies.
  constraint businesses_phone_length     check (char_length(phone) <= 32),
  constraint businesses_address_length   check (char_length(address) <= 500),
  -- Blank is allowed (a shop may have no public email yet); anything present
  -- must look like an address. Same shape as the profiles email check.
  constraint businesses_email_format     check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint businesses_status_valid     check (status in ('active', 'inactive', 'pending'))
);

-- Postgres does not index the referencing side of a foreign key, and
-- "shops owned by this profile" is the primary seller-dashboard lookup.
create index if not exists businesses_owner_id_idx
  on public.businesses (owner_id);

-- Keeps updated_at honest. This duplicates the trigger function from 0001
-- rather than sharing it, so each migration stays self-contained and immutable
-- once applied. Worth consolidating into one public.touch_updated_at() if the
-- schema is ever rebuilt from scratch.
create or replace function public.set_businesses_updated_at()
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

drop trigger if exists businesses_set_updated_at on public.businesses;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row
  execute function public.set_businesses_updated_at();

-- Secure default, consistent with 0001-0003. RLS enabled with no policies
-- means anon and authenticated see zero rows and can write nothing.
alter table public.businesses enable row level security;

commit;
