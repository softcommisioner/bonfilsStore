-- =============================================================================
-- 0006_create_products
--
-- Creates the BONFILS STORE `products` table. Creates nothing else, inserts no
-- products, and does not modify any existing table.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0004_create_businesses and 0005_create_categories.
--
-- NOT YET EXECUTED. This file has not been run against any database.
--
-- !! READ THE BLOCK AT THE BOTTOM BEFORE USING THIS TABLE. !!
-- !! This table is NOT yet a drop-in replacement for the application's
-- !! products table. Several columns the running app depends on are absent.
-- =============================================================================

begin;

create table if not exists public.products (
  id             uuid           primary key default gen_random_uuid(),
  business_id    uuid           references public.businesses (id) on delete set null,
  category_id    uuid           references public.categories (id) on delete set null,
  name           text           not null,
  slug           text           not null,
  description    text           not null default '',
  price          numeric(12, 2) not null,
  stock_quantity integer        not null default 0,
  status         text           not null default 'active',
  created_at     timestamptz    not null default now(),
  updated_at     timestamptz    not null default now(),

  constraint products_slug_key       unique (slug),
  constraint products_name_not_blank  check (char_length(btrim(name)) between 1 and 300),
  constraint products_slug_not_blank  check (char_length(btrim(slug)) between 1 and 300),
  constraint products_slug_format     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Free products are legitimate (enquiries, auctions), so only the sign is
  -- constrained, not zero.
  constraint products_price_nonneg    check (price >= 0),
  constraint products_stock_nonneg    check (stock_quantity >= 0),
  constraint products_status_valid    check (status in ('active', 'inactive', 'out_of_stock'))
);

-- Postgres does not index the referencing side of a foreign key. Both of these
-- back live queries: "products for this shop" (seller dashboard) and "products
-- in this category" (storefront listing).
create index if not exists products_business_id_idx on public.products (business_id);
create index if not exists products_category_id_idx on public.products (category_id);

-- Keeps updated_at honest. Same self-contained duplication as 0001, 0004, 0005.
create or replace function public.set_products_updated_at()
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

drop trigger if exists products_set_updated_at on public.products;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_products_updated_at();

-- Secure default, consistent with 0001-0005.
alter table public.products enable row level security;

commit;

-- =============================================================================
-- BLOCKING GAPS - this table cannot serve the current application as-is.
--
-- The running app reads these columns from the products table defined in
-- server/db/schema.ts. They have no equivalent here, so every one of them is a
-- code change or a silent behaviour regression:
--
--   images          TEXT[]  - the ENTIRE product image pipeline. Nothing in
--                              src/services/images.ts can work without it.
--   title           TEXT    - renamed to `name` here. The app uses `title`
--                              everywhere (Product type, cards, detail view).
--   stock           INTEGER - renamed to `stock_quantity` here.
--   is_active       BOOLEAN - collapsed into `status`. See note below.
--   brand           TEXT    - backs GET /api/brands and the brand filter.
--   sales_count     INTEGER - backs sort=popular.
--   is_featured     BOOLEAN - backs GET /api/products/featured.
--   rating          NUMERIC - displayed on every product card.
--   reviews_count   INTEGER - displayed on every product card.
--   original_price  NUMERIC - the strikethrough "was" price.
--   specifications  JSONB   - the spec table on the product detail page.
--   shipping_origin / shipping_time_days - shown on listing and detail pages.
--   is_official, seller_name - the "official store" badge and seller display.
--
-- Two decisions to settle before any data is loaded:
--
-- 1. `status` collapses visibility and purchasability into one enum. The app
--    currently models those separately (is_active = listed, stock = buyable),
--    so a product that is delisted AND out of stock has no representation. A
--    boolean `is_active` plus a derived out_of_stock state avoids the loss.
--
-- 2. `category_id` replaces the app's TEXT `category` column with a real FK.
--    That is the right normalisation, but it means the API must now resolve
--    category_id -> name on every product response, because the frontend
--    (including src/services/images.ts) works with category NAMES. The
--    validation added in server/routes/helpers.ts also assumes a name, and
--    must be rewritten to take an id.
--
-- Suggested follow-up migration (not applied here):
--
--   alter table public.products
--     add column if not exists images text[] not null default '{}',
--     add column if not exists brand text not null default '',
--     add column if not exists original_price numeric(12,2),
--     add column if not exists rating numeric(3,2) not null default 5.00,
--     add column if not exists reviews_count integer not null default 0,
--     add column if not exists sales_count integer not null default 0,
--     add column if not exists specifications jsonb not null default '{}'::jsonb,
--     add column if not exists is_featured boolean not null default false,
--     add column if not exists is_official boolean not null default false,
--     add column if not exists seller_name text not null default '',
--     add column if not exists shipping_origin text not null default '',
--     add column if not exists shipping_time_days text not null default '';
-- =============================================================================
