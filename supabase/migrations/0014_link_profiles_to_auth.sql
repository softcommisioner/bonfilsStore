-- =============================================================================
-- 0014_link_profiles_to_auth
--
-- BRIDGE: profiles.id -> auth.users.id
--
-- This is the migration the whole security model depends on, and it is the one
-- structural defect carried since 0001.
--
-- 0001 created public.profiles with a STANDALONE uuid primary key
-- (default gen_random_uuid()) and NO reference to auth.users. Every table that
-- points at a customer does so via profiles.id:
--
--   carts.user_id, orders.user_id, china_requests.customer_id,
--   china_requests.assigned_staff_id, notifications.user_id,
--   user_roles.profile_id, businesses.owner_id
--
-- Those are correct as REFERENCES. The problem is the reverse direction: a
-- row-level-security policy receives auth.uid() -- the id from the JWT, which
-- belongs to the auth.users identity space -- and compares it to a
-- profiles.id, which was generated independently. The two are different UUIDs
-- for the same human, so a policy written as
--
--     using (customer_id = auth.uid())
--
-- matches NOTHING, ever. Silently. Every customer would see zero rows, and
-- because RLS filters rather than errors, it reads as "no data" rather than
-- "broken policy" -- which is exactly the kind of failure that ships.
--
-- Fix: add a nullable one-to-one bridge column. Deliberately additive -- it
-- does not rewrite profiles.id, so nothing that already references it breaks.
--
-- WHY NOT JUST SET profiles.id = auth.users.id
--   That is the more common Supabase layout and it would make policies
--   trivially simple (customer_id = auth.uid()). It is NOT chosen here
--   because the application already issues TEXT user ids (USR-STAFF-001,
--   USR-CUS-0001) and has 3 existing users keyed that way. Dropping
--   profiles.id in favour of auth.users.id means an identity migration, not a
--   schema change, and that is a larger decision than this phase should make
--   unilaterally. The bridge gets RLS working today and is compatible with
--   collapsing the two ids later.
--
-- Run AFTER 0001_create_profiles.
-- NOT YET EXECUTED.
-- =============================================================================

begin;

-- Nullable: profiles rows that pre-date Supabase Auth (seeded, staff-created,
-- imported) have no auth user and must remain valid.
alter table public.profiles
  add column if not exists auth_user_id uuid;

-- Postgres permits multiple NULLs in a unique index, so existing unlinked
-- profiles are unaffected. This is what makes the link one-to-one.
create unique index if not exists profiles_auth_user_id_key
  on public.profiles (auth_user_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_auth_user_id_fkey'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users (id)
      on delete cascade;
  end if;
end
$$;

-- Covers the reverse lookup every policy helper performs:
--   select id from profiles where auth_user_id = auth.uid()
-- Without this it is a seq scan on a table that grows with every signup.
create index if not exists profiles_auth_user_id_lookup_idx
  on public.profiles (auth_user_id, id);

comment on column public.profiles.auth_user_id is
  'Supabase Auth user this profile belongs to. NULL for profiles predating '
  'Supabase Auth. RLS policies resolve auth.uid() through this column.';

commit;

-- =============================================================================
-- BACKFILL (run once, AFTER real users exist in auth.users)
--
-- Left commented out deliberately: it matches on email, and there is no data
-- to match until signup actually happens. Run it when you have users, and
-- CHECK the count before trusting it.
--
--   update public.profiles p
--      set auth_user_id = u.id
--     from auth.users u
--    where p.auth_user_id is null
--      and lower(p.email) = lower(u.email);
--
--   select count(*) filter (where auth_user_id is null) as unlinked,
--          count(*) as total
--     from public.profiles;
--
-- Unlinked profiles cannot create or view anything under RLS. That is the
-- intended fail-closed behaviour, but it will look like a bug to a staff
-- member whose account has not been linked yet -- check this count first when
-- someone reports "I cannot see my requests".
--
-- ON DELETE CASCADE means deleting an auth user deletes the profile, which
-- cascades to carts and notifications, and SET NULLs orders,
-- china_requests and businesses. That is a coherent account-deletion story.
-- It is also irreversible: the china_requests rows survive as orphans with no
-- customer. Acceptable for sourcing requests (they are business records) but
-- confirm it matches your retention policy.
-- =============================================================================
