-- =============================================================================
-- 0011_create_order_items
--
-- Creates the BONFILS STORE `order_items` line-item table, replacing the
-- orders `items JSONB` column with one row per purchased item. Creates nothing
-- else, migrates no orders, and does not modify public.orders, public.products,
-- public.categories or public.carts.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0010_create_orders, 0006_create_products, 0004_create_businesses.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.order_items (
  id         uuid           primary key default gen_random_uuid(),
  order_id   uuid           not null,
  product_id uuid           not null,
  business_id uuid,
  quantity   integer        not null default 1,
  unit_price numeric(12, 2) not null,
  created_at timestamptz    not null default now(),

  -- Deleting an order deletes its lines. Nothing else is meaningful.
  constraint order_items_order_id_fkey foreign key (order_id)
    references public.orders (id) on delete cascade,

  -- RESTRICT: deleting a product that was already sold must not rewrite
  -- history. Without this, a cleanup DELETE on products would silently gut
  -- past orders.
  constraint order_items_product_id_fkey foreign key (product_id)
    references public.products (id) on delete restrict,

  -- RESTRICT, matching orders.user_id. business_id is a snapshot of which
  -- seller the item was sold by, kept for payout and reconciliation, so it is
  -- a financial record too. See the footer for the operational cost.
  constraint order_items_business_id_fkey foreign key (business_id)
    references public.businesses (id) on delete restrict,

  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_nonneg check (unit_price >= 0)
);

-- Load the lines for one order.
create index if not exists order_items_order_id_idx   on public.order_items (order_id);
-- Sales history / "also bought" per product.
create index if not exists order_items_product_id_idx on public.order_items (product_id);
-- Seller payout and reconciliation reporting, the reason business_id is
-- denormalised onto the line in the first place.
create index if not exists order_items_business_id_idx on public.order_items (business_id);

-- No updated_at and no trigger: a purchased line item is immutable. Correcting
-- one means cancelling and re-placing the order, which is what the existing
-- orders/1/:id/cancel endpoint is for.

-- Secure default, consistent with 0001-0010.
alter table public.order_items enable row level security;

commit;

-- =============================================================================
-- GAPS TO SETTLE
--
-- 1. NO PRODUCT NAME SNAPSHOT - this is a regression against the current
--    behaviour. server/routes/orders.ts:62 stores `productTitle: product.title`
--    on every line, and :66 stores the price. This table keeps unit_price but
--    drops the title, so renaming a product later makes historical order lines
--    unrenderable ("this product no longer exists" on a delivered order).
--    Strongly recommended:
--
--      alter table public.order_items
--        add column product_title text not null default '';
--
--    Set at insert time from the product row, same as unit_price.
--
-- 2. NO CURRENCY. unit_price is a bare numeric and the checkout accepts card,
--    mobile_money, bank_transfer and cash_on_delivery (orders.ts:102). If the
--    store can transact in more than one currency, every amount in both this
--    table and orders is ambiguous the moment two currencies meet. The current
--    schema has no currency either, so this is not a regression - but it is
--    much cheaper to add now than after the first mixed-currency report.
--
--    Either add `currency text not null default 'XOF'` (or whatever the primary
--    currency is) here and on orders, or document that all amounts are in a
--    single fixed currency and enforce that in one place.
--
-- 3. NO VARIANTS, BUT NOT A REGRESSION. The cart carries selectedColor and
--    selectedSize (src/context/CartContext.tsx:77) yet the current order line
--    does not - orders.ts:25-40 accepts only {productId, quantity}. So variants
--    are already lost at checkout today, and this table matches that. Worth
--    fixing properly, since a shopper who bought a blue shirt in size L cannot
--    be told which one later:
--
--      alter table public.order_items
--        add column selected_color text not null default '',
--        add column selected_size  text not null default '';
--
-- 4. NO UNIQUENESS ON (order_id, product_id), unlike cart_items. That is
--    deliberate in a sense - a single product may legitimately be split across
--    lines - but with no variant columns there is no reason for two lines to
--    name the same product, and no way to tell an intentional split from a
--    double-insert. If you want it closed:
--
--      alter table public.order_items
--        add constraint order_items_order_product_key
--          unique (order_id, product_id);
--
-- 5. THE OPERATIONAL COST OF ON DELETE RESTRICT ON business_id: once a seller
--    has made a single sale, their shop row can never be deleted, only marked
--    inactive. If shop deletion must stay possible, switch this FK to
--    `on delete set null` and accept that the seller attribution is lost -
--    or add a `business_name text` snapshot alongside the `product_title`
--    snapshot in point 1, which is the option that preserves both.
-- =============================================================================
