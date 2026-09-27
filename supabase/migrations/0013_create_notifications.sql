-- =============================================================================
-- 0013_create_notifications
--
-- Creates the BONFILS STORE `notifications` table. Creates nothing else,
-- migrates no notifications, and does not modify any existing table.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
-- =============================================================================

begin;

create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  title      text        not null,
  message    text        not null default '',
  type       text        not null default 'system',
  link       text,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now(),

  -- CASCADE: a notification is personal, ephemeral, and meaningless without
  -- its owner. Same reasoning as carts and cart_items.
  constraint notifications_user_id_fkey foreign key (user_id)
    references public.profiles (id) on delete cascade,

  constraint notifications_title_not_blank check (char_length(btrim(title)) between 1 and 200),
  -- message allows '' to match the existing schema's `NOT NULL DEFAULT ''`,
  -- so nothing that inserts today starts failing.
  constraint notifications_message_length  check (char_length(message) <= 2000),

  -- The five values NotificationItem actually declares in src/types.ts. A
  -- constrained column keeps a typo from silently creating a sixth category
  -- that no UI branch handles.
  constraint notifications_type_valid check (type in
    ('order', 'china_request', 'quotation', 'system', 'product'))
);

-- Serves GET /api/notifications: one user's notifications, newest first.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Optional: if you add a server-side unread badge count, this partial index
-- serves it without scanning the user's whole history.
--   create index notifications_unread_idx
--     on public.notifications (user_id) where is_read = false;

-- Secure default, consistent with 0001-0012.
alter table public.notifications enable row level security;

commit;

-- =============================================================================
-- NOTES
--
-- 1. `link` is ADDED beyond the requested column list. NotificationItem declares
--    `link?: string`, pushNotification() in server/middleware.ts accepts it, and
--    it is the only thing that makes a notification clickable through to the
--    order, sourcing request or quotation it refers to. Without the column,
--    every notification becomes a dead-end toast. Drop it if genuinely unused.
--
-- 2. `read` is RENAMED to `is_read`. The app type calls it `read` and the
--    existing schema column is `read`, so this is a rename that has to be
--    reflected in the API response mapping. Flagging it now rather than letting
--    it surface as an undefined field.
--
-- 3. NO READ TIMESTAMP - the one real weakness here. PATCH /api/notifications/
--    :id/read flips is_read to true, and once it has flipped there is no record
--    of WHEN the customer actually read it. For engagement reporting ("how
--    long do customers take to see a quotation ready?") that data is gone.
--    Prefer a nullable timestamp over a boolean, since is_read is derivable
--    from it:
--
--      alter table public.notifications
--        add column read_at timestamptz;
--      -- is_read then becomes:  read_at is not null
--      -- mark-read becomes:  update ... set read_at = now() where id = $1
--
--    Cheaper alternative if you want the boolean kept: add `read_at` alongside
--    it and set both in the same UPDATE.
--
-- 4. NO updated_at, and deliberately so: nothing about a notification changes
--    after creation except is_read, which read_at (point 3) covers better than
--    a generic updated_at would.
-- =============================================================================
