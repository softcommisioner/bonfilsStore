-- =============================================================================
-- 0005_create_categories
--
-- Creates the BONFILS STORE `categories` table. Creates nothing else and does
-- not modify any existing table. Intentionally seeds NO rows: the 12 approved
-- categories are a later, separate step.
--
-- Run with:  supabase db push
--       or:  paste into Supabase Studio -> SQL Editor -> Run
--
-- Run AFTER 0001_create_profiles.
--
-- NOT YET EXECUTED. This file has not been run against any database.
--
-- !! KNOWN GAP: this table has no `sort_order` column, but the application
-- !! orders the storefront by it (server/db/postgres-store.ts:423 does
-- !! `ORDER BY c.sort_order ASC, c.name ASC`, and the Category type in
-- !! src/types.ts declares `sortOrder: number`). The approved 12-category order
-- !! cannot be represented without it. See the note at the bottom of this file.
-- =============================================================================

begin;

create table if not exists public.categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null,
  description text        not null default '',
  image_url   text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint categories_slug_key        unique (slug),
  constraint categories_name_not_blank   check (char_length(btrim(name)) between 1 and 120),
  constraint categories_slug_not_blank   check (char_length(btrim(slug)) between 1 and 120),
  -- Slugs appear in URLs (/api/categories/:slug), so keep them lowercase
  -- kebab-case. Catches stray spaces, capitals and unicode before they reach
  -- routing.
  constraint categories_slug_format      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Matches the existing convention in server/db/schema.ts
-- (categories_name_lower_key), so "Electronics" and "electronics" cannot both
-- exist. Added beyond the literal spec.
create unique index if not exists categories_name_lower_key
  on public.categories (lower(name));

-- Keeps updated_at honest. Same self-contained duplication as 0001 and 0004.
create or replace function public.set_categories_updated_at()
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

drop trigger if exists categories_set_updated_at on public.categories;

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_categories_updated_at();

-- Secure default, consistent with 0001-0004.
alter table public.categories enable row level security;

commit;

-- =============================================================================
-- To close the sort_order gap (run as a separate, later migration - do NOT
-- append to this file):
--
--   alter table public.categories
--     add column if not exists sort_order integer not null default 0;
--
--   create index if not exists categories_sort_order_idx
--     on public.categories (sort_order);
--
-- Until then this table cannot reproduce the approved category order.
-- =============================================================================
