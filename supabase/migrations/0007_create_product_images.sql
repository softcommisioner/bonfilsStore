-- =============================================================================
-- 0007_create_product_images
--
-- Creates the BONFILS STORE `product_images` table, replacing the products
-- `images TEXT[]` column with one row per image. Creates nothing else, uploads
-- and migrates no images, and does not modify public.products or
-- public.categories.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0006_create_products.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.product_images (
  id           uuid        primary key default gen_random_uuid(),
  product_id   uuid        not null,
  image_url    text        not null,
  storage_path text,
  is_primary   boolean     not null default false,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),

  -- An orphaned image row is meaningless, so images go when the product does.
  -- This is a deliberate contrast with businesses.owner_id and
  -- products.category_id, which SET NULL to preserve the parent record.
  constraint product_images_product_id_fkey foreign key (product_id)
    references public.products (id) on delete cascade,

  constraint product_images_url_not_blank  check (char_length(btrim(image_url)) between 1 and 2048),
  constraint product_images_sort_nonneg    check (sort_order >= 0)
);

-- Indexes for the only two access paths: a product's images in display order,
-- and listing every image (admin/media work).
create index if not exists product_images_product_id_idx
  on public.product_images (product_id, sort_order);

-- At most one primary image per product. Without this, two rows can both be
-- is_primary = true and the storefront picks a nondeterministic display image:
-- resolveProductImage() in src/services/images.ts uses the first entry it is
-- given. Partial, so any number of non-primary images are still allowed.
create unique index if not exists product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary;

-- Secure default, consistent with 0001-0006.
alter table public.product_images enable row level security;

commit;
