-- =============================================================================
-- 0012_create_china_requests
--
-- Creates the BONFILS STORE `china_requests` table for the China sourcing
-- workflow. Creates nothing else, migrates no requests, and does not modify
-- public.products, public.categories, public.carts or public.orders.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
--
-- !! THIS TABLE COVERS ONLY HALF OF WHAT THE APPLICATION SENDS. See footer.
-- =============================================================================

begin;

create table if not exists public.china_requests (
  id                 uuid           primary key default gen_random_uuid(),
  request_number     text           not null,
  customer_id        uuid,
  product_name       text           not null,
  description        text           not null default '',
  quantity           integer        not null default 1,
  specifications     jsonb          not null default '{}'::jsonb,
  budget             numeric(12, 2),
  product_url        text,
  contact_phone      text,
  shipping_preference text,
  status             text           not null default 'REQUEST_RECEIVED',
  assigned_staff_id  uuid,
  quotation_amount   numeric(12, 2),
  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now(),

  constraint china_requests_number_key unique (request_number),

  -- SET NULL, not CASCADE: a sourcing request is a business record that may
  -- have led to a purchase, so it must outlive the account that raised it.
  constraint china_requests_customer_id_fkey foreign key (customer_id)
    references public.profiles (id) on delete set null,

  -- SET NULL: when a staff member leaves, their queue becomes unassigned
  -- rather than disappearing.
  constraint china_requests_staff_id_fkey foreign key (assigned_staff_id)
    references public.profiles (id) on delete set null,

  constraint china_requests_name_not_blank  check (char_length(btrim(product_name)) between 1 and 300),
  constraint china_requests_quantity_positive check (quantity > 0),
  -- Budget and quotation are both legitimately unknown at creation, so they
  -- are nullable - but must never be negative when present.
  constraint china_requests_budget_nonneg    check (budget is null or budget >= 0),
  constraint china_requests_quotation_nonneg check (quotation_amount is null or quotation_amount >= 0),
  constraint china_requests_phone_length     check (contact_phone is null or char_length(contact_phone) <= 32),
  -- Left as free text: the valid shipping options (AIR / SEA / EXPRESS / ...)
  -- are a business decision I should not invent. Constrain it once agreed:
  --   check (shipping_preference in ('AIR', 'SEA', 'EXPRESS', 'RAIL'))
  constraint china_requests_shipping_pref_length check (
    shipping_preference is null or char_length(shipping_preference) <= 32
  ),

  constraint china_requests_status_valid check (status in (
    'REQUEST_RECEIVED',
    'UNDER_REVIEW',
    'CONTACTING_CUSTOMER',
    'PRODUCT_SEARCHING',
    'SUPPLIER_FOUND',
    'PRICE_NEGOTIATION',
    'CUSTOMER_CONFIRMATION',
    'PAYMENT_PENDING',
    'PURCHASED',
    'SHIPPING',
    'IN_TRANSIT',
    'ARRIVED',
    'DELIVERED',
    'CANCELLED'
  ))
);

-- Admin dashboards filter on these three constantly.
create index if not exists china_requests_status_idx   on public.china_requests (status);
create index if not exists china_requests_staff_idx    on public.china_requests (assigned_staff_id);
create index if not exists china_requests_customer_idx  on public.china_requests (customer_id);
create index if not exists china_requests_created_idx  on public.china_requests (created_at desc);

-- Reuses the generic trigger function introduced in 0008.
drop trigger if exists china_requests_set_updated_at on public.china_requests;

create trigger china_requests_set_updated_at
  before update on public.china_requests
  for each row
  execute function public.touch_updated_at();

-- Secure default, consistent with 0001-0011.
alter table public.china_requests enable row level security;

commit;

-- =============================================================================
-- BLOCKING GAP - half the request payload has nowhere to go
--
-- The ChinaRequest interface in src/types.ts carries roughly 25 fields. This
-- table has 15 columns. Absent from the table but required or used today:
--
--   images           string[]  REQUIRED in the type. The sourcing form accepts
--                              customer reference photos and there is no column
--                              for them. This is the same gap products had
--                              before product_images existed, and it needs its
--                              own table (request_images), not a text[] here,
--                              or the column will be added twice.
--   category         string    REQUIRED in the type. No column. Requests cannot
--                              be routed to a category or filtered by one.
--   customerName     string    REQUIRED in the type. Only contact_phone is in
--   customerEmail    string    REQUIRED in the type. this table, and both are
--                              needed to contact the customer about a quote.
--   preferredBrand   string?   Sourcing filters are built on these.
--   modelNumber      string?
--   color            string?
--   size             string?
--
-- Two TYPE mismatches, not just missing columns:
--
--   specifications   The app types this as `specifications?: string` (free
--                     text). This table declares it jsonb. Pick one. Free text
--                     is almost certainly right here, since a customer types
--                     "500W, 220V, single phase" rather than filling a form.
--   estimatedBudget  The app calls it `estimatedBudget`; this table `budget`.
--   referenceUrl     The app calls it `referenceUrl`; this table `product_url`.
--
-- The pragmatic fix, and the pattern the existing schema already uses: the
-- current china_requests table in server/db/schema.ts stores the entire
-- payload in a single `data JSONB` column, which is how it supports 25+ fields
-- without columns. So add a catch-all rather than a fourteenth column:
--
--   alter table public.china_requests
--     add column data jsonb not null default '{}'::jsonb;
--
-- and keep the 15 specified columns for the fields worth indexing and querying.
--
-- request_number GENERATION - the app builds these as
-- `BFS-CHINA-<year>-<000000>` (server/routes/china.ts:38). To move that into
-- the database instead of the application:
--
--   create sequence if not exists china_request_number_seq;
--   alter table public.china_requests alter column request_number
--     set default ('BFS-CHINA-' || extract(year from now())::text || '-' ||
--                  lpad(nextval('china_request_number_seq')::text, 6, '0'));
--
-- STATUS TRANSITIONS ARE NOT ENFORCED. The CHECK above constrains the set of
-- valid values, but nothing prevents a request moving backwards or skipping
-- stages - DELIVERED -> REQUEST_RECEIVED is accepted by the database. For a
-- 14-stage workflow that is usually wrong. Options, cheapest first:
--
--   1. Enforce in the application, where the transitions are already known.
--   2. A trigger that rejects an illegal old -> new pair, with an explicit
--      allow-list of legal edges.
--
-- Do not skip this deliberately: sourcing requests drive quotations and
-- payments, and a silently backwards-moving status is how a customer gets
-- told a delivered order is still under review.
-- =============================================================================
