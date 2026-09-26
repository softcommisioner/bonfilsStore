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
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience   TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

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
CREATE INDEX IF NOT EXISTS otps_lookup_idx ON otps (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS businesses (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT,
  name           TEXT NOT NULL,
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
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_key ON categories (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);

CREATE TABLE IF NOT EXISTS products (
  id                 TEXT PRIMARY KEY,
  business_id        TEXT NOT NULL DEFAULT '',
  seller_name        TEXT NOT NULL DEFAULT '',
  is_official        BOOLEAN NOT NULL DEFAULT FALSE,
  title              TEXT NOT NULL,
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
  specifications     JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_featured        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (LOWER(category));
CREATE INDEX IF NOT EXISTS products_business_idx ON products (business_id);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (is_active);
CREATE INDEX IF NOT EXISTS products_created_idx ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS products_sales_idx ON products (sales_count DESC);
CREATE INDEX IF NOT EXISTS products_price_idx ON products (price);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products (is_featured) WHERE is_featured = TRUE;

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
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

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
CREATE UNIQUE INDEX IF NOT EXISTS china_requests_number_key ON china_requests (request_number);
CREATE INDEX IF NOT EXISTS china_requests_user_idx ON china_requests (user_id);
CREATE INDEX IF NOT EXISTS china_requests_email_idx ON china_requests (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS china_requests_status_idx ON china_requests (status);

CREATE TABLE IF NOT EXISTS shipping_orders (
  id              TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'in_transit',
  data            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS shipping_orders_tracking_key ON shipping_orders (tracking_number);

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
CREATE INDEX IF NOT EXISTS activity_logs_timestamp_idx ON activity_logs (timestamp DESC);

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
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS emails (
  id         TEXT PRIMARY KEY,
  recipient  TEXT NOT NULL,
  subject    TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  html       TEXT NOT NULL DEFAULT '',
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status     TEXT NOT NULL DEFAULT 'sent'
);
CREATE INDEX IF NOT EXISTS emails_sent_idx ON emails (sent_at DESC);

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
`;
