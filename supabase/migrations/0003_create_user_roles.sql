-- =============================================================================
-- 0003_create_user_roles
--
-- Creates the BONFILS STORE `user_roles` junction table, linking a profile to
-- the roles it holds. Creates nothing else and does not modify public.profiles
-- or public.roles.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles and 0002_create_roles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.user_roles (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  role_id    uuid        not null,
  created_at timestamptz not null default now(),

  -- A profile cannot hold the same role twice. This also serves as the
  -- supporting index for "which roles does this user have?", since user_id is
  -- the leading column.
  constraint user_roles_user_role_key unique (user_id, role_id),

  -- Deleting a profile or a role removes its assignments. Note the
  -- consequence: deleting the super_admin role row would silently strip admin
  -- rights from every holder, so treat that row as permanent.
  constraint user_roles_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,
  constraint user_roles_role_id_fkey foreign key (role_id)
    references public.roles (id) on delete cascade
);

-- The unique constraint above cannot answer the reverse question, "which users
-- hold this role?". That is exactly the shape of the super-admin check, so
-- index role_id on its own.
create index if not exists user_roles_role_id_idx
  on public.user_roles (role_id);

-- Secure default, consistent with 0001 and 0002. No policies yet, so anon and
-- authenticated see zero rows and can write nothing. This table is the
-- authorization mapping, so exposing it before policies exist would be the
-- most dangerous of the three to leak.
alter table public.user_roles enable row level security;

commit;
