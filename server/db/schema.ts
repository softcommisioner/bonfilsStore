export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  country        TEXT NOT NULL DEFAULT '',
  city           TEXT NOT NULL DEFAULT '',
  roles          TEXT[] NOT NULL DEFAULT ARRAY['customer']::TEXT[],
  account_type   TEXT NOT NULL DEFAULT 'customer',
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  status         TEXT NOT NULL DEFAULT 'active',
  business_id    TEXT,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience   TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS otps (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL,
  purpose             TEXT NOT NULL,
  otp_hash            TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  attempts            INTEGER NOT NULL DEFAULT 0,
  max_attempts        INTEGER NOT NULL DEFAULT 5,
  resend_available_at TIMESTAMPTZ NOT NULL,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload             JSONB
);

CREATE TABLE IF NOT EXISTS businesses (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT,
  name           TEXT NOT NULL,
  business_name  TEXT NOT NULL DEFAULT '',
  type           TEXT NOT NULL DEFAULT 'external',
  description    TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  country        TEXT NOT NULL DEFAULT '',
  city           TEXT NOT NULL DEFAULT '',
  rating         NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  reviews_count  INTEGER NOT NULL DEFAULT 0,
  total_products INTEGER NOT NULL DEFAULT 0,
  total_sales    INTEGER NOT NULL DEFAULT 0,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  status         TEXT NOT NULL DEFAULT 'active',
  shipping_terms TEXT NOT NULL DEFAULT '',
  momo_pay_code  TEXT,
  airtel_money_code TEXT,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  whatsapp_number TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id               TEXT PRIMARY KEY DEFAULT 'global',
  usd_to_rwf_rate  NUMERIC(12,2) NOT NULL DEFAULT 1350,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  image       TEXT,
  icon        TEXT,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL DEFAULT '',
  seller_name        TEXT NOT NULL DEFAULT '',
  is_official        BOOLEAN NOT NULL DEFAULT FALSE,
  title              TEXT NOT NULL,
  name               TEXT NOT NULL DEFAULT '',
  slug               TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT 'Other',
  brand              TEXT NOT NULL DEFAULT '',
  price              NUMERIC(12,2) NOT NULL DEFAULT 0,
  original_price     NUMERIC(12,2),
  stock              INTEGER NOT NULL DEFAULT 0,
  images             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rating             NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  reviews_count      INTEGER NOT NULL DEFAULT 0,
  sales_count        INTEGER NOT NULL DEFAULT 0,
  shipping_origin    TEXT NOT NULL DEFAULT '',
  shipping_time_days TEXT NOT NULL DEFAULT '',
  fulfillment_status  TEXT NOT NULL DEFAULT 'available_now',
  estimated_delivery_days INTEGER,
  specifications     JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_featured        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  order_number     TEXT NOT NULL,
  customer_id      TEXT NOT NULL,
  customer_name    TEXT NOT NULL DEFAULT '',
  customer_email   TEXT NOT NULL DEFAULT '',
  customer_phone   TEXT NOT NULL DEFAULT '',
  items            JSONB NOT NULL DEFAULT '[]'::JSONB,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'processing',
  shipping_address JSONB NOT NULL DEFAULT '{}'::JSONB,
  payment_method   TEXT NOT NULL DEFAULT 'mobile_money',
  payment_status   TEXT NOT NULL DEFAULT 'pending',
  currency         TEXT NOT NULL DEFAULT 'USD',
  usd_to_rwf_rate  NUMERIC(12,2),
  payment_codes    JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS china_requests (
  id             TEXT PRIMARY KEY,
  request_number TEXT NOT NULL,
  user_id        TEXT,
  customer_email TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'REQUEST_RECEIVED',
  data           JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_orders (
  id              TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'in_transit',
  data            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT NOT NULL DEFAULT '',
  actor_name  TEXT NOT NULL DEFAULT '',
  actor_role  TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'system',
  target_id   TEXT,
  details     TEXT NOT NULL DEFAULT '',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'system',
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails (
  id         TEXT PRIMARY KEY,
  recipient  TEXT NOT NULL,
  subject    TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  html       TEXT NOT NULL DEFAULT '',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status     TEXT NOT NULL DEFAULT 'sent'
);

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media (
  id         TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['customer']::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'app';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) IN ('seller@bonfilsstore.com', 'buyer@bonfilsstore.com', 'staff@bonfilsstore.com'));
DELETE FROM users WHERE LOWER(email) IN ('seller@bonfilsstore.com', 'buyer@bonfilsstore.com', 'staff@bonfilsstore.com');

ALTER TABLE otps ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE otps ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE otps ADD COLUMN IF NOT EXISTS otp_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE otps ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otps ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;
ALTER TABLE otps ADD COLUMN IF NOT EXISTS resend_available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE otps ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE otps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE otps ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'external';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 5.00;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reviews_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS total_products INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS total_sales INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shipping_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS momo_pay_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS airtel_money_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE businesses SET business_name = COALESCE(business_name, name, 'Bonfils Store Official');

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS usd_to_rwf_rate NUMERIC(12,2) NOT NULL DEFAULT 1350;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE products ADD COLUMN IF NOT EXISTS business_id TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_name TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 5.00;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviews_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_origin TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_time_days TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'available_now';
ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_delivery_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE products SET name = COALESCE(name, title) WHERE name IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'mobile_money';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS usd_to_rwf_rate NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_codes JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS request_number TEXT NOT NULL DEFAULT '';
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'REQUEST_RECEIVED';
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE china_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT '';
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_transit';
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE emails ADD COLUMN IF NOT EXISTS recipient TEXT NOT NULL DEFAULT '';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS html TEXT NOT NULL DEFAULT '';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE emails ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';

ALTER TABLE counters ADD COLUMN IF NOT EXISTS value BIGINT NOT NULL DEFAULT 0;

ALTER TABLE media ADD COLUMN IF NOT EXISTS mime TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN IF NOT EXISTS data TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- Supabase starter-table compatibility.
-- migrations 0004-0007 created uuid-keyed businesses/categories/products with
-- different column names and no images column. CREATE TABLE IF NOT EXISTS does
-- not repair those tables, so product uploads and saves failed with a bare 500
-- ("column images does not exist"). These idempotent statements self-heal both
-- schemas without touching an already-correct application-owned database.
-- ---------------------------------------------------------------------------
DO $compat$
DECLARE
  target_table TEXT;
  fk RECORD;
  uuid_column RECORD;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users', 'sessions', 'otps', 'businesses', 'app_settings', 'categories',
    'products', 'orders', 'china_requests', 'shipping_orders', 'activity_logs',
    'notifications', 'emails', 'media'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = target_table
        AND data_type = 'uuid'
        AND column_name IN ('id', 'user_id', 'business_id', 'customer_id', 'owner_id', 'category_id', 'actor_id', 'target_id')
    ) THEN
      FOR fk IN
        SELECT conname, conrelid::regclass AS tbl
        FROM pg_constraint
        WHERE contype = 'f'
          AND (conrelid = to_regclass(target_table) OR confrelid = to_regclass(target_table))
      LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tbl, fk.conname);
      END LOOP;
    END IF;

    FOR uuid_column IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = target_table
        AND data_type = 'uuid'
        AND column_name IN ('id', 'user_id', 'business_id', 'customer_id', 'owner_id', 'category_id', 'actor_id', 'target_id')
    LOOP
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', target_table, uuid_column.column_name);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING %I::text', target_table, uuid_column.column_name, uuid_column.column_name);
    END LOOP;
  END LOOP;
