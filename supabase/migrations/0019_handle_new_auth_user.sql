-- =============================================================================
-- 0019_handle_new_auth_user
--
-- Populates public.profiles and public.user_roles when a new Supabase Auth
-- user signs up. Creates no table, alters no existing table, and modifies no
-- migration 0001-0018.
--
--   auth.users INSERT  ->  public.profiles  ->  public.user_roles ('customer')
--
-- This is the ONLY piece of the auth -> profile -> role flow that can be added
-- without changing the application. The existing Express authentication
-- (server/routes/auth.ts, sessions table, requireAuth) is untouched and keeps
-- working; this merely keeps the new Supabase schema in step for anyone who
-- signs up through Supabase Auth.
--
-- Run with:  supabase db push
-- Run AFTER 0014_link_profiles_to_auth (needs profiles.auth_user_id).
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Why SECURITY DEFINER is required here, and nowhere else
--
-- The trigger fires as the role that inserted into auth.users
-- (supabase_auth_admin), which has no INSERT privilege on public.profiles --
-- and cannot have one while RLS is enabled with no policies. SECURITY DEFINER
-- is therefore mandatory, not a convenience.
--
-- It is confined to this one function on purpose:
--   set search_path = ''  ->  no caller-controlled schema can shadow
--                              public.profiles or redirect a lookup.
--   every object is schema-qualified, because with an empty search_path an
--   unqualified name would fail to resolve.
--
-- It is NOT used to widen access anywhere else. No RLS policy is added, no
-- existing policy is weakened, and no grant is issued to anon or authenticated.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email      text;
  v_name       text;
  v_profile_id uuid;
  v_linked_to  uuid;   -- auth_user_id already on the email-matched profile
  v_role_id    uuid;
begin
  -- ---------------------------------------------------------------------------
  -- 0. Email must be present and must satisfy profiles_email_format
  --
  -- auth.users.email is NULLABLE, because Supabase permits phone-only signups.
  -- public.profiles.email is NOT NULL with a format CHECK, so a phone-only
  -- user has nothing valid to put here. Failing loudly beats inventing a
  -- placeholder address that would then collide with a real signup later.
  -- ---------------------------------------------------------------------------
  if new.email is null or btrim(new.email) = '' then
    raise exception
      'BONFILS: cannot create a profile for auth user % - no email address. '
      'Phone-only signups are not supported by public.profiles.', new.id
      using errcode = '23514';
  end if;

  v_email := lower(btrim(new.email));

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception
      'BONFILS: cannot create a profile for auth user % - email "%" is not a '
      'valid address.', new.id, new.email
      using errcode = '23514';
  end if;

  -- profiles.full_name is NOT NULL and profiles_full_name_length rejects an
  -- all-blank value, so a fallback is mandatory. Prefer the metadata the client
  -- supplies, then the local part of the address, and left(...,120) respects
  -- the CHECK's upper bound.
  v_name := coalesce(
              nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
              nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
              split_part(v_email, '@', 1),
              'Customer'
            );
  v_name := left(v_name, 120);

  -- ---------------------------------------------------------------------------
  -- 1. Already linked to this auth user -> idempotent, do not duplicate
  --
  -- Covers a re-run of the trigger and any future caller that reinserts.
  -- ---------------------------------------------------------------------------
  select p.id into v_profile_id
    from public.profiles p
   where p.auth_user_id = new.id;

  if v_profile_id is not null then
    -- profile already correct; fall through to the role step, which is itself
    -- idempotent.
    null;
  else
    -- -----------------------------------------------------------------------
    -- 2. Same email, different or absent auth user
    -- -----------------------------------------------------------------------
    select p.id, p.auth_user_id into v_profile_id, v_linked_to
      from public.profiles p
     where lower(p.email) = v_email
     order by p.id
     limit 1;

    if v_profile_id is not null then
      if v_linked_to is not null and v_linked_to <> new.id then
        -- FAIL SAFELY. This profile already belongs to a different Auth user.
        -- Reassigning it would silently hand one human's account, orders and
        -- sourcing requests to another, so the signup is refused instead.
        -- Deleting the stale auth.users row first is the intended remedy.
        raise exception
          'BONFILS: email "%" is already linked to a different auth user. '
          'Refusing to reassign profile %.', v_email, v_profile_id
          using errcode = '23505';
      end if;

      -- auth_user_id IS NULL: an existing profile with no Auth user. Link it
      -- rather than inserting a second row, which would violate
      -- profiles_email_lower_key. UPDATE fires profiles_set_updated_at
      -- (0001), so updated_at stays honest.
      update public.profiles
         set auth_user_id = new.id,
             -- only fill gaps; never overwrite a name already on the profile
             full_name  = case when btrim(full_name) = '' then v_name else full_name end,
             updated_at = now()
       where id = v_profile_id;
    else
      -- -----------------------------------------------------------------------
      -- 3. No profile for this email -> create one
      --
      -- No ON CONFLICT clause: any conflict here would mean a race we have not
      -- accounted for, and it should surface as an error rather than be
      -- swallowed. created_at / updated_at take the 0001 defaults.
      -- -----------------------------------------------------------------------
      insert into public.profiles (auth_user_id, full_name, email, phone)
      values (
        new.id,
        v_name,
        v_email,
        left(coalesce(new.phone, ''), 32)
      )
      returning id into v_profile_id;
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- 4. Assign the existing 'customer' role
  --
  -- The role id is resolved from public.roles by name, never hardcoded, so the
  -- four seeded roles (customer, seller, staff, super_admin) stay authoritative.
  --
  -- 'customer' is a literal INSIDE this function. No value from new.* or from
  -- raw_user_meta_data ever reaches this insert, which is what makes it
  -- structurally impossible for public registration to grant seller, staff or
  -- super_admin: a signup cannot influence the role name.
  --
  -- A missing 'customer' row is fatal rather than skipped. 0002 seeds it and
  -- 0003 warns that deleting a role silently strips it from every holder, so a
  -- silent skip here would create an account that RLS cannot see.
  -- ---------------------------------------------------------------------------
  select r.id into v_role_id
    from public.roles r
   where r.name = 'customer';

  if v_role_id is null then
    raise exception
      'BONFILS: role "customer" is missing from public.roles; '
      'cannot complete signup for auth user %.', new.id
      using errcode = '23514';
  end if;

  -- user_roles_user_role_key unique (user_id, role_id) makes this idempotent:
  -- re-firing the trigger cannot produce a duplicate assignment.
  insert into public.user_roles (user_id, role_id)
  values (v_profile_id, v_role_id)
  on conflict (user_id, role_id) do nothing;

  return new;
