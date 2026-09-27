-- =============================================================================
-- 0010_create_orders
--
-- Creates the BONFILS STORE `orders` table. Creates nothing else, migrates no
-- orders, and does not modify public.products, public.categories or
-- public.carts.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
--
-- !! READ THE BLOCK AT THE BOTTOM. This table records no purchased products.
-- =============================================================================

begin;

create table if not exists public.orders (
  id               uuid           primary key default gen_random_uuid(),
  user_id          uuid           not null,
  status           text           not null default 'pending',
  total_amount     numeric(12, 2) not null,
  shipping_address jsonb          not null default '{}'::jsonb,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now(),

  -- RESTRICT, not CASCADE. Deleting a customer must not erase their order
  -- history, which is a financial record. This blocks account deletion while
  -- orders exist, so account removal has to be handled as an anonymisation
  -- flow rather than a hard delete. Note this makes orders the only table so
  -- far that refuses deletion: carts and product_items CASCADE, while
  -- businesses.owner_id and products.category_id SET NULL.
  constraint orders_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete restrict,

  constraint orders_total_amount_nonneg check (total_amount >= 0),
  constraint orders_status_valid       check (status in
    ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'))
);

-- Every order-list and per-customer-history query filters on user_id.
create index if not exists orders_user_id_idx   on public.orders (user_id);
create index if not exists orders_status_idx    on public.orders (status);
-- Admin dashboard lists newest first.
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Reuses the generic trigger function introduced in 0008.
drop trigger if exists orders_set_updated_at on public.orders;

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.touch_updated_at();

-- Secure default, consistent with 0001-0009.
alter table public.orders enable row level security;

commit;

-- =============================================================================
-- BLOCKING GAP - an order here records no products
--
-- This table stores a customer, a total and an address, but not WHAT was
-- bought. The existing orders table in server/db/schema.ts carries
-- `items JSONB NOT NULL DEFAULT '[]'::JSONB`, and server/routes/orders.ts
-- builds that array from the cart. Either add an order_items table (preferred,
-- since it can be indexed and joined):
--
--   create table public.order_items (
--     id          uuid primary key default gen_random_uuid(),
--     order_id    uuid not null references public.orders (id) on delete cascade,
--     product_id  uuid not null references public.products (id) on delete restrict,
--     quantity    integer not null check (quantity > 0),
--     unit_price  numeric(12,2) not null check (unit_price >= 0),
--     created_at  timestamptz not null default now()
--   );
--   create index order_items_order_id_idx on public.order_items (order_id);
--
-- or add `items jsonb not null default '[]'::jsonb` to match the current shape.
--
-- product_id is ON DELETE RESTRICT here, not CASCADE: deleting a product that
-- was already sold must not rewrite history.
--
-- ALSO MISSING, EACH BACKING LIVE BEHAVIOUR:
--
--   order_number    The app issues a customer-facing reference,
--                    `BFS-ORD-<year>-<00000>` (server/routes/orders.ts:84), and
--                    findOrder() resolves by id OR number. Without it there is
--                    nothing for a customer to quote, and no unique index for
--                    that lookup. Needs a sequence or generated column:
--                      order_number text unique not null default
--                        ('BFS-ORD-' || extract(year from now())::text || '-' ||
--                         lpad(nextval('order_number_seq')::text, 5, '0'))
--
--   payment_method  Collected at checkout from card / mobile_money /
--                    bank_transfer / cash_on_delivery (orders.ts:102) and
--                    currently persisted. Without it an order records no
--                    payment method.
--   payment_status  Distinct from order status in the current schema
--                    (defaults to 'pending'); a delivered order can still be
--                    unpaid.
--   subtotal and    The current schema stores subtotal + shipping_fee + total.
--     shipping_fee  Only the grand total survives here, so the breakdown shown
--                    at checkout cannot be reproduced or audited.
--   customer_name,  Deliberately denormalised onto the order in the current
--     customer_email, schema. Combined with ON DELETE RESTRICT above, this is
--     customer_phone what keeps an order deliverable: the address and contact
--                    survive a password change or an email update. It is also
--                    why account deletion must anonymise rather than cascade.
--
-- ONE FLOW GAP, NOT A SCHEMA GAP:
--
--   POST /orders is behind requireAuth (orders.ts:16), so user_id NOT NULL is
--   correct and there is no guest-checkout problem here. But the cart itself
--   lives in localStorage and can be filled before sign-in, so the checkout
--   flow needs a step that merges the guest localStorage cart into the user's
--   server-side carts/cart_items rows after login.
-- =============================================================================
