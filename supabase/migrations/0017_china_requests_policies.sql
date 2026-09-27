-- =============================================================================
-- 0017_china_requests_policies
--
-- Row Level Security for the China sourcing workflow.
--
-- This is what makes "customers can view only their own requests" a rule the
-- DATABASE enforces, rather than a filter the application remembers to apply.
-- The application is not a security boundary: any client holding an anon key
-- can call PostgREST directly and bypass Express entirely.
--
-- Depends on 0014 (profiles.auth_user_id). Without that bridge, auth.uid()
-- and profiles.id are unrelated UUIDs and every policy here matches zero rows
-- -- silently, with no error.
--
-- Creates no table. Alters no data.
-- Run AFTER 0014, 0015, 0016.
-- NOT YET EXECUTED.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions
--
-- SECURITY DEFINER + SET search_path = '' is the standard hardening pair:
--   - DEFINER so the lookup succeeds without recursing into the policies on
--     the tables it reads. A SECURITY INVOKER function reading a
--     RLS-protected table from inside that table's own policy loops forever.
--   - search_path = '' so no caller-controlled schema can shadow
--     current_profile_id() or redirect auth.uid() to a malicious object.
--
-- EXECUTE is revoked from PUBLIC below. Left public, any role could call
-- these and enumerate staff membership.
-- ---------------------------------------------------------------------------

begin;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.profiles p
   where p.auth_user_id = auth.uid()
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.name
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
   where p.auth_user_id = auth.uid()
   order by case r.name when 'super_admin' then 0 when 'staff' then 1 else 2 end
   limit 1
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_profile_role() in ('staff','super_admin'), false)
$$;

revoke execute on function public.current_profile_id()   from public;
revoke execute on function public.current_profile_role() from public;
revoke execute on function public.is_staff()            from public;
grant  execute on function public.current_profile_id()   to authenticated, service_role;
grant  execute on function public.current_profile_role() to authenticated, service_role;
grant  execute on function public.is_staff()            to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- china_requests policies
--
-- customer_id is NULLABLE (0012, ON DELETE SET NULL), so a customer whose
-- profile is deleted leaves an orphaned request. "customer_id =
-- current_profile_id()" is NULL-safe in the right direction: NULL never
-- equals a non-NULL id, so orphans are invisible to every customer and remain
-- visible to staff. That is the intended behaviour, not an oversight.
-- ---------------------------------------------------------------------------
drop policy if exists china_requests_select_own on public.china_requests;
create policy china_requests_select_own on public.china_requests
  for select to authenticated
  using (customer_id = public.current_profile_id() or public.is_staff());

drop policy if exists china_requests_insert_own on public.china_requests;
create policy china_requests_insert_own on public.china_requests
  for insert to authenticated
  with check (customer_id = public.current_profile_id() or public.is_staff());

-- UPDATE is permitted for the owner, but the trigger below immediately
-- restricts WHICH columns they may change. A policy cannot express
-- "this column but not that one", so the split is deliberate: policy decides
-- which ROWS, trigger decides which COLUMNS.
drop policy if exists china_requests_update_own on public.china_requests;
create policy china_requests_update_own on public.china_requests
  for update to authenticated
  using (customer_id = public.current_profile_id() or public.is_staff())
  with check (customer_id = public.current_profile_id() or public.is_staff());

-- Staff only. A sourcing request is a business record that may have led to a
-- purchase; letting a customer delete it would destroy the audit trail. Staff
-- keep DELETE for test data and correction.
drop policy if exists china_requests_delete_staff on public.china_requests;
create policy china_requests_delete_staff on public.china_requests
  for delete to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Column guard for owner updates
--
-- A customer may clarify a request. A customer may NOT advance its status,
-- assign staff, or set a quotation -- those are the commercial controls.
-- Without this trigger, the UPDATE policy above would let a customer mark
-- their own request PURCHASED.
-- ---------------------------------------------------------------------------
create or replace function public.guard_china_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_staff() then
    -- Staff additionally must not move a request backwards.
    if new.status is distinct from old.status then
      if public.china_request_status_rank(new.status)
           < public.china_request_status_rank(old.status) then
        raise exception
          'Illegal status transition % -> % for request %',
          old.status, new.status, old.request_number
          using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  if new.request_number    is distinct from old.request_number    then
    raise exception 'request_number is immutable'      using errcode = 'check_violation';
  end if;
  if new.customer_id       is distinct from old.customer_id       then
    raise exception 'customer_id is immutable'         using errcode = 'check_violation';
  end if;
  if new.status            is distinct from old.status            then
    raise exception 'Only staff can change status'     using errcode = 'check_violation';
  end if;
  if new.assigned_staff_id is distinct from old.assigned_staff_id then
    raise exception 'Only staff can assign a request'  using errcode = 'check_violation';
  end if;
  if new.quotation_amount  is distinct from old.quotation_amount  then
    raise exception 'Only staff can set a quotation'  using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists china_requests_guard_update on public.china_requests;

create trigger china_requests_guard_update
  before update on public.china_requests
  for each row
  execute function public.guard_china_request_update();

-- ---------------------------------------------------------------------------
-- china_request_images policies
--
-- Ownership is resolved through the parent request, not a column on the image
-- row, so an image cannot be re-pointed at another customer's request to gain
-- access to it.
-- ---------------------------------------------------------------------------
drop policy if exists china_request_images_select_own on public.china_request_images;
create policy china_request_images_select_own on public.china_request_images
  for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.china_requests r
       where r.id = china_request_images.request_id
         and r.customer_id = public.current_profile_id()
    )
  );

drop policy if exists china_request_images_insert_own on public.china_request_images;
create policy china_request_images_insert_own on public.china_request_images
  for insert to authenticated
  with check (
    public.is_staff()
    or exists (
      select 1 from public.china_requests r
       where r.id = china_request_images.request_id
         and r.customer_id = public.current_profile_id()
    )
  );

drop policy if exists china_request_images_delete_own on public.china_request_images;
create policy china_request_images_delete_own on public.china_request_images
  for delete to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.china_requests r
       where r.id = china_request_images.request_id
         and r.customer_id = public.current_profile_id()
    )
  );

commit;

-- =============================================================================
-- NOT DONE HERE, AND IT MATTERS
--
-- 1. NO SELECT POLICY ON profiles. profiles has RLS enabled with zero policies
--    (0001), so authenticated users cannot read their own profile, their name,
--    or their role. public.current_profile_id() works -- it is SECURITY
--    DEFINER and bypasses RLS -- but the UI cannot render "Signed in as ...".
--    Add a self-read policy:
--
--      create policy profiles_select_self on public.profiles
--        for select to authenticated
--        using (id = public.current_profile_id() or public.is_staff());
--
--    Deliberately not added unprompted: it widens who can read profile rows,
--    which is a decision, not a detail.
--
-- 2. NO POLICY ON roles / user_roles. is_staff() works via SECURITY DEFINER,
--    but staff UIs cannot list roles to render an assignment dropdown.
--
-- 3. ORDER MATTERS. 0016 enabled RLS on china_request_images before this file
--    created any policy, so between those two migrations the table is
--    deny-all. Harmless in a single push; worth knowing if these are applied
--    one at a time.
-- =============================================================================
