-- =============================================================================
-- 0009_create_cart_items
--
-- Creates the BONFILS STORE `cart_items` line-item table. Creates nothing else,
-- migrates no cart data, and does not modify public.carts, public.products or
-- public.categories.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0008_create_carts and 0006_create_products.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.cart_items (
  id         uuid        primary key default gen_random_uuid(),
  cart_id    uuid        not null,
  product_id uuid        not null,
  quantity   integer     not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per product per cart. Also serves as the supporting index for
  -- "load this cart's items", since cart_id is the leading column.
  constraint cart_items_cart_product_key unique (cart_id, product_id),

  -- A line item with no cart, or for a deleted product, is meaningless, so
  -- both go on delete. See the note in the footer about the UX consequence.
  constraint cart_items_cart_id_fkey    foreign key (cart_id)
    references public.carts (id)    on delete cascade,
  constraint cart_items_product_id_fkey foreign key (product_id)
    references public.products (id) on delete cascade,

  -- Only the floor is enforced here. Quantity against available stock is
  -- deliberately NOT a table constraint: stock lives on products and changes
  -- concurrently, so it is revalidated inside the order transaction
  -- (server/routes/orders.ts:39-55, with SELECT ... FOR UPDATE).
  constraint cart_items_quantity_positive check (quantity > 0)
);

-- Reverse lookup: every cart containing a given product. Needed to warn
-- shoppers when a product they carted becomes unavailable, and to clean up
-- carts when a product is deleted.
create index if not exists cart_items_product_id_idx
  on public.cart_items (product_id);

-- Reuses the generic trigger function introduced in 0008. No new copy here.
drop trigger if exists cart_items_set_updated_at on public.cart_items;

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row
  execute function public.touch_updated_at();

-- Secure default, consistent with 0001-0008.
alter table public.cart_items enable row level security;

commit;

-- =============================================================================
-- GAPS TO SETTLE BEFORE ANY CART IS WRITTEN
--
-- 1. NO VARIANTS. The application cart carries `selectedColor` and
--    `selectedSize` on every line (src/context/CartContext.tsx:11, 77), and
--    this table has no columns for them, so a chosen variant cannot be stored.
--
-- 2. `unique (cart_id, product_id)` codifies the app's CURRENT behaviour, which
--    is not obviously correct. addItem() (CartContext.tsx:71) looks up an
--    existing row for the product and overwrites its selectedColor/selectedSize,
--    so adding a blue shirt after a red one silently switches the line to blue
--    rather than adding a second line. If both variants should be buyable, the
--    key has to widen:
--
--      drop constraint cart_items_cart_product_key;
--      alter table public.cart_items
--        add column selected_color text not null default '',
--        add column selected_size  text not null default '',
--        add constraint cart_items_cart_variant_key
--          unique (cart_id, product_id, selected_color, selected_size);
--
--    Leave it as-is only if one-row-per-product is genuinely intended.
--
-- 3. NO PRICE SNAPSHOT. The app embeds the whole Product object in the cart, so
--    the price shown is a client-side snapshot. A server-side cart should
--    store unit_price as well, otherwise a cart can sit for days and then
--    check out at a stale price. orders.ts revalidates price on submit, so this
--    is a "show the customer the truth" concern, not a correctness hole.
--
-- 4. CASCADE on product_id means deleting a product silently removes it from
--    every cart with no notice to the shopper. Common practice is to keep the
--    line and flag it unavailable, which needs the name/price snapshot from
--    point 3. Acceptable as a starting point.
-- =============================================================================