END $compat$;

DO $backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'full_name') THEN
    EXECUTE $sql$ UPDATE users SET name = full_name WHERE name = '' AND full_name IS NOT NULL $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'businesses' AND column_name = 'business_name') THEN
    EXECUTE $sql$ UPDATE businesses SET name = business_name WHERE name = '' $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'businesses' AND column_name = 'address') THEN
    EXECUTE $sql$ UPDATE businesses SET location = address WHERE location = '' $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'categories' AND column_name = 'image_url') THEN
    EXECUTE $sql$ UPDATE categories SET image = image_url WHERE image IS NULL AND image_url IS NOT NULL $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'name') THEN
    EXECUTE $sql$ UPDATE products SET title = name WHERE title = '' $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'stock_quantity') THEN
    EXECUTE $sql$ UPDATE products SET stock = stock_quantity WHERE stock = 0 $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'status') THEN
    EXECUTE $sql$ UPDATE products SET is_active = TRUE WHERE status = 'active' $sql$;
    EXECUTE $sql$ UPDATE products SET is_active = FALSE WHERE status IN ('inactive', 'out_of_stock') $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'category_id') THEN
    EXECUTE $sql$
      UPDATE products p SET category = c.name
      FROM categories c
      WHERE p.category_id::text = c.id::text AND p.category = 'Other'
    $sql$;
  END IF;
  UPDATE products SET fulfillment_status = 'available_now' WHERE fulfillment_status IS NULL;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'user_id') THEN
    EXECUTE $sql$ UPDATE orders SET customer_id = user_id::text WHERE customer_id = '' AND user_id IS NOT NULL $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'total_amount') THEN
    EXECUTE $sql$ UPDATE orders SET total = total_amount WHERE total = 0 AND total_amount IS NOT NULL $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'is_read') THEN
    EXECUTE $sql$ UPDATE notifications SET read = is_read $sql$;
  END IF;
END $backfill$;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS otps_lookup_idx ON otps (email, purpose, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_key ON categories (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);
CREATE INDEX IF NOT EXISTS products_fulfillment_idx ON products (fulfillment_status);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (LOWER(category));
CREATE INDEX IF NOT EXISTS products_business_idx ON products (business_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (is_active);
CREATE INDEX IF NOT EXISTS products_created_idx ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS products_sales_idx ON products (sales_count DESC);
CREATE INDEX IF NOT EXISTS products_price_idx ON products (price);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products (is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS china_requests_number_key ON china_requests (request_number);
CREATE INDEX IF NOT EXISTS china_requests_user_idx ON china_requests (user_id);
CREATE INDEX IF NOT EXISTS china_requests_email_idx ON china_requests (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS china_requests_status_idx ON china_requests (status);
CREATE UNIQUE INDEX IF NOT EXISTS shipping_orders_tracking_key ON shipping_orders (tracking_number);
CREATE INDEX IF NOT EXISTS activity_logs_timestamp_idx ON activity_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS emails_sent_idx ON emails (sent_at DESC);

DO $nullable_columns$
DECLARE
  legacy_column RECORD;
BEGIN
  FOR legacy_column IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.is_nullable = 'NO'
      AND c.is_generated = 'NEVER'
      AND c.is_identity = 'NO'
      AND c.column_name <> 'id'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_catalog = tc.constraint_catalog
         AND kcu.constraint_schema = tc.constraint_schema
         AND kcu.constraint_name = tc.constraint_name
         AND kcu.table_schema = tc.table_schema
         AND kcu.table_name = tc.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = c.table_schema
          AND tc.table_name = c.table_name
          AND kcu.column_name = c.column_name
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL', 'public', legacy_column.table_name, legacy_column.column_name);
  END LOOP;
END $nullable_columns$;

INSERT INTO app_settings (id, usd_to_rwf_rate)
VALUES ('global', 1350)
ON CONFLICT (id) DO NOTHING;
`;
