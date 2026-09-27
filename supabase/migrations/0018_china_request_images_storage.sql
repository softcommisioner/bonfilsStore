-- =============================================================================
-- 0018_china_request_images_storage
--
-- Supabase Storage bucket and access policies for sourcing request images.
--
-- Storage, not the Vercel filesystem. This is not a preference. The Vercel
-- filesystem is ephemeral and per-instance: a file written during a request
-- is invisible to the next instance and gone after a cold start or deploy.
-- Anything a customer uploads and expects to still exist tomorrow must be in
-- Storage or in Postgres.
--
-- Depends on 0014 (auth bridge) and 0017 (is_staff() helper).
-- Creates one bucket and four policies. No tables, no application data.
-- NOT YET EXECUTED.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- The bucket
--
-- public = false, deliberately. These are customers' reference photos of
-- sourcing requirements. They are served through short-lived signed URLs, so
-- an unguessable path is not the control -- the storage.objects policies are.
-- A public bucket would make every URL permanent and shareable, which is not
-- what "customers can view only their own requests" means.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'china-request-images',
  'china-request-images',
  false,
  8388608,  -- 8 MiB per file
  array ['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit     = excluded.file_size_limit,
       allowed_mime_types  = excluded.allowed_mime_types;

-- SVG is deliberately excluded. It is a script-bearing document format; an
-- SVG served from your own domain can execute JavaScript against a user who
-- views it. If product reference images ever need to be SVG, they must be
-- served from a separate origin with a strict CSP, not from this bucket.

-- ---------------------------------------------------------------------------
-- Path convention
--
--   china-request-images/<profile_id>/<request_id>/<uuid>.<ext>
--
-- The first folder segment is the owning profile id. That single invariant is
-- what lets the policies below authorise from the PATH ALONE, with no join to
-- china_requests and no query per file. 0016 enforces the second segment
-- matches the request id.
--
-- The server generates this path. It must never accept a client-supplied
-- path: a client that chose its own folder could place a file under another
-- customer's profile id and read it back under their own policy. The path is
-- a security boundary, so treat its construction as server-only.
-- ---------------------------------------------------------------------------

-- Owner or staff: read the object.
drop policy if exists "china request images read own"
  on storage.objects;
create policy "china request images read own"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'china-request-images'
    and (
      (storage.foldername(name))[1] = public.current_profile_id()::text
      or public.is_staff()
    )
  );

-- Owner or staff: upload. The parent request must be theirs, so an upload
-- cannot be attached to somebody else's request even with a valid folder name.
drop policy if exists "china request images upload own"
  on storage.objects;
create policy "china request images upload own"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'china-request-images'
    and (
      (storage.foldername(name))[1] = public.current_profile_id()::text
      or public.is_staff()
    )
    and exists (
      select 1 from public.china_requests r
       where r.id::text = (storage.foldername(name))[2]
         and ( r.customer_id = public.current_profile_id()
               or public.is_staff() )
    )
  );

-- Staff only: reassignment. Moving an object between folders is how a file
-- would change owner, so it is not something a customer can do.
drop policy if exists "china request images update staff"
  on storage.objects;
create policy "china request images update staff"
  on storage.objects
  for update to authenticated
  using (bucket_id = 'china-request-images' and public.is_staff())
  with check (bucket_id = 'china-request-images' and public.is_staff());

-- Owner or staff: delete.
drop policy if exists "china request images delete own"
  on storage.objects;
create policy "china request images delete own"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'china-request-images'
    and (
      (storage.foldername(name))[1] = public.current_profile_id()::text
      or public.is_staff()
    )
  );

commit;

-- =============================================================================
-- VERIFY THIS, IT IS THE PART MOST LIKELY TO BE WRONG
--
-- Run the queries in 0018_verify below before trusting any of it. Specifically:
--
--   1. Does the authenticated role have USAGE on schema storage? Without it
--      every policy here is inert and uploads fail with a bare permission
--      error that names no policy.
--
--   2. storage.foldername(name) returns TEXT[] of the path segments AFTER the
--      bucket. So for
--        china-request-images/<profile>/<request>/<uuid>.jpg
--      the array is [profile, request, uuid.jpg] and [1] is the profile.
--      Indexing [2] as the request assumes that shape exactly. If the path
--      ever gains or loses a leading segment, the policies fail CLOSED -- an
--      empty result set, not a leak -- but the symptom is uploads mysteriously
--      rejected, which is easy to misdiagnose as a bucket or MIME problem.
--
--   3. Confirm the app is not using the service-role key to upload. A
--      service-role client BYPASSES all of these policies. If the server
--      uploads with service role, the storage policies provide no protection
--      whatsoever and the only remaining control is that the server never
--      signs a URL for a path the caller did not upload. The API layer must
--      therefore pass the CUSTOMER's JWT to Supabase, not a service-role key,
--      for the whole of this phase to mean anything.
--
-- Suggested check:
--   select policyname, cmd, qual
--     from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname like 'china request images%';
-- =============================================================================

-- =============================================================================
-- 0018_verify - expected results, and what each failure means
-- =============================================================================

-- (a) Bucket exists, is private, caps size and types.
--   Expect exactly 1 row: china-request-images | public=f | 8388608
--   Zero rows  -> 0018 did not run.
--   public=t   -> someone flipped it; signed URLs are now bypassable.
--
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'china-request-images';

-- (b) All four policies present.
--   Expect 4 rows: read / insert / update / delete.
--
-- select policyname, cmd from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and policyname like 'china request images%'
--  order by policyname;

-- (c) authenticated can use storage. If this is empty or 'f', every policy
--     above is decorative.
--
-- select has_schema_privilege('authenticated', 'storage', 'USAGE') as can_use_storage;

-- (d) The auth bridge is populated. RLS is a no-op while this is 0 for
--     existing profiles -- customers will see zero requests and no error.
--
-- select count(*) filter (where auth_user_id is not null) as linked,
--        count(*) filter (where auth_user_id is null)     as unlinked,
--        count(*) as total
--   from public.profiles;
