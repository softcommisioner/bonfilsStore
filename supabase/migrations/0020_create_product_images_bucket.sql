-- =============================================================================
-- 0020_create_product_images_bucket
--
-- Public Supabase Storage bucket for seller/admin product photos.
--
-- The upload endpoints already authenticate the seller or Super Admin before
-- calling server/services/upload.ts. This client uses the service-role key,
-- so the bucket is public only so storefront <img> tags can load the files;
-- writes are restricted by the application's own auth checks.
--
-- Limits mirror the compressed payload produced by src/services/images.ts:
-- image/webp at up to 2 MiB, with legacy formats accepted for older images.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  3145728,  -- 3 MiB, matches config.maxUploadBytes
  array ['image/webp','image/jpeg','image/png','image/avif','image/gif']
)
on conflict (id) do update
   set public              = excluded.public,
       file_size_limit      = excluded.file_size_limit,
       allowed_mime_types   = excluded.allowed_mime_types;

commit;

-- Verify:
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'product-images';
