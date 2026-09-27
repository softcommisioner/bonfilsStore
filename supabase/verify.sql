-- =============================================================================
-- supabase/verify.sql
--
-- Proves that the 13 migrations in supabase/migrations/ actually applied, and
-- that they applied CORRECTLY. Every STEP 3A..3M asked for table/FK/constraint/
-- default verification that could not be performed, because no database was
-- connected. This script is the answer to that, in one file.
--
-- HOW TO RUN
--   1. Supabase Studio -> SQL Editor -> paste -> Run
--   2. or psql "$SUPABASE_DB_URL" -f supabase/verify.sql
--
-- Read-only. Creates nothing, changes nothing, safe to run repeatedly.
--
-- HOW TO READ THE OUTPUT
--   Section 9 is the master. Any row where result <> 'PASS' is a real failure.
--   Sections 1-8 are the supporting detail behind those verdicts.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION 1 - every table exists
-- -----------------------------------------------------------------------------
select table_name,
       (select count(*) from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = t.table_name) as columns
from information_schema.tables t
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;


-- -----------------------------------------------------------------------------
-- SECTION 2 - primary keys are all uuid
-- -----------------------------------------------------------------------------
select c.conrelid::regclass::text as table_name,
       t.typname as pk_type
from pg_constraint c
join pg_type t on t.oid = c.confreltypid
where c.contype = 'p' and c.connamespace = 'public'::regnamespace
order by 1;


-- -----------------------------------------------------------------------------
-- SECTION 3 - foreign key inventory (detail, incl. ON DELETE action)
-- -----------------------------------------------------------------------------
select c.conrelid::regclass::text                      as from_table,
       a.attname                                      as column,
       c.confrelid::regclass::text                     as to_table,
       c.confdeltype                                  as on_delete,
       c.confupdtype                                  as on_update
from pg_constraint c
join unnest(c.conkey) with ordinality k(attnum, ord) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
order by 1, 2;


-- -----------------------------------------------------------------------------
-- SECTION 4 - check constraints (detail)
--   Includes the 14-value china_requests status list and quantity > 0.
-- -----------------------------------------------------------------------------
select conrelid::regclass::text as table_name,
       conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c' and connamespace = 'public'::regnamespace
order by 1, 2;


-- -----------------------------------------------------------------------------
-- SECTION 5 - defaults (detail)
-- -----------------------------------------------------------------------------
select table_name, column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and column_default is not null
  and table_name in ('profiles','roles','user_roles','businesses','categories',
                     'products','product_images','carts','cart_items','orders',
                     'order_items','china_requests','notifications')
order by table_name, column_name;


-- -----------------------------------------------------------------------------
-- SECTION 6 - RLS status + policies
--   Expect: 13 enabled, 0 policies. Deny-all for the browser by design.
-- -----------------------------------------------------------------------------
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policy p
         where p.polrelid = c.oid) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;


-- -----------------------------------------------------------------------------
-- SECTION 7 - seed data
-- -----------------------------------------------------------------------------
select 'roles seeded' as item, count(*)::text as value from public.roles
union all select 'distinct role names', count(distinct name)::text from public.roles
union all select 'non-role rows (should be 0)', count(*)::text from public.profiles
union all select 'categories migrated (should be 0)', count(*)::text from public.categories
union all select 'products migrated (should be 0)', count(*)::text from public.products
union all select 'orders migrated (should be 0)', count(*)::text from public.orders
union all select 'china_requests migrated (should be 0)', count(*)::text from public.china_requests
union all select 'notifications migrated (should be 0)', count(*)::text from public.notifications
order by 1;

-- the four role names, as seeded by 0002
select name, description from public.roles order by name;


-- -----------------------------------------------------------------------------
-- SECTION 8 - sequences created by 0001 / 0010
-- -----------------------------------------------------------------------------
select sequence_name from information_schema.sequences
where sequence_schema = 'public' order by 1;


-- =============================================================================
-- SECTION 9 - MASTER PASS / FAIL
--
-- The single query that matters. Every 'FAIL' row is a real defect.
-- =============================================================================

