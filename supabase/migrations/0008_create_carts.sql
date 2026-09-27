-- =============================================================================
-- 0008_create_carts
--
-- Creates the BONFILS STORE `carts` table. Creates nothing else, migrates no
-- cart data, and does not modify public.products, public.categories,
-- public.profiles or public.roles.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
--
-- !! READ THE BLOCK AT THE BOTTOM. This table holds NO line items and cannot
-- !! represent a cart with anything in it.
-- =============================================================================

begin;

create table if not exists public.carts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One cart per user. Named as a constraint (not a bare index) so it shows up
  -- in information_schema.table_constraints.
  constraint carts_user_id_key unique (user_id),

  -- A cart cannot outlive its owner; a cart with no user is meaningless. Same
  -- reasoning as product_images -> products.
  constraint carts_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade
);

-- Generic updated_at trigger, shared by any table that needs one. The four
-- per-table copies created in 0001, 0004, 0005 and 0006
-- (set_profiles_updated_at, set_businesses_updated_at,
-- set_categories_updated_at, set_products_updated_at) are now redundant and can
-- be dropped, since nothing has been executed yet.
create or replace function public.touch_updated_at()
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

drop trigger if exists carts_set_updated_at on public.carts;

create trigger carts_set_updated_at
  before update on public.carts
  for each row
  execute function public.touch_updated_at();

-- Secure default, consistent with 0001-0007.
alter table public.carts enable row level security;

commit;

-- =============================================================================
-- BLOCKING GAP - no line items
--
-- The application cart is entirely client-side today. src/context/CartContext.tsx
-- stores it in localStorage under the key `bonfils_cart` (lines 40 and 51), and
-- each line item is:
--
--   { product: <entire Product object>, quantity, selectedColor, selectedSize }
--
-- There is no cart API and no cart table anywhere in server/ - orders.ts only
-- reads a cart in order to convert it into an order.
--
-- This table has no columns for any of that. It can record THAT a user has a
-- cart, but not what is in it, so a cart created through this table would
-- always be empty and the checkout flow could not be rebuilt from it. A
-- cart_items table is required:
--
--   create table public.cart_items (
--     id            uuid primary key default gen_random_uuid(),
--     cart_id       uuid not null references public.carts (id) on delete cascade,
--     product_id    uuid not null references public.products (id) on delete cascade,
--     quantity      integer not null default 1 check (quantity > 0),
--     selected_color text not null default '',
--     selected_size  text not null default '',
--     created_at    timestamptz not null default now(),
--     constraint cart_items_cart_product_key unique (cart_id, product_id)
--   );
--
-- Note the app currently embeds the whole Product object in the cart, so the
-- price a shopper saw is a client-side snapshot. A server-side cart should
-- snapshot unit_price too, otherwise line totals drift from the catalogue.
--
-- TWO DECISIONS TO SETTLE:
--
-- 1. `user_id` is NOT NULL, but the cart lives in localStorage and is usable
--    before anyone signs in. A guest cart therefore cannot be represented at
--    all. Either make user_id nullable (and add a session/token identifier for
--    guest carts), or accept that adding to a cart now requires an account.
--    That is a product decision, not a schema detail.
--
-- 2. `unique (user_id)` means one cart per user forever. If you later want
--    abandoned-cart recovery or order history to keep old carts, switch to a
--    partial unique index:
--
--      create unique index carts_one_active_per_user
--        on public.carts (user_id) where checked_out_at is null;
-- =============================================================================