end;
$$;

-- Trigger functions are only ever invoked as triggers, so this is defence in
-- depth rather than a fix for an exposed path.
revoke execute on function public.handle_new_auth_user() from public;

-- Idempotent re-run: drop before create, as 0001 and 0008 already do.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

comment on function public.handle_new_auth_user() is
  'Creates or links public.profiles and assigns the customer role on '
  'auth.users INSERT. Never grants seller, staff or super_admin.';

commit;

-- =============================================================================
-- WHAT THIS DOES NOT DO, DELIBERATELY
--
-- 1. No RLS POLICY on profiles or user_roles. Both still have RLS enabled with
--    zero policies, so a browser client cannot read or write them. A newly
--    signed-up user therefore has a profile row and a role assignment, but
--    still cannot see them through PostgREST. That is unchanged from 0001-0018
--    and is a separate, deliberate step -- adding a self-read policy is how
--    profiles start being visible, and that decision is not this migration's
--    to make.
--
-- 2. The existing application is untouched. server/routes/auth.ts,
--    AuthViews.tsx, AuthContext.tsx, the sessions table and all 98
--    requireAuth/requireRole/requireAdmin call sites are exactly as they were.
--    This trigger only fires for signups that go through Supabase Auth.
--
-- 3. No email-conflict data is merged or rewritten beyond linking an
--    auth_user_id that was NULL. A profile already owned by another Auth user
--    causes signup to fail, never a reassignment.
--
-- 4. Nothing is deleted, and no existing role assignment is modified.
--
-- -----------------------------------------------------------------------------
-- VERIFY AFTER APPLYING (read-only)
--
-- -- the four seeded roles must still be intact
--   select name from public.roles order by name;
--
-- -- the trigger and function must exist
--   select tgname, tgrelid::regclass::text as on_table
--     from pg_trigger where not tgisinternal and tgname = 'on_auth_user_created';
--
--   select proname, prosecdef, proconfig::text
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and proname = 'handle_new_auth_user';
--
-- -- after one real signup, expect one linked profile and one customer role:
--   select p.id, p.email, p.auth_user_id, r.name as role
--     from public.profiles p
--     left join public.user_roles ur on ur.user_id = p.id
--     left join public.roles r on r.id = ur.role_id
--    order by p.created_at desc;
-- =============================================================================