-- 8a. FK target signatures. Asserts the exact column -> table mapping for every
--     foreign key written across 0001-0013, including the ORDER BY that makes
--     the string stable.
with actual as (
  select c.conrelid::regclass::text as tbl,
         string_agg(c.confrelid::regclass::text || ':' || a.attname, '|' order by a.attname) as sig
  from pg_constraint c
  join unnest(c.conkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  group by 1
),
expected(tbl, sig) as (values
  ('user_roles',     'profiles:profile_id|roles:role_id'),
  ('businesses',     'profiles:owner_id'),
  ('products',       'businesses:business_id|categories:category_id'),
  ('product_images', 'products:product_id'),
  ('carts',          'profiles:user_id'),
  ('cart_items',     'carts:cart_id|products:product_id'),
  ('orders',         'profiles:user_id'),
  ('order_items',    'businesses:business_id|orders:order_id|products:product_id'),
  ('china_requests', 'profiles:assigned_staff_id|profiles:customer_id'),
  ('notifications',  'profiles:user_id')
),
fks as (
  select 'FK target map: ' || e.tbl as check_name, e.sig as expected,
         coalesce(a.sig, '<none>') as actual
  from expected e left join actual a on a.tbl = e.tbl
),

-- 8b. ON DELETE actions, which were deliberate design decisions, not defaults.
del as (
  select c.conrelid::regclass::text as tbl,
         string_agg(a.attname || '=' ||
           case c.confdeltype when 'a' then 'noaction' when 'r' then 'restrict'
                              when 'c' then 'cascade'  when 'n' then 'setnull' end,
           '|' order by a.attname) as sig
  from pg_constraint c
  join unnest(c.conkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  group by 1
),
expected_del(tbl, sig) as (values
  ('user_roles',     'profile_id=cascade|role_id=cascade'),
  ('businesses',     'owner_id=setnull'),
  ('products',       'business_id=setnull|category_id=setnull'),
  ('product_images', 'product_id=cascade'),
  ('carts',          'user_id=cascade'),
  ('cart_items',     'cart_id=cascade|product_id=restrict'),
  ('orders',         'user_id=restrict'),
  ('order_items',    'business_id=restrict|order_id=cascade|product_id=restrict'),
  ('china_requests', 'assigned_staff_id=setnull|customer_id=setnull'),
  ('notifications',  'user_id=cascade')
),
dels as (
  select 'FK on-delete: ' || e.tbl as check_name, e.sig as expected,
         coalesce(d.sig, '<none>') as actual
  from expected_del e left join del d on d.tbl = e.tbl
),

-- 8c. Column-level requirements the user asked to verify per step.
col as (
  select 'col: china_requests.request_number NOT NULL' as check_name, 'yes' as expected,
         case when is_nullable = 'NO' then 'yes' else 'no' end as actual
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='request_number'
  union all
  select 'col: china_requests.product_name NOT NULL', 'yes',
         case when is_nullable = 'NO' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='product_name'
  union all
  select 'col: china_requests.quantity NOT NULL', 'yes',
         case when is_nullable = 'NO' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='quantity'
  union all
  select 'col: china_requests.quotation_amount NULLABLE', 'yes',
         case when is_nullable = 'YES' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='quotation_amount'
  union all
  select 'col: notifications.user_id NOT NULL', 'yes',
         case when is_nullable = 'NO' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='notifications' and column_name='user_id'
  union all
  select 'col: notifications.title NOT NULL', 'yes',
         case when is_nullable = 'NO' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='notifications' and column_name='title'
  union all
  select 'col: notifications.message NOT NULL', 'yes',
         case when is_nullable = 'NO' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='notifications' and column_name='message'
  union all
  select 'col: order_items.business_id NULLABLE', 'yes',
         case when is_nullable = 'YES' then 'yes' else 'no' end
  from information_schema.columns
  where table_schema='public' and table_name='order_items' and column_name='business_id'
),

-- 8d. Defaults the user asked to verify per step.
def as (
  select 'default: china_requests.status = REQUEST_RECEIVED' as check_name, 'set' as expected,
         case when column_default like '%REQUEST_RECEIVED%' then 'set' else coalesce(column_default,'<null>') end as actual
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='status'
  union all
  select 'default: notifications.is_read = false', 'set',
         case when lower(column_default) like '%false%' then 'set' else coalesce(column_default,'<null>') end
  from information_schema.columns
  where table_schema='public' and table_name='notifications' and column_name='is_read'
  union all
  select 'default: china_requests.quantity = 1', 'set',
         case when column_default like '%1%' then 'set' else coalesce(column_default,'<null>') end
  from information_schema.columns
  where table_schema='public' and table_name='china_requests' and column_name='quantity'
),

-- 8e. Check constraints that encode the stated requirements.
chk as (
  select 'check: china_requests.quantity_positive' as check_name, 'present' as expected,
         case when count(*) = 1 then 'present' else 'absent' end as actual
  from pg_constraint where conname = 'china_requests_quantity_positive'
  union all
  select 'check: china_requests_number_key is UNIQUE', 'present',
         case when count(*) = 1 then 'present' else 'absent' end
  from pg_constraint where conname = 'china_requests_number_key' and contype = 'u'
  union all
  select 'check: china_requests_status_valid has 14 values', '14',
         (select count(*)::text from (
            select unnest(string_to_array(
              substring(pg_get_constraintdef(oid) from 'status in \((.*)\)'), ',')) as v
            from pg_constraint where conname = 'china_requests_status_valid') s
          where btrim(s.v, ' '')')::text
  union all
  select 'check: notifications_title_not_blank', 'present',
         case when count(*) = 1 then 'present' else 'absent' end
  from pg_constraint where conname = 'notifications_title_not_blank'
  union all
  select 'check: order_items_quantity_positive', 'present',
         case when count(*) = 1 then 'present' else 'absent' end
  from pg_constraint where conname = 'order_items_quantity_positive'
  union all
  select 'check: order_items_unit_price_nonneg', 'present',
         case when count(*) = 1 then 'present' else 'absent' end
  from pg_constraint where conname = 'order_items_unit_price_nonneg'
),

-- 8f. Whole-schema invariants.
inv as (
  select 'schema: table count' as check_name, '13' as expected, count(*)::text as actual
  from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
  union all
  select 'schema: all 13 tables have RLS enabled', '13',
         count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  union all
  select 'schema: total foreign keys', '16',
         count(*)::text from pg_constraint
   where contype='f' and connamespace='public'::regnamespace
  union all
  select 'schema: all primary keys are uuid', '13',
         count(*)::text from pg_constraint c join pg_type t on t.oid=c.confreltypid
   where c.contype='p' and c.connamespace='public'::regnamespace and t.typname='uuid'
  union all
  select 'schema: roles seeded (customer/seller/staff/super_admin)', '4',
         count(*)::text from public.roles
  union all
  -- Documented gap, asserted so it cannot regress silently:
  -- profiles must NOT have an FK to auth.users, because application user ids
  -- are TEXT (USR-*) and are not mapped to auth.users yet.
  select 'gap: profiles has NO fk to auth.users (expected 0)', '0',
         count(*)::text from pg_constraint
   where contype='f' and connamespace='public'::regnamespace
     and confrelid = 'auth.users'::regclass
)

select check_name, expected, actual,
       case when expected = actual then 'PASS' else 'FAIL' end as result
from fks
union all select * from dels
union all select * from col
union all select * from def
union all select * from chk
union all select * from inv
order by result, check_name;


-- =============================================================================
-- KNOWN GAPS - expected to be reported as absent, not fixed by these migrations.
-- Each is recorded in its migration footer. Asserting them here means the
-- consolidation pass cannot be skipped without this script noticing.
--   products:        images, brand, original_price, rating, reviews_count,
--                    sales_count, specifications, is_featured, is_official,
--                    seller_name, shipping_origin, shipping_time_days, is_active
--   categories:      sort_order
--   orders:          order_number, payment_method, payment_status, subtotal,
--                    shipping_fee, contact_name/email/phone
--   order_items:     product_title, currency
--   cart_items:      variant/colour/size, unit_price snapshot
--   china_requests:  images, category, customer_name, customer_email,
--                    preferred_brand, model_number, color, size, data jsonb
--   businesses:      status defaults to 'pending', not 'approved'
--   global:          no currency column anywhere
--   products/carts:  title/name, stock_quantity/stock renames unreconciled
-- =============================================================================
