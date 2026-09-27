-- =============================================================================
-- 0016_create_china_request_images
--
-- Multiple product images per China sourcing request.
--
-- Why a table and not an array or text[]:
--   Supabase Storage stores files as objects with their own path, size, mime
--   type and owner. A text[] of paths would work for a first version and then
--   become the reason you cannot answer "which file is 12MB, uploaded by whom,
--   and is it still referenced". One row per file keeps the storage metadata
--   next to the row that claims the file exists.
--
-- The files themselves live in Supabase Storage (bucket defined in 0018), NOT
-- on the Vercel filesystem. Serverless filesystems are ephemeral and
-- per-instance; an upload written there is gone on the next cold start.
--
-- Creates no other table. Copies no existing data.
-- Run AFTER 0012_create_china_requests.
-- NOT YET EXECUTED.
-- =============================================================================

begin;

create table if not exists public.china_request_images (
  id             uuid        primary key default gen_random_uuid(),
  request_id     uuid        not null,
  -- Path WITHIN the bucket, e.g.
  --   <profile_id>/<request_id>/<uuid>.jpg
  -- The leading folder segment is the owning profile id, which is what makes
  -- a path-only storage.objects policy possible (see 0018). Keep that
  -- invariant: if the path shape changes, the storage policies break
  -- silently and uploads start failing with a bare 403.
  storage_path   text        not null,
  storage_bucket text        not null default 'china-request-images',
  -- Convenience copy of the path in bucket-root form. Signed URLs are minted
  -- per request and expire, so they are never stored -- only regenerated.
  public_url     text,
  file_name      text,
  mime_type      text,
  size_bytes     bigint,
  width          integer,
  height         integer,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now(),

  constraint china_request_images_request_fkey foreign key (request_id)
    references public.china_requests (id) on delete cascade,

  -- Idempotent uploads: a retried request cannot create a duplicate row for
  -- the same object.
  constraint china_request_images_path_key unique (storage_path),

  constraint china_request_images_size_nonneg check (size_bytes is null or size_bytes > 0),
  constraint china_request_images_sort_nonneg  check (sort_order >= 0),
  constraint china_request_images_dimensions   check (
    (width  is null or width  > 0) and (height is null or height > 0)
  ),

  -- Every image row must be prefixed by the request's own customer folder, so
  -- the owner can be proven from the path alone.
  constraint china_request_images_path_prefix check (
    split_part(storage_path, '/', 2) = request_id::text
  )
);

-- Renders a request's images. Index on (request_id) is the primary access path.
create index if not exists china_request_images_request_idx
  on public.china_request_images (request_id, sort_order, created_at);

-- Orphan sweep: find image rows whose file is no longer in the bucket.
-- Run periodically; storage.objects is the source of truth for existence.
create index if not exists china_request_images_path_idx
  on public.china_request_images (storage_path);

alter table public.china_request_images enable row level security;

commit;

-- =============================================================================
-- CAP AND TYPE ENFORCEMENT
--
-- Neither is enforced by this table, deliberately:
--
--   Per-request image cap. The bucket in 0018 caps a single FILE at 8MB, but
--   nothing caps how many files one request may carry. Without a request-level
--   limit a single customer can fill your bucket. Either a trigger, or an
--   application-level count check -- and note that a bare SELECT count() under
--   RLS is subject to the same policy, so it works, but a race between two
--   concurrent uploads still needs a lock or a unique constraint to be
--   airtight.
--
--   MIME type. mime_type is stored but not constrained, because the bucket's
--   allowed_mime_types in 0018 is the real gate -- Storage rejects disallowed
--   types before this table ever sees the row. Do not trust the value here on
--   its own; read it back from storage.objects if it matters.
--
-- Neither is left undone out of laziness: both are policy decisions (how much
-- storage does one request get, and do you serve SVG?) rather than schema
-- facts, and this phase did not specify them.
-- =============================================================================
